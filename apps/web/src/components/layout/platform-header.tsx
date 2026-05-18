"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Settings } from "lucide-react";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { ThemeToggle } from "./theme-toggle";
import { useAuthStore } from "@/store/auth-store";
import { useNotificationStore, type AppNotification } from "@/store/notification-store";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function PlatformHeader() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { items, unreadCount, setItems, addItem, markRead } = useNotificationStore();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications");
      return res.data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.data) {
      setItems(data.data as AppNotification[], data.meta?.unreadCount ?? 0);
    }
  }, [data, setItems]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit("subscribe:portfolio", { userId: user.id });
    socket.on("notification:new", (n: AppNotification) => addItem(n));
    return () => {
      socket.off("notification:new");
    };
  }, [user, addItem]);

  async function logout() {
    await api.post("/auth/logout");
    useAuthStore.getState().clear();
    qc.clear();
    router.push("/sign-in");
  }

  async function onMarkRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    markRead(id);
  }

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
      <div>
        <p className="text-sm text-[var(--muted)]">Welcome back</p>
        <p className="font-semibold">
          {user ? `${user.firstName} ${user.lastName}` : "Guest"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative group">
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <div className="absolute right-0 top-full z-50 mt-2 hidden w-80 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-xl group-hover:block">
            <p className="px-2 py-1 text-xs font-semibold text-[var(--muted)]">Notifications</p>
            {items.slice(0, 5).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onMarkRead(n.id)}
                className={cn(
                  "w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--glass)]",
                  !n.isRead && "bg-cyan-500/10"
                )}
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-[var(--muted)] line-clamp-2">{n.message}</p>
              </button>
            ))}
            {!items.length && <p className="px-2 py-4 text-xs text-[var(--muted)]">No notifications</p>}
            <Link href="/notifications" className="block px-2 py-2 text-center text-xs text-cyan-600 dark:text-cyan-400">
              View all
            </Link>
          </div>
        </div>

        <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
          <Settings className="h-4 w-4" />
        </Link>

        <button type="button" onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
