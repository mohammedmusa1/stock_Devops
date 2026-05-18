"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";

export default function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(10000);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => (await api.get("/wallet")).data.data,
    retry: false,
  });

  async function deposit() {
    await api.post("/wallet/deposit", { amount, provider: "MANUAL" });
    qc.invalidateQueries({ queryKey: ["wallet"] });
  }

  if (isLoading) return <p className="text-slate-400">Loading wallet...</p>;
  if (!data) return <p className="text-slate-400"><a href="/login" className="text-cyan-400">Login</a> required.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Wallet</h1>
      <div className="mt-6 glass p-8">
        <p className="text-slate-400">Available balance</p>
        <p className="mt-2 text-4xl font-bold font-mono neon-text">{formatINR(data.available)}</p>
        <p className="mt-2 text-sm text-slate-500">Locked: {formatINR(data.lockedBalance)}</p>
      </div>

      <div className="mt-8 glass max-w-md p-6">
        <h2 className="font-semibold">Add funds (demo)</h2>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-3 w-full rounded-lg border border-indigo-500/30 bg-slate-900 px-3 py-2" />
        <button onClick={deposit} className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 font-semibold">Deposit</button>
      </div>
    </div>
  );
}
