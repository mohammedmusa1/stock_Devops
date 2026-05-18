"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatINR, formatPercent, cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data.data,
    retry: false,
  });

  const { data: portfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => (await api.get("/portfolio")).data.data,
    enabled: !!me,
  });

  if (!me) {
    return (
      <div className="glass p-8 text-center">
        <p className="text-slate-400">Sign in to access your trading dashboard.</p>
        <Link href="/sign-in" className="mt-4 inline-block text-cyan-400">Login →</Link>
      </div>
    );
  }

  const chartData = [
    { t: "Mon", v: portfolio?.summary.netWorth ? portfolio.summary.netWorth * 0.95 : 0 },
    { t: "Tue", v: portfolio?.summary.netWorth ? portfolio.summary.netWorth * 0.97 : 0 },
    { t: "Wed", v: portfolio?.summary.netWorth ? portfolio.summary.netWorth * 0.96 : 0 },
    { t: "Thu", v: portfolio?.summary.netWorth ? portfolio.summary.netWorth * 0.99 : 0 },
    { t: "Fri", v: portfolio?.summary.netWorth ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {me.firstName}</h1>
      <p className="text-slate-400">Your trading command center</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="glass p-6 lg:col-span-2">
          <p className="text-sm text-slate-400">Portfolio value</p>
          <p className="text-3xl font-bold font-mono">{formatINR(portfolio?.summary.netWorth ?? me.wallet?.balance ?? 0)}</p>
          <p className={cn("text-sm", (portfolio?.summary.totalPnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {portfolio ? formatPercent(portfolio.summary.totalPnlPercent) : "—"} today
          </p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Area type="monotone" dataKey="v" stroke="#22d3ee" fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-6">
          <p className="text-sm text-slate-400">Cash balance</p>
          <p className="text-2xl font-mono font-bold">{formatINR(Number(me.wallet?.balance ?? 0))}</p>
          <div className="mt-6 space-y-2">
            <Link href="/trade" className="block rounded-lg bg-cyan-500/20 py-2 text-center text-cyan-300">Quick Trade</Link>
            <Link href="/wallet" className="block rounded-lg bg-violet-500/20 py-2 text-center text-violet-300">Add Funds</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
