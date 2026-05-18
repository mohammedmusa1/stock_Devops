"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { useMarketStore } from "@/store/market-store";
import { formatINR, formatPercent, cn } from "@/lib/utils";

export function LiveTicker() {
  const { ticker, setTicker, updatePrice } = useMarketStore();

  useEffect(() => {
    const socket = getSocket();
    socket.on("ticker:snapshot", (data: unknown) => {
      if (Array.isArray(data)) {
        setTicker(
          data.map((s: { symbol: string; name: string; currentPrice: number; change: number; changePercent: number }) => ({
            symbol: s.symbol,
            name: s.name,
            price: s.currentPrice,
            change: s.change,
            changePercent: s.changePercent,
          }))
        );
      }
    });
    socket.on("price:update", updatePrice);
    return () => {
      socket.off("ticker:snapshot");
      socket.off("price:update");
    };
  }, [setTicker, updatePrice]);

  const display = ticker.length ? [...ticker, ...ticker] : [];

  return (
    <div className="overflow-hidden border-b border-indigo-500/20 bg-slate-950/90 py-2">
      <div className="flex ticker-scroll gap-8 whitespace-nowrap px-4">
        {display.map((s, i) => (
          <span key={`${s.symbol}-${i}`} className="inline-flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-200">{s.symbol}</span>
            <span>{formatINR(s.price)}</span>
            <span className={cn(s.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {formatPercent(s.changePercent)}
            </span>
          </span>
        ))}
        {!display.length && (
          <span className="text-slate-500 text-sm">Connecting live market feed...</span>
        )}
      </div>
    </div>
  );
}
