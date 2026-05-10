// ============================================================
// RiskService Tests — Sharpe ratio, volatility, max drawdown
// Pure functions, no mocking needed
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeRiskMetrics } from '../src/services/RiskService';
import type { Holding, Quote } from '../src/types';

// ─── Helpers ─────────────────────────────────────────────────

function holding(overrides: Partial<Holding> & { symbol: string; quantity: number; totalCostCents: number }): Holding {
  return {
    id: `h-${overrides.symbol}`,
    accountId: 'acc-1',
    avgCostCents: Math.round(overrides.totalCostCents / overrides.quantity),
    currency: 'CAD',
    assetClass: 'equity',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function quote(symbol: string, price: number): Quote {
  return {
    symbol,
    price,
    change: 0,
    changePercent: 0,
    timestamp: new Date().toISOString(),
    currency: 'CAD',
  };
}

// ─── Group 1: Empty / Edge Cases ─────────────────────────────

describe('RiskService — Edge Cases', () => {
  it('RS-01: empty holdings returns zero metrics', () => {
    const result = computeRiskMetrics([], {});
    expect(result.volatilityAnnualized).toBe(0);
    expect(result.sharpeRatio).toBe(0);
    expect(result.maxDrawdown).toBe(0);
    expect(result.calculatedAt).toBeTruthy();
  });

  it('RS-02: single holding with no quote uses cost basis (zero vol)', () => {
    const holdings = [holding({ symbol: 'VFV.TO', quantity: 100, totalCostCents: 500000 })];
    const result = computeRiskMetrics(holdings, {});
    // Single position, market = cost => 0 return, 0 dispersion
    expect(result.volatilityAnnualized).toBe(0);
    expect(result.maxDrawdown).toBe(0);
  });

  it('RS-03: single holding with quote but no dispersion => zero vol', () => {
    const holdings = [holding({ symbol: 'VFV.TO', quantity: 100, totalCostCents: 500000 })];
    const quotes = { 'VFV.TO': quote('VFV.TO', 50) }; // same as cost
    const result = computeRiskMetrics(holdings, quotes);
    expect(result.volatilityAnnualized).toBe(0);
  });
});

// ─── Group 2: Position-Based Metrics ─────────────────────────

describe('RiskService — Position-Based Estimates', () => {
  it('RS-04: two positions with different returns produce nonzero volatility', () => {
    const holdings = [
      holding({ symbol: 'VFV.TO', quantity: 100, totalCostCents: 500000 }),
      holding({ symbol: 'XIC.TO', quantity: 200, totalCostCents: 600000 }),
    ];
    const quotes = {
      'VFV.TO': quote('VFV.TO', 60),  // +20% return
      'XIC.TO': quote('XIC.TO', 25),  // -16.7% return
    };
    const result = computeRiskMetrics(holdings, quotes);
    expect(result.volatilityAnnualized).toBeGreaterThan(0);
  });

  it('RS-05: all positions up → positive Sharpe (when return > risk-free)', () => {
    const holdings = [
      holding({ symbol: 'VFV.TO', quantity: 100, totalCostCents: 400000 }),
      holding({ symbol: 'XIC.TO', quantity: 100, totalCostCents: 400000 }),
    ];
    const quotes = {
      'VFV.TO': quote('VFV.TO', 52),  // +30%
      'XIC.TO': quote('XIC.TO', 48),  // +20%
    };
    const result = computeRiskMetrics(holdings, quotes);
    // Portfolio return ~25%, risk-free 4%, positive Sharpe
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  it('RS-06: max drawdown reflects worst single position loss', () => {
    const holdings = [
      holding({ symbol: 'VFV.TO', quantity: 100, totalCostCents: 500000 }),
      holding({ symbol: 'BAD.TO', quantity: 50, totalCostCents: 300000 }),
    ];
    const quotes = {
      'VFV.TO': quote('VFV.TO', 55),   // +10%
      'BAD.TO': quote('BAD.TO', 40),    // -33.3%
    };
    const result = computeRiskMetrics(holdings, quotes);
    expect(result.maxDrawdown).toBeLessThan(0);
    // BAD.TO lost ~33%
    expect(result.maxDrawdown).toBeCloseTo(-0.3333, 1);
  });

  it('RS-07: all positions at or above cost → maxDrawdown is 0', () => {
    const holdings = [
      holding({ symbol: 'A', quantity: 10, totalCostCents: 100000 }),
      holding({ symbol: 'B', quantity: 20, totalCostCents: 200000 }),
    ];
    const quotes = {
      'A': quote('A', 100),   // same
      'B': quote('B', 110),   // +10%
    };
    const result = computeRiskMetrics(holdings, quotes);
    expect(result.maxDrawdown).toBe(0);
  });
});

// ─── Group 3: Daily Series Metrics ───────────────────────────

describe('RiskService — Daily Series', () => {
  it('RS-08: flat daily values → zero volatility', () => {
    const values = [10000, 10000, 10000, 10000, 10000];
    const result = computeRiskMetrics([], {}, values);
    expect(result.volatilityAnnualized).toBe(0);
    expect(result.sharpeRatio).toBe(0);
    expect(result.maxDrawdown).toBe(0);
  });

  it('RS-09: steadily increasing values → positive return, zero drawdown', () => {
    const values = [10000, 10100, 10200, 10300, 10400, 10500];
    const result = computeRiskMetrics([], {}, values);
    expect(result.sharpeRatio).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBe(0);
  });

  it('RS-10: values with dip → negative drawdown', () => {
    const values = [10000, 10500, 9000, 9500, 10200];
    const result = computeRiskMetrics([], {}, values);
    // Peak was 10500, trough was 9000 → drawdown ~-14.3%
    expect(result.maxDrawdown).toBeCloseTo(-0.1429, 2);
  });

  it('RS-11: single value pair computes correctly', () => {
    const values = [10000, 11000]; // +10%
    const result = computeRiskMetrics([], {}, values);
    expect(result.volatilityAnnualized).toBe(0); // only 1 return, zero variance
    expect(result.maxDrawdown).toBe(0);
  });

  it('RS-12: volatile series has higher vol than stable series', () => {
    const stable = [10000, 10010, 10020, 10030, 10040, 10050];
    const volatile = [10000, 11000, 9000, 12000, 8000, 10500];
    const stableResult = computeRiskMetrics([], {}, stable);
    const volatileResult = computeRiskMetrics([], {}, volatile);
    expect(volatileResult.volatilityAnnualized).toBeGreaterThan(stableResult.volatilityAnnualized);
  });

  it('RS-13: max drawdown with multiple dips picks the deepest', () => {
    // Peak 100 → dip to 90 (-10%), recover to 105 → dip to 80 (-23.8%)
    const values = [100, 105, 95, 90, 100, 105, 85, 80, 95];
    const result = computeRiskMetrics([], {}, values);
    // Deepest: peak 105 → trough 80 = -23.8%
    expect(result.maxDrawdown).toBeCloseTo(-0.2381, 2);
  });
});
