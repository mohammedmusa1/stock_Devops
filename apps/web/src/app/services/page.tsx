"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  LayoutDashboard,
  LineChart,
  Settings,
  Star,
  Wallet,
  PieChart,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { BRAND_NAME } from "@/lib/brand";

const services = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    desc: "Portfolio value, charts, and quick actions",
  },
  {
    href: "/markets",
    icon: LineChart,
    title: "Markets",
    desc: "Live NSE prices and stock search",
  },
  {
    href: "/trade",
    icon: ArrowLeftRight,
    title: "Trade",
    desc: "Buy and sell stocks with market or limit orders",
  },
  {
    href: "/portfolio",
    icon: PieChart,
    title: "Portfolio",
    desc: "Holdings, P&L, and allocation",
  },
  {
    href: "/wallet",
    icon: Wallet,
    title: "Wallet",
    desc: "Deposit funds and view transaction history",
  },
  {
    href: "/watchlist",
    icon: Star,
    title: "Watchlist",
    desc: "Track symbols you care about",
  },
  {
    href: "/notifications",
    icon: Bell,
    title: "Notifications",
    desc: "Trades, logins, deposits, and alerts",
  },
  {
    href: "/settings",
    icon: Settings,
    title: "Settings",
    desc: "Password, profile, and account security",
  },
];

export default function ServicesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold">All services</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Everything {BRAND_NAME} offers. Sign in to open a service, or create an account to get started.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s, i) => (
            <motion.div
              key={s.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
            >
              <Link
                href={s.href}
                className="glass group flex h-full flex-col p-5 transition hover:border-cyan-500/40"
              >
                <s.icon className="h-7 w-7 text-cyan-500" />
                <h2 className="mt-3 font-semibold">{s.title}</h2>
                <p className="mt-2 flex-1 text-sm text-[var(--muted)]">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400">
                  Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-[var(--muted)]">
          Need an account?{" "}
          <Link href="/sign-up" className="font-medium text-cyan-600 hover:underline dark:text-cyan-400">
            Sign up
          </Link>{" "}
          or{" "}
          <Link href="/sign-in" className="font-medium text-cyan-600 hover:underline dark:text-cyan-400">
            login
          </Link>
        </p>
      </main>
    </div>
  );
}
