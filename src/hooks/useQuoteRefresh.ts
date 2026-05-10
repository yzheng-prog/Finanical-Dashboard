// ============================================================
// useQuoteRefresh — 15-min auto-polling for live quotes
// Per doc 01 §3.2: "Refresh frequency: 15-minute delay"
// Calls /api/quote?symbol=X for each unique symbol held,
// then updates holdingsStore.quotes map.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useHoldingsStore } from '@/stores/holdingsStore';
import type { Quote } from '@/types';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch a single quote from the Vercel proxy.
 * Returns null on failure so one bad symbol doesn't break the batch.
 */
async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return (await res.json()) as Quote;
  } catch {
    return null;
  }
}

/**
 * Fetch quotes for a list of symbols with concurrency control.
 * We batch in groups of 5 to avoid hammering the proxy.
 */
async function fetchAllQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const result: Record<string, Quote> = {};
  const BATCH_SIZE = 5;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const quotes = await Promise.all(batch.map(fetchQuote));
    batch.forEach((sym, idx) => {
      const q = quotes[idx];
      if (q) result[sym] = q;
    });
  }

  return result;
}

/**
 * Hook: polls /api/quote for every unique symbol in holdings.
 * - Runs immediately on mount (or when holdings change to add new symbols)
 * - Sets up a 15-min interval for subsequent refreshes
 * - Cleans up the interval on unmount
 *
 * @param enabled  Pass false to disable polling (e.g., when no user logged in)
 */
export function useQuoteRefresh(enabled = true) {
  const { holdings, setQuotes, setLastRefreshed, quotes } = useHoldingsStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  // Stable set of unique symbols from current holdings
  const symbols = Array.from(new Set(holdings.map((h) => h.symbol))).sort();
  const symbolsKey = symbols.join(',');

  const refresh = useCallback(async () => {
    if (symbols.length === 0 || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const freshQuotes = await fetchAllQuotes(symbols);
      if (Object.keys(freshQuotes).length > 0) {
        // Merge with existing quotes so we don't lose quotes for symbols
        // that might have been removed from holdings but still relevant
        setQuotes({ ...quotes, ...freshQuotes });
        setLastRefreshed(new Date().toISOString());
      }
    } finally {
      isFetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, setQuotes, setLastRefreshed]);

  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      // Clear any existing interval when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch immediately on mount / symbol change
    void refresh();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, symbolsKey, refresh]);

  return { refresh, symbols };
}
