import { create } from "zustand";

export interface StockTick {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: string;
}

interface MarketState {
  ticker: StockTick[];
  selectedSymbol: string | null;
  setTicker: (stocks: StockTick[]) => void;
  updatePrice: (tick: StockTick) => void;
  setSelected: (symbol: string | null) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  ticker: [],
  selectedSymbol: null,
  setTicker: (stocks) => set({ ticker: stocks }),
  updatePrice: (tick) =>
    set((state) => {
      const idx = state.ticker.findIndex((s) => s.symbol === tick.symbol);
      if (idx === -1) return { ticker: [...state.ticker, tick] };
      const ticker = [...state.ticker];
      ticker[idx] = { ...ticker[idx], ...tick };
      return { ticker };
    }),
  setSelected: (symbol) => set({ selectedSymbol: symbol }),
}));
