"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, LogIn, Shield, UserPlus, Wallet } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { BRAND_NAME } from "@/lib/brand";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass relative overflow-hidden p-10 text-center md:p-14"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            Smart trading platform
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Welcome to <span className="neon-text">{BRAND_NAME}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[var(--muted)]">
            Live markets, secure accounts, portfolio tracking, and real-time alerts.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Link href="/sign-up" className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              Sign up
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--glass)]"
            >
              <LogIn className="h-3.5 w-3.5" />
              Login
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400"
            >
              All services <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: BarChart3, title: "Live Markets", desc: "Real-time prices and portfolio updates" },
            { icon: Wallet, title: "Secure Wallet", desc: "Deposits, ledger, and trade execution" },
            { icon: Shield, title: "Account Security", desc: "Email verification, password reset, alerts" },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
              className="glass p-6"
            >
              <f.icon className="mb-3 h-8 w-8 text-cyan-500" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
