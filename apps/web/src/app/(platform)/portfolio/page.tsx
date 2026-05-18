"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatINR, formatPercent, cn } from "@/lib/utils";

export default function PortfolioPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => (await api.get("/portfolio")).data.data,
    retry: false,
  });

  if (isLoading) return <p className="text-slate-400">Loading portfolio...</p>;
  if (!data) return <p className="text-slate-400">Please <a href="/login" className="text-cyan-400">login</a> to view portfolio.</p>;

  const { positions, summary } = data;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <button onClick={() => refetch()} className="text-sm text-cyan-400">Refresh</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          { label: "Net Worth", value: formatINR(summary.netWorth) },
          { label: "Invested", value: formatINR(summary.totalInvested) },
          { label: "Current", value: formatINR(summary.totalCurrent) },
          { label: "P&L", value: formatINR(summary.totalPnl), extra: formatPercent(summary.totalPnlPercent) },
        ].map((c) => (
          <div key={c.label} className="glass p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="mt-1 text-xl font-bold font-mono">{c.value}</p>
            {c.extra && <p className={cn("text-sm", summary.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{c.extra}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 glass overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Avg</th>
              <th className="px-4 py-3 text-right">LTP</th>
              <th className="px-4 py-3 text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No holdings yet. Place a buy order.</td></tr>
            )}
            {positions.map((p: { symbol: string; quantity: number; avgBuyPrice: number; currentPrice: number; pnl: number; pnlPercent: number }) => (
              <tr key={p.symbol} className="border-t border-indigo-500/10">
                <td className="px-4 py-3 font-mono text-cyan-300">{p.symbol}</td>
                <td className="px-4 py-3 text-right">{p.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">{formatINR(p.avgBuyPrice)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatINR(p.currentPrice)}</td>
                <td className={cn("px-4 py-3 text-right font-mono", p.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatINR(p.pnl)} ({formatPercent(p.pnlPercent)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
