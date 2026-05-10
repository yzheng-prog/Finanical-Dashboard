// ============================================================
// WatchListPage — Track symbols not in portfolio
// Users can add symbols and see live quotes (via proxy)
// Per doc schema: WatchListItem { id, userId, symbol, addedAt }
// ============================================================

import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useUserStore } from '@/stores/userStore';
import { useHoldingsStore } from '@/stores/holdingsStore';
import type { WatchListItem, Quote } from '@/types';
import { Money } from '@/components/custom/Money';
import { ChangeIndicator } from '@/components/custom/ChangeIndicator';

export function WatchListPage() {
  const { currentUser } = useUserStore();
  const { quotes, updateQuote } = useHoldingsStore();
  const [newSymbol, setNewSymbol] = useState('');
  const [fetching, setFetching] = useState<string | null>(null);

  const watchList = useLiveQuery<WatchListItem[]>(
    () =>
      currentUser
        ? db.watchList.where('userId').equals(currentUser.id).toArray()
        : Promise.resolve([] as WatchListItem[]),
    [currentUser?.id]
  );

  const fetchQuote = useCallback(async (symbol: string) => {
    try {
      setFetching(symbol);
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const q = (await res.json()) as Quote;
        updateQuote(symbol, q);
      }
    } catch {
      // Silently fail for individual symbol
    } finally {
      setFetching(null);
    }
  }, [updateQuote]);

  const handleAdd = async () => {
    if (!currentUser || !newSymbol.trim()) return;
    const symbol = newSymbol.trim().toUpperCase();

    // Check for duplicate
    const existing = watchList?.find((w) => w.symbol === symbol);
    if (existing) {
      setNewSymbol('');
      return;
    }

    await db.watchList.add({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      symbol,
      addedAt: new Date().toISOString(),
    });

    setNewSymbol('');
    // Fetch a quote immediately for the new symbol
    void fetchQuote(symbol);
  };

  const handleRemove = async (id: string) => {
    await db.watchList.delete(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleAdd();
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-4xl mb-3">👀</p>
        <h2 className="text-xl font-semibold text-maintext mb-2">Watchlist</h2>
        <p className="text-sm text-subtext">Set up your profile to start tracking symbols.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-maintext">Watchlist</h1>
        <span className="text-sm text-subtext">{watchList?.length ?? 0} symbols</span>
      </div>

      {/* Add symbol form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add symbol (e.g., VFV.TO, AAPL)"
          className="flex-1 border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={handleAdd}
          disabled={!newSymbol.trim()}
          className="bg-brand text-white px-4 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {/* Watchlist table */}
      {(!watchList || watchList.length === 0) ? (
        <div className="bg-white rounded-card shadow-card p-8 text-center">
          <p className="text-3xl mb-3">👀</p>
          <h3 className="text-base font-semibold text-maintext mb-1">No symbols watched</h3>
          <p className="text-sm text-subtext">
            Add symbols above to track their prices without having them in your portfolio.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider bg-surface">
                <th className="text-left px-4 py-3 font-medium text-subtext">Symbol</th>
                <th className="text-right px-4 py-3 font-medium text-subtext">Price</th>
                <th className="text-right px-4 py-3 font-medium text-subtext">Change</th>
                <th className="text-right px-4 py-3 font-medium text-subtext">Added</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {watchList.map((item) => {
                const q = quotes[item.symbol];
                return (
                  <tr key={item.id} className="border-b border-divider last:border-0 hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-maintext font-mono">{item.symbol}</td>
                    <td className="px-4 py-3 text-right">
                      {q ? (
                        <Money
                          cents={Math.round(q.price * 100)}
                          currency={q.currency}
                          className="font-mono"
                        />
                      ) : (
                        <button
                          onClick={() => fetchQuote(item.symbol)}
                          disabled={fetching === item.symbol}
                          className="text-xs text-brand hover:text-brand-dark"
                        >
                          {fetching === item.symbol ? '...' : 'Fetch'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q ? (
                        <ChangeIndicator value={q.changePercent / 100} />
                      ) : (
                        <span className="text-subtext">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-subtext">
                      {new Date(item.addedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-xs text-subtext hover:text-loss transition-colors"
                        title="Remove from watchlist"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
