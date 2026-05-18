"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatINR, formatPercent, cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";

interface Stock {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
}

export default function MarketsPage() {
  const liveTicker = useMarketStore((s) => s.ticker);

  const { data, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => {
      const res = await api.get("/stocks?limit=50");
      return res.data.data as Stock[];
    },
  });

  const getLive = (symbol: string) => liveTicker.find((t) => t.symbol === symbol);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Markets</h1>
      <p className="text-slate-400">NSE stocks with live WebSocket prices</p>
      <div className="mt-6 overflow-hidden rounded-xl border border-indigo-500/20">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td>
              </tr>
            )}
            {(data ?? []).map((s) => {
              const live = getLive(s.symbol);
              const price = live?.price ?? s.currentPrice;
              const chg = live?.changePercent ?? s.changePercent;
              return (
                <tr key={s.symbol} className="border-t border-indigo-500/10 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono font-semibold text-cyan-300">{s.symbol}</td>
                  <td className="px-4 py-3 text-slate-300">{s.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(price)}</td>
                  <td className={cn("px-4 py-3 text-right font-mono", chg >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {formatPercent(chg)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/trade?symbol=${s.symbol}`} className="text-cyan-400 hover:underline">Trade</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
