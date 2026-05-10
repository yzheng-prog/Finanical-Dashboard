import { create } from 'zustand';
import type { Holding, Quote } from '@/types';

interface HoldingsState {
  holdings: Holding[];
  quotes: Record<string, Quote>;      // symbol → Quote
  lastRefreshedAt: string | null;
  setHoldings: (holdings: Holding[]) => void;
  updateQuote: (symbol: string, quote: Quote) => void;
  setQuotes: (quotes: Record<string, Quote>) => void;
  setLastRefreshed: (at: string) => void;
  // Total net worth in base currency cents (holding cost basis when no quotes available)
  getTotalCostBasisCents: () => number;
  getTotalMarketValueCents: () => number;
}

export const useHoldingsStore = create<HoldingsState>((set, get) => ({
  holdings: [],
  quotes: {},
  lastRefreshedAt: null,

  setHoldings: (holdings) => set({ holdings }),
  updateQuote: (symbol, quote) =>
    set((state) => ({ quotes: { ...state.quotes, [symbol]: quote } })),
  setQuotes: (quotes) => set({ quotes }),
  setLastRefreshed: (at) => set({ lastRefreshedAt: at }),

  getTotalCostBasisCents: () =>
    get().holdings.reduce((sum, h) => sum + h.totalCostCents, 0),

  getTotalMarketValueCents: () => {
    const { holdings, quotes } = get();
    return holdings.reduce((sum, h) => {
      const quote = quotes[h.symbol];
      if (quote) {
        return sum + Math.round(quote.price * 100 * h.quantity);
      }
      return sum + h.totalCostCents; // fallback to cost basis
    }, 0);
  },
}));
