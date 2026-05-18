"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Join Stock AI — wallet created automatically">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500"
          >
            {error}
          </motion.p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>First name</Label>
            <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>Phone</Label>
          <Input type="tel" placeholder="+91 9876543210" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
          <p className="text-xs text-[var(--muted)]">Min 8 chars, uppercase, lowercase, number</p>
        </div>

        <div className="space-y-2">
          <Label>Confirm password</Label>
          <Input type="password" value={form.confirm} onChange={(e) => update("confirm", e.target.value)} required />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          <UserPlus className="h-4 w-4" />
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-cyan-600 dark:text-cyan-400">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
