"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";

export default function WatchlistPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => (await api.get("/watchlist")).data.data,
    retry: false,
  });

  async function add(symbol: string) {
    await api.post(`/watchlist/${symbol}`);
    qc.invalidateQueries({ queryKey: ["watchlist"] });
  }

  if (isLoading) return <p className="text-slate-400">Loading...</p>;
  if (!data) return <p className="text-slate-400"><a href="/login" className="text-cyan-400">Login</a> required.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Watchlist</h1>
      <div className="mt-4 flex gap-2">
        {["TCS", "INFY", "HDFCBANK"].map((s) => (
          <button key={s} onClick={() => add(s)} className="rounded-lg border border-indigo-500/30 px-3 py-1 text-sm hover:bg-slate-800">+ {s}</button>
        ))}
      </div>
      <ul className="mt-6 space-y-2">
        {data.map((item: { symbol: string; name: string; currentPrice: number }) => (
          <li key={item.symbol} className="glass flex items-center justify-between px-4 py-3">
            <div>
              <span className="font-mono text-cyan-300">{item.symbol}</span>
              <span className="ml-2 text-slate-400">{item.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono">{formatINR(item.currentPrice)}</span>
              <Link href={`/trade?symbol=${item.symbol}`} className="text-cyan-400 text-sm">Trade</Link>
            </div>
          </li>
        ))}
        {!data.length && <p className="text-slate-500">Empty watchlist. Add symbols above.</p>}
      </ul>
    </div>
  );
}
