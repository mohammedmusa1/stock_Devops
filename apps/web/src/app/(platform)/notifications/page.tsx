"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNotificationStore } from "@/store/notification-store";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { items, unreadCount, setItems, markRead, markAllRead } = useNotificationStore();

  const { isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications?limit=50");
      setItems(res.data.data, res.data.meta.unreadCount);
      return res.data;
    },
  });

  async function handleMarkRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    markRead(id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleMarkAll() {
    await api.patch("/notifications/mark-all-read");
    markAllRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-7 w-7 text-cyan-500" />
            Notifications
          </h1>
          <p className="text-[var(--muted)]">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--glass)]"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {isLoading && <p className="text-[var(--muted)]">Loading...</p>}

      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={cn(
              "glass cursor-pointer p-4 transition hover:border-cyan-500/30",
              !n.isRead && "border-l-4 border-l-cyan-500"
            )}
            onClick={() => !n.isRead && handleMarkRead(n.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{n.message}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-[var(--glass)] px-2 py-0.5 text-xs capitalize">
                {n.type}
              </span>
            </div>
          </li>
        ))}
        {!items.length && !isLoading && (
          <li className="glass p-12 text-center text-[var(--muted)]">No notifications yet</li>
        )}
      </ul>
    </div>
  );
}
