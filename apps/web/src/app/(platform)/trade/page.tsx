"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";

function TradeForm() {
  const params = useSearchParams();
  const symbol = (params.get("symbol") ?? "RELIANCE").toUpperCase();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");

  const { data: stock } = useQuery({
    queryKey: ["stock", symbol],
    queryFn: async () => (await api.get(`/stocks/${symbol}`)).data.data,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api.post(`/trading/${symbol}/order`, {
        side,
        type: "MARKET",
        quantity: qty,
      });
      setMsg("Order filled successfully!");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMsg(e.response?.data?.message ?? "Order failed");
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold">Trade {symbol}</h1>
      {stock && <p className="text-slate-400">{stock.name} · {formatINR(stock.currentPrice)}</p>}

      <form onSubmit={submit} className="glass mt-6 space-y-4 p-6">
        <div className="flex gap-2">
          <button type="button" onClick={() => setSide("BUY")} className={`flex-1 rounded-lg py-2 font-semibold ${side === "BUY" ? "bg-emerald-600" : "bg-slate-800"}`}>Buy</button>
          <button type="button" onClick={() => setSide("SELL")} className={`flex-1 rounded-lg py-2 font-semibold ${side === "SELL" ? "bg-rose-600" : "bg-slate-800"}`}>Sell</button>
        </div>
        <div>
          <label className="text-sm text-slate-400">Quantity</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-indigo-500/30 bg-slate-900 px-3 py-2" />
        </div>
        {msg && <p className="text-sm text-cyan-300">{msg}</p>}
        <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 font-semibold">
          Place {side} Order
        </button>
      </form>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Loading...</p>}>
      <TradeForm />
    </Suspense>
  );
}
