// ============================================================
// RiskService — Computes portfolio risk metrics
// Sharpe ratio, annualized volatility, max drawdown
// Per doc types: RiskMetrics interface
// ============================================================

import type { RiskMetrics, Holding, Quote } from '@/types';

const TRADING_DAYS_PER_YEAR = 252;
const RISK_FREE_RATE = 0.04; // ~4% annual (Bank of Canada overnight rate proxy)

/**
 * Compute portfolio risk metrics from holdings + historical snapshots.
 *
 * For Phase 1 we compute simplified metrics from available data:
 * - Volatility: estimated from position-level cost-basis vs. market value variance
 * - Sharpe: (portfolio return - risk-free) / volatility
 * - Max Drawdown: peak-to-trough from snapshot series
 *
 * When price history is available (Phase 2), this will use daily return series.
 */
export function computeRiskMetrics(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  dailyPortfolioValues?: number[]
): RiskMetrics {
  const now = new Date().toISOString();

  // If we have daily portfolio value series, compute from actual returns
  if (dailyPortfolioValues && dailyPortfolioValues.length >= 2) {
    return computeFromDailySeries(dailyPortfolioValues, now);
  }

  // Fallback: estimate from per-position return dispersion (Phase 1 approximation)
  return computeFromPositions(holdings, quotes, now);
}

function computeFromDailySeries(values: number[], calculatedAt: string): RiskMetrics {
  // Compute daily returns
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }

  if (returns.length === 0) {
    return { volatilityAnnualized: 0, sharpeRatio: 0, maxDrawdown: 0, calculatedAt };
  }

  // Annualized volatility = stddev(daily returns) * sqrt(252)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const dailyStdDev = Math.sqrt(variance);
  const volatilityAnnualized = dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Annualized return (geometric)
  const totalReturn = (values[values.length - 1] - values[0]) / values[0];
  const tradingDays = returns.length;
  const annualizedReturn = (1 + totalReturn) ** (TRADING_DAYS_PER_YEAR / tradingDays) - 1;

  // Sharpe ratio
  const sharpeRatio = volatilityAnnualized > 0
    ? (annualizedReturn - RISK_FREE_RATE) / volatilityAnnualized
    : 0;

  // Max drawdown
  const maxDrawdown = computeMaxDrawdown(values);

  return {
    volatilityAnnualized: roundTo(volatilityAnnualized, 4),
    sharpeRatio: roundTo(sharpeRatio, 2),
    maxDrawdown: roundTo(maxDrawdown, 4),
    calculatedAt,
  };
}

function computeFromPositions(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  calculatedAt: string
): RiskMetrics {
  if (holdings.length === 0) {
    return { volatilityAnnualized: 0, sharpeRatio: 0, maxDrawdown: 0, calculatedAt };
  }

  // Per-position returns
  const positionReturns: number[] = [];
  let totalMarketValue = 0;
  let totalCostBasis = 0;

  for (const h of holdings) {
    const quote = quotes[h.symbol];
    const marketCents = quote ? Math.round(quote.price * 100 * h.quantity) : h.totalCostCents;
    totalMarketValue += marketCents;
    totalCostBasis += h.totalCostCents;

    if (h.totalCostCents > 0) {
      positionReturns.push((marketCents - h.totalCostCents) / h.totalCostCents);
    }
  }

  if (positionReturns.length === 0) {
    return { volatilityAnnualized: 0, sharpeRatio: 0, maxDrawdown: 0, calculatedAt };
  }

  // Cross-sectional volatility as a proxy (how dispersed are position returns)
  const meanReturn = positionReturns.reduce((a, b) => a + b, 0) / positionReturns.length;
  const variance = positionReturns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / positionReturns.length;
  const crossSectionalVol = Math.sqrt(variance);

  // Annualize with a simplifying assumption
  const volatilityAnnualized = crossSectionalVol; // already roughly annualized for a single snapshot

  // Portfolio-level return
  const portfolioReturn = totalCostBasis > 0
    ? (totalMarketValue - totalCostBasis) / totalCostBasis
    : 0;

  const sharpeRatio = volatilityAnnualized > 0
    ? (portfolioReturn - RISK_FREE_RATE) / volatilityAnnualized
    : 0;

  // Max drawdown approximation: worst single-position drawdown
  const worstReturn = Math.min(...positionReturns);
  const maxDrawdown = worstReturn < 0 ? worstReturn : 0;

  return {
    volatilityAnnualized: roundTo(volatilityAnnualized, 4),
    sharpeRatio: roundTo(sharpeRatio, 2),
    maxDrawdown: roundTo(maxDrawdown, 4),
    calculatedAt,
  };
}

function computeMaxDrawdown(values: number[]): number {
  let peak = values[0];
  let maxDD = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
    }
    const dd = (values[i] - peak) / peak;
    if (dd < maxDD) {
      maxDD = dd;
    }
  }

  return maxDD;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
