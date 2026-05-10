// ============================================================
// HoldingsPage — Holdings table + "+ Log Transaction" button
// Per doc 04 §6.2
// ============================================================

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useUserStore } from '@/stores/userStore';
import { useHoldingsStore } from '@/stores/holdingsStore';
import { Money } from '@/components/custom/Money';
import { ChangeIndicator } from '@/components/custom/ChangeIndicator';
import { TransactionForm } from './TransactionForm';
import { formatQuantity } from '@/lib/formatters';
import type { Account } from '@/types';

type TabType = 'All' | 'TFSA' | 'RRSP' | 'USD' | 'Crypto';

export function HoldingsPage() {
  const { currentUser } = useUserStore();
  const { holdings, quotes } = useHoldingsStore();
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const accounts = useLiveQuery<Account[]>(
    () => currentUser
      ? db.accounts.where('userId').equals(currentUser.id).filter((a) => !a.deletedAt).toArray()
      : Promise.resolve([] as Account[]),
    [currentUser?.id]
  );

  const accountMap = new Map(accounts?.map((a) => [a.id, a]) ?? []);

  // Filter holdings by tab
  const filteredHoldings = holdings.filter((h) => {
    if (activeTab === 'All') return true;
    const account = accountMap.get(h.accountId);
    if (!account) return false;
    if (activeTab === 'Crypto') return account.type === 'CryptoWallet';
    if (activeTab === 'USD') return account.type === 'USD_NonReg';
    if (activeTab === 'TFSA') return account.type === 'TFSA';
    if (activeTab === 'RRSP') return account.type === 'RRSP' || account.type === 'FHSA';
    return true;
  });

  const totalValue = filteredHoldings.reduce((sum, h) => {
    const quote = quotes[h.symbol];
    return sum + (quote ? Math.round(quote.price * 100 * h.quantity) : h.totalCostCents);
  }, 0);

  const tabs: TabType[] = ['All', 'TFSA', 'RRSP', 'USD', 'Crypto'];

  if (!currentUser) {
    return <div className="text-center py-16 text-subtext">Please set up your profile first.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-maintext">Holdings</h1>
        <button
          onClick={() => setShowTransactionForm(true)}
          className="bg-brand text-white px-4 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          + Log Transaction
        </button>
      </div>

      {/* Transaction form (modal-style inline) */}
      {showTransactionForm && accounts && (
        <div className="bg-white rounded-card shadow-card border border-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-maintext">Log Transaction</h2>
            <button
              onClick={() => setShowTransactionForm(false)}
              className="text-subtext hover:text-maintext text-lg"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <TransactionForm
            accounts={accounts}
            onSuccess={() => setShowTransactionForm(false)}
          />
        </div>
      )}

      {/* Account tabs */}
      <div className="flex gap-1 bg-divider rounded-button p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-button transition-colors ${
              activeTab === tab
                ? 'bg-white text-brand shadow-sm'
                : 'text-subtext hover:text-maintext'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Holdings table */}
      {filteredHoldings.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-8 text-center">
          <p className="text-3xl mb-3">📭</p>
          <h3 className="text-base font-semibold text-maintext mb-1">No holdings in this view</h3>
          <p className="text-sm text-subtext">Log a transaction to see your holdings here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs font-medium text-subtext border-b border-border bg-surface">
            <div className="col-span-2">Symbol / Account</div>
            <div className="text-right">Quantity</div>
            <div className="text-right">Avg Cost</div>
            <div className="text-right">Current</div>
            <div className="text-right">Unrealized P&L</div>
          </div>

          {/* Rows */}
          {filteredHoldings.map((holding) => {
            const quote = quotes[holding.symbol];
            const currentPriceCents = quote ? Math.round(quote.price * 100) : null;
            const marketValueCents = currentPriceCents
              ? Math.round(currentPriceCents * holding.quantity)
              : null;
            const unrealizedCents = marketValueCents != null
              ? marketValueCents - holding.totalCostCents
              : null;
            const unrealizedPct = unrealizedCents != null && holding.totalCostCents > 0
              ? unrealizedCents / holding.totalCostCents
              : null;
            const account = accountMap.get(holding.accountId);

            return (
              <div
                key={holding.id}
                className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-divider last:border-0 hover:bg-surface transition-colors"
              >
                {/* Symbol + account */}
                <div className="col-span-2">
                  <div className={`font-mono font-semibold text-sm ${holding.assetClass === 'crypto' ? 'text-crypto' : 'text-maintext'}`}>
                    {holding.symbol}
                  </div>
                  {account && (
                    <div className="text-xs text-subtext mt-0.5">{account.name} · {account.type}</div>
                  )}
                </div>

                {/* Quantity */}
                <div className="text-right">
                  <span className="font-mono text-sm text-maintext">
                    {formatQuantity(holding.quantity)}
                  </span>
                </div>

                {/* Avg cost */}
                <div className="text-right">
                  <Money cents={holding.avgCostCents} currency={holding.currency} className="text-sm" />
                </div>

                {/* Current price */}
                <div className="text-right">
                  {currentPriceCents != null ? (
                    <Money cents={currentPriceCents} currency={holding.currency} className="text-sm" />
                  ) : (
                    <span className="text-xs text-subtext">—</span>
                  )}
                </div>

                {/* Unrealized P&L */}
                <div className="text-right">
                  {unrealizedCents != null ? (
                    <div>
                      <Money cents={unrealizedCents} currency={holding.currency} showSign colored className="text-sm" />
                      {unrealizedPct != null && (
                        <ChangeIndicator value={unrealizedPct} className="block text-xs" />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-subtext">No quote</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer total */}
          <div className="px-4 py-3 bg-surface border-t border-border flex justify-end items-center gap-2">
            <span className="text-xs text-subtext">Total market value:</span>
            <Money cents={totalValue} currency={currentUser.baseCurrency} className="font-semibold text-sm" />
          </div>
        </div>
      )}

      <p className="text-xs text-subtext text-center">
        Quotes delayed ~15 minutes · Not investment advice
      </p>
    </div>
  );
}
