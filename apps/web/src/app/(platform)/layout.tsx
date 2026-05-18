"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { LiveTicker } from "@/components/market/live-ticker";
import { PlatformHeader } from "@/components/layout/platform-header";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) return;
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.data))
      .catch(() => router.replace("/sign-in"));
  }, [user, setUser, router]);

  return (
    <>
      <LiveTicker />
      <div className="flex min-h-[calc(100vh-40px)]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
          <PlatformHeader />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </>
  );
}
