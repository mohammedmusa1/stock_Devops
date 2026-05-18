"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const emailParam = params.get("email") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"otp" | "loading" | "ok" | "error">(token ? "loading" : "otp");
  const [message, setMessage] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setStatus("loading");
    api
      .post("/auth/verify-email/token", { token })
      .then((res) => {
        setStatus("ok");
        setMessage(res.data.data.message);
      })
      .catch((err: unknown) => {
        setStatus("otp");
        const ax = err as { response?: { data?: { message?: string } } };
        setMessage(ax.response?.data?.message ?? "Link expired. Enter OTP below.");
      });
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setMessage("Enter the full 6-digit code");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const res = await api.post("/auth/verify-email", { email, otp });
      setStatus("ok");
      setMessage(res.data.data.message);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setMessage(ax.response?.data?.message ?? "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!email || cooldown > 0) return;
    try {
      const res = await api.post("/auth/resend-verification", { email });
      setResendMsg(res.data.data.message);
      setCooldown(res.data.data.cooldownSeconds ?? 60);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setResendMsg(ax.response?.data?.message ?? "Could not resend");
    }
  }

  if (status === "ok") {
    return (
      <AuthShell title="Verified" subtitle="Your account is ready">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="text-emerald-600 dark:text-emerald-400">{message}</p>
          <Button className="w-full" onClick={() => router.push("/sign-in")}>
            Continue to login
          </Button>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Verify email" subtitle="Enter the 6-digit code we sent you">
      {status === "loading" ? (
        <p className="text-center text-[var(--muted)]">Verifying link...</p>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
            <div className="rounded-full bg-cyan-500/10 p-3">
              <Mail className="h-6 w-6 text-cyan-500" />
            </div>
          </motion.div>

          {message && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-500">
              {message}
            </p>
          )}

          <motion.div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
            />
          </motion.div>

          <motion.div className="space-y-2">
            <Label>Verification code</Label>
            <OtpInput value={otp} onChange={setOtp} disabled={submitting} />
            <p className="text-center text-xs text-[var(--muted)]">Expires in 10 minutes</p>
          </motion.div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Verifying..." : "Verify email"}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={cooldown > 0 || !email}
              onClick={resend}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </Button>
            {resendMsg && <p className="mt-1 text-xs text-[var(--muted)]">{resendMsg}</p>}
          </div>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="text-cyan-600 hover:underline dark:text-cyan-400">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthShell title="Verify email" subtitle="Loading..."><p className="text-center text-[var(--muted)]">Loading...</p></AuthShell>}>
      <VerifyContent />
    </Suspense>
  );
}
