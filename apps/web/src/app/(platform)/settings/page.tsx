"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setMsg("");
    try {
      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      setMsg(res.data.data.message);
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? "Failed to change password");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-[var(--muted)]">Account security and preferences</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass p-6">
          <h2 className="font-semibold">Profile</h2>
          {user && (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Name</dt><dd>{user.firstName} {user.lastName}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Email</dt><dd>{user.email}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Verified</dt><dd>{user.emailVerified ? "Yes" : "No"}</dd></div>
            </dl>
          )}
        </div>

        <div className="glass p-6">
          <h2 className="font-semibold">Change password</h2>
          <form onSubmit={changePassword} className="mt-4 space-y-3">
            {error && <p className="text-sm text-rose-500">{error}</p>}
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
            <input type="password" placeholder="Current password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <input type="password" placeholder="New password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <input type="password" placeholder="Confirm new password" className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <button type="submit" className="btn-primary w-full py-2">Update password</button>
          </form>
        </div>
      </div>
    </div>
  );
}
