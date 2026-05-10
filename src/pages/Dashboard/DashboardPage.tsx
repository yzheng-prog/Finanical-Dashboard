// ============================================================
// DashboardPage — Total net worth, goal progress, today's P&L
// Per doc 04 §6.1
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useUserStore } from '@/stores/userStore';
import { useHoldingsStore } from '@/stores/holdingsStore';
import type { Goal, RiskMetrics } from '@/types';
import { MetricCard } from '@/components/custom/MetricCard';
import { Money } from '@/components/custom/Money';
import { ChangeIndicator } from '@/components/custom/ChangeIndicator';
import { formatDate, formatPercent } from '@/lib/formatters';
import { computeRiskMetrics } from '@/services/RiskService';
import { BackupReminder } from '@/components/custom/BackupReminder';

export function DashboardPage() {
  const { currentUser } = useUserStore();
  const { getTotalCostBasisCents, getTotalMarketValueCents, holdings, quotes } = useHoldingsStore();
  const [loading, setLoading] = useState(true);

  // Live queries for goals
  const goals = useLiveQuery<Goal[]>(
    () => currentUser
      ? db.goals.where('userId').equals(currentUser.id).filter((g) => !g.deletedAt).toArray()
      : Promise.resolve([] as Goal[]),
    [currentUser?.id]
  );

  useEffect(() => {
    // Simulate initial load — in production this loads from IndexedDB
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Compute risk metrics from current holdings + quotes
  const riskMetrics: RiskMetrics | null = useMemo(() => {
    if (holdings.length === 0) return null;
    return computeRiskMetrics(holdings, quotes);
  }, [holdings, quotes]);

  const totalMarketValue = getTotalMarketValueCents();
  const totalCostBasis = getTotalCostBasisCents();
  const totalUnrealized = totalMarketValue - totalCostBasis;
  const unrealizedPct = totalCostBasis > 0 ? totalUnrealized / totalCostBasis : 0;

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-4xl mb-4">📈</p>
        <h2 className="text-xl font-semibold text-maintext mb-2">Welcome to InvestCA</h2>
        <p className="text-sm text-subtext mb-6">Set up your profile to get started.</p>
        <a
          href="/profile"
          className="bg-brand text-white px-6 py-2.5 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          Set Up Profile →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-maintext">
          Good to see you, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-subtext">{formatDate(new Date().toISOString())}</p>
      </div>

      {/* Backup reminder */}
      <BackupReminder />

      {/* Net worth metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          loading={loading}
          title="Total Portfolio Value"
          value={<Money cents={totalMarketValue} currency={currentUser.baseCurrency} className="text-3xl font-bold" />}
          subtext="Market value (quotes 15-min delayed)"
        />
        <MetricCard
          loading={loading}
          title="Total Cost Basis"
          value={<Money cents={totalCostBasis} currency={currentUser.baseCurrency} />}
          subtext="Your total invested amount"
        />
        <MetricCard
          loading={loading}
          title="Unrealized P&L"
          value={<Money cents={totalUnrealized} currency={currentUser.baseCurrency} showSign colored />}
          delta={unrealizedPct !== 0 && <ChangeIndicator value={unrealizedPct} />}
          subtext="Across all accounts"
        />
      </div>

      {/* Goal progress */}
      {goals && goals.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-maintext mb-3">Goal Progress</h2>
          <div className="space-y-3">
            {goals.map((goal) => {
              // For now, show progress as cost basis / target (will improve when linked to accounts)
              const progressPct = Math.min(
                (totalCostBasis / goal.targetAmountCents) * 100,
                100
              );
              return (
                <div key={goal.id} className="bg-white rounded-card shadow-card p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-maintext">{goal.name}</span>
                    <span className="text-xs text-subtext">Target: {formatDate(goal.targetDate)}</span>
                  </div>
                  <div className="w-full bg-divider rounded-full h-2 mb-1">
                    <div
                      className="bg-brand h-2 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-subtext">
                    <span>{progressPct.toFixed(0)}% of target</span>
                    <Money cents={goal.targetAmountCents} currency={currentUser.baseCurrency} className="text-xs" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when no holdings */}
      {holdings.length === 0 && !loading && (
        <div className="bg-white rounded-card shadow-card p-8 text-center">
          <p className="text-3xl mb-3">📊</p>
          <h3 className="text-base font-semibold text-maintext mb-1">No holdings yet</h3>
          <p className="text-sm text-subtext mb-4">
            Log your first transaction to see your portfolio here.
          </p>
          <a
            href="/holdings"
            className="inline-block bg-brand text-white px-5 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            Log a Transaction →
          </a>
        </div>
      )}

      {/* Risk metrics card */}
      {holdings.length > 0 && !loading && riskMetrics && (
        <div className="bg-white rounded-card shadow-card p-4">
          <h2 className="text-sm font-semibold text-maintext mb-3">
            Portfolio Risk Summary
            <span className="text-xs font-normal text-subtext ml-2">(position-based estimate)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-subtext mb-1">Positions</p>
              <p className="font-semibold text-maintext">{holdings.length}</p>
            </div>
            <div>
              <p className="text-xs text-subtext mb-1">Symbols</p>
              <p className="font-semibold text-maintext">
                {new Set(holdings.map((h) => h.symbol)).size}
              </p>
            </div>
            <div>
              <p className="text-xs text-subtext mb-1">Ann. Volatility</p>
              <p className="font-semibold text-maintext font-mono">
                {formatPercent(riskMetrics.volatilityAnnualized)}
              </p>
            </div>
            <div>
              <p className="text-xs text-subtext mb-1">Sharpe Ratio</p>
              <p className={`font-semibold font-mono ${
                riskMetrics.sharpeRatio >= 1 ? 'text-gain' :
                riskMetrics.sharpeRatio >= 0 ? 'text-maintext' : 'text-loss'
              }`}>
                {riskMetrics.sharpeRatio.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-subtext mb-1">Max Drawdown</p>
              <p className={`font-semibold font-mono ${riskMetrics.maxDrawdown < 0 ? 'text-loss' : 'text-maintext'}`}>
                {formatPercent(riskMetrics.maxDrawdown)}
              </p>
            </div>
          </div>
          <p className="text-xs text-subtext mt-3 text-center">
            Risk-free rate: 4% · Will use daily price history when available
          </p>
        </div>
      )}
    </div>
  );
}
