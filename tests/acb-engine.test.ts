// ============================================================
// ACB Engine Tests — CRA-compliant Adjusted Cost Base calculations
// Covers all 12 transaction types + edge cases + mixed scenarios
// Acceptance criterion: 20+ tests, all pass (doc 05 Phase 1 criteria)
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeACB, computeUnrealizedPnL } from '../src/services/ACBEngine';
import type { Transaction } from '../src/types';

// ─── Helpers ─────────────────────────────────────────────────

let seq = 0;
function txn(
  overrides: Partial<Transaction> & { type: Transaction['type']; quantity: number }
): Transaction {
  const id = `txn-${++seq}`;
  return {
    id,
    accountId: 'acc-1',
    symbol: 'TST',
    pricePerUnitCents: 0,
    totalAmountCents: 0,
    feeCents: 0,
    currency: 'CAD',
    executedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as Transaction;
}

// ─── Group 1: Basic Buy / Sell ────────────────────────────────

describe('ACBEngine — Buy / Sell', () => {
  it('TC-01: single buy sets correct quantity and avgCost', () => {
    const txns = [txn({ type: 'buy', quantity: 100, totalAmountCents: 15000_00, feeCents: 9_99 })];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(100);
    expect(state.totalCostCents).toBe(15009_99); // includes fee
    expect(state.avgCostCents).toBe(Math.round(15009_99 / 100));
  });

  it('TC-02: two buys — weighted average cost', () => {
    const txns = [
      txn({ type: 'buy', quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'buy', quantity: 50,  totalAmountCents:  7500_00, feeCents: 0, executedAt: '2024-02-01T00:00:00.000Z' }),
    ];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(150);
    expect(state.totalCostCents).toBe(17500_00);
    expect(state.avgCostCents).toBe(Math.round(17500_00 / 150)); // ~$116.67 = 11667 cents
  });

  it('TC-03: sell reduces quantity and totalCost by avgCost × sold qty', () => {
    const txns = [
      txn({ type: 'buy',  quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'sell', quantity:  40, totalAmountCents:  4800_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.quantity).toBe(60);
    // sold 40 @ avgCost 100.00 = 4000.00 cost basis; proceeds 4800.00 → gain 800.00
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('capital_gain');
    expect(events[0].gainCents).toBe(80000); // $800.00
    expect(state.totalCostCents).toBe(6000_00); // 60 × $100
  });

  it('TC-04: sell at a loss produces capital_loss event', () => {
    const txns = [
      txn({ type: 'buy',  quantity: 100, totalAmountCents: 20000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'sell', quantity:  50, totalAmountCents:  8000_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { events } = computeACB(txns);
    // sold 50 @ $200 avg; proceeds = $80 → loss = 80 - 10000 = -$20 per share × 50 = -$1000
    // buy: 100 @ $200/share avg (20000_00 total / 100 = 200.00)
    // sell 50: costBasis = 50 × $200 = 10000_00; proceeds = 8000_00; gain = -2000_00
    expect(events[0].type).toBe('capital_loss');
    expect(events[0].gainCents).toBe(-2000_00);
  });

  it('TC-05: sell all shares leaves zero quantity and zero cost', () => {
    const txns = [
      txn({ type: 'buy',  quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'sell', quantity: 100, totalAmountCents: 12000_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(0);
    expect(state.totalCostCents).toBe(0);
  });

  it('TC-06: sell with commission reduces proceeds (not ACB)', () => {
    const txns = [
      txn({ type: 'buy',  quantity: 100, totalAmountCents: 10000_00, feeCents:    0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'sell', quantity:  50, totalAmountCents:  6000_00, feeCents: 9_99, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { events } = computeACB(txns);
    // avg = $100; sold 50: costBasis = 5000_00; proceeds = 6000_00 - 9_99 = 5990_01
    expect(events[0].gainCents).toBe(5990_01 - 5000_00); // 990_01
  });
});

// ─── Group 2: Dividends ───────────────────────────────────────

describe('ACBEngine — Dividends', () => {
  it('TC-07: eligible_dividend does not change ACB or quantity', () => {
    const txns = [
      txn({ type: 'buy',              quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'eligible_dividend',quantity:   0, totalAmountCents:    200_00, feeCents: 0, executedAt: '2024-03-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.quantity).toBe(100);
    expect(state.totalCostCents).toBe(10000_00);
    expect(state.avgCostCents).toBe(100_00);
    expect(events).toHaveLength(0); // no capital gain event
  });

  it('TC-08: non_eligible_dividend and generic dividend also do not change ACB', () => {
    const txns = [
      txn({ type: 'buy',                  quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'non_eligible_dividend', quantity:   0, totalAmountCents:    100_00, feeCents: 0, executedAt: '2024-03-01T00:00:00.000Z' }),
      txn({ type: 'dividend',              quantity:   0, totalAmountCents:     50_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state } = computeACB(txns);
    expect(state.totalCostCents).toBe(10000_00);
    expect(state.quantity).toBe(100);
  });
});

// ─── Group 3: Return of Capital ──────────────────────────────

describe('ACBEngine — Return of Capital (ROC)', () => {
  it('TC-09: ROC reduces ACB without reducing quantity', () => {
    const txns = [
      txn({ type: 'buy',              quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents:   500_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.quantity).toBe(100);
    expect(state.totalCostCents).toBe(9500_00);    // 10000 - 500
    expect(state.avgCostCents).toBe(95_00);         // 9500 / 100
    expect(events).toHaveLength(0);                 // no gain until ACB < 0
    expect(state.cumulativeRocCents).toBe(500_00);
  });

  it('TC-10: ROC reducing ACB to exactly zero triggers no gain event', () => {
    const txns = [
      txn({ type: 'buy',               quantity: 100, totalAmountCents: 500_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents: 500_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.totalCostCents).toBe(0);
    expect(events).toHaveLength(0); // exactly zero: no gain recognized
  });

  it('TC-11: ROC exceeding ACB triggers roc_negative_gain event for the excess', () => {
    const txns = [
      txn({ type: 'buy',               quantity: 100, totalAmountCents:  800_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents: 1000_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.totalCostCents).toBe(0);          // clamped to 0
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('roc_negative_gain');
    expect(events[0].gainCents).toBe(200_00);      // excess = 1000 - 800
  });

  it('TC-12: multiple ROC payments accumulate correctly', () => {
    const txns = [
      txn({ type: 'buy',               quantity: 100, totalAmountCents: 5000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents: 1000_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents: 2000_00, feeCents: 0, executedAt: '2024-12-01T00:00:00.000Z' }),
    ];
    const { state } = computeACB(txns);
    expect(state.totalCostCents).toBe(2000_00);
    expect(state.cumulativeRocCents).toBe(3000_00);
    expect(state.avgCostCents).toBe(20_00); // 2000 / 100
  });
});

// ─── Group 4: DRIP ───────────────────────────────────────────

describe('ACBEngine — DRIP (Dividend Reinvestment Plan)', () => {
  it('TC-13: DRIP increases both quantity and ACB', () => {
    const txns = [
      txn({ type: 'buy',  quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'drip', quantity:   5, totalAmountCents:   500_00, feeCents: 0, executedAt: '2024-03-01T00:00:00.000Z' }),
    ];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(105);
    expect(state.totalCostCents).toBe(10500_00);
    expect(state.avgCostCents).toBe(Math.round(10500_00 / 105)); // ~$100.00
  });
});

// ─── Group 5: Stock Split ─────────────────────────────────────

describe('ACBEngine — Stock Splits', () => {
  it('TC-14: 2:1 split doubles quantity and halves avgCost; totalCost unchanged', () => {
    const txns = [
      txn({ type: 'buy',   quantity: 100, totalAmountCents: 20000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'split', quantity: 100, totalAmountCents:       0, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z', splitRatio: 2 }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.quantity).toBe(200);
    expect(state.totalCostCents).toBe(20000_00);
    expect(state.avgCostCents).toBe(100_00); // 20000 / 200
    expect(events).toHaveLength(0); // no taxable event
  });

  it('TC-15: 3:2 split multiplies quantity by 1.5', () => {
    const txns = [
      txn({ type: 'buy',   quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'split', quantity: 100, totalAmountCents:       0, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z', splitRatio: 1.5 }),
    ];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(150);
    expect(state.totalCostCents).toBe(10000_00);
    expect(state.avgCostCents).toBe(Math.round(10000_00 / 150));
  });
});

// ─── Group 6: Transfer ───────────────────────────────────────

describe('ACBEngine — Transfers', () => {
  it('TC-16: transfer_in increases quantity and ACB', () => {
    const txns = [
      txn({ type: 'transfer_in', quantity: 50, totalAmountCents: 5000_00, feeCents: 0 }),
    ];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(50);
    expect(state.totalCostCents).toBe(5000_00);
  });

  it('TC-17: transfer_out reduces proportionally (like a sell but no taxable event)', () => {
    const txns = [
      txn({ type: 'buy',          quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'transfer_out', quantity:  30, totalAmountCents:  3000_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.quantity).toBe(70);
    expect(state.totalCostCents).toBe(7000_00);
    expect(events).toHaveLength(0); // no capital gain event on internal transfer
  });
});

// ─── Group 7: Conversion ─────────────────────────────────────

describe('ACBEngine — Currency Conversion (Norbert\'s Gambit)', () => {
  it('TC-18: conversion does not affect ACB of any symbol', () => {
    const txns = [
      txn({ type: 'buy',        quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'conversion', quantity:   0, totalAmountCents:      0,  feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z',
            conversionFromCurrency: 'CAD', conversionToCurrency: 'USD',
            conversionFromAmountCents: 500_00, conversionToAmountCents: 370_00 }),
    ];
    const { state, events } = computeACB(txns);
    expect(state.quantity).toBe(100);
    expect(state.totalCostCents).toBe(10000_00);
    expect(events).toHaveLength(0);
  });
});

// ─── Group 8: Fee / Interest ─────────────────────────────────

describe('ACBEngine — Fees and Interest', () => {
  it('TC-19: fee and interest do not change ACB or quantity', () => {
    const txns = [
      txn({ type: 'buy',      quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'fee',      quantity:   0, totalAmountCents:    50_00, feeCents: 0, executedAt: '2024-03-01T00:00:00.000Z' }),
      txn({ type: 'interest', quantity:   0, totalAmountCents:    20_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];
    const { state } = computeACB(txns);
    expect(state.quantity).toBe(100);
    expect(state.totalCostCents).toBe(10000_00);
  });
});

// ─── Group 9: Mixed Realistic Scenarios ──────────────────────

describe('ACBEngine — Mixed Realistic Scenarios', () => {
  it('TC-20: 2-year ETF portfolio: buy → DRIP × 3 → ROC × 2 → sell half → split', () => {
    const txns = [
      // Jan 2023: buy 200 shares @ $50.00 = $10,000
      txn({ type: 'buy',               quantity: 200, totalAmountCents: 1000000, feeCents: 999, executedAt: '2023-01-15T00:00:00.000Z' }),
      // Mar 2023: DRIP — 2 shares @ $51.00 = $102.00
      txn({ type: 'drip',              quantity:   2, totalAmountCents:   10200, feeCents:   0, executedAt: '2023-03-15T00:00:00.000Z' }),
      // Jun 2023: ROC $3.00 per share × 202 = $606 — does NOT happen per-share in reality, simplified to total
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents:   60600, feeCents:   0, executedAt: '2023-06-15T00:00:00.000Z' }),
      // Sep 2023: DRIP — 2 shares @ $52.00 = $104.00
      txn({ type: 'drip',              quantity:   2, totalAmountCents:   10400, feeCents:   0, executedAt: '2023-09-15T00:00:00.000Z' }),
      // Dec 2023: ROC $2.00 per share × 204 = $408
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents:   40800, feeCents:   0, executedAt: '2023-12-15T00:00:00.000Z' }),
      // Feb 2024: sell 100 shares @ $55.00 = $5,500
      txn({ type: 'sell',              quantity: 100, totalAmountCents:  550000, feeCents: 999, executedAt: '2024-02-15T00:00:00.000Z' }),
      // Apr 2024: 2:1 split
      txn({ type: 'split',             quantity:   0, totalAmountCents:       0, feeCents:   0, executedAt: '2024-04-15T00:00:00.000Z', splitRatio: 2 }),
    ];

    const { state, events } = computeACB(txns);

    // After all operations: start 200 + drip 2 + drip 2 = 204; sell 100 → 104; split 2:1 → 208
    expect(state.quantity).toBe(208);
    // Should have exactly 1 capital gain event (the sell in Feb 2024)
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('capital_gain');
    // Verify no negative quantities at any point
    expect(state.quantity).toBeGreaterThan(0);
  });

  it('TC-21: initial state from snapshot + delta replay gives same result as full replay', () => {
    const allTxns = [
      txn({ type: 'buy',  quantity: 100, totalAmountCents: 10000_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      txn({ type: 'buy',  quantity:  50, totalAmountCents:  6000_00, feeCents: 0, executedAt: '2024-03-01T00:00:00.000Z' }),
      txn({ type: 'sell', quantity:  30, totalAmountCents:  3600_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
    ];

    // Full replay
    const { state: full } = computeACB(allTxns);

    // Simulate a snapshot at end of March (after first two buys)
    const { state: snapState } = computeACB(allTxns.slice(0, 2));

    // Delta replay from the snapshot
    const { state: delta } = computeACB(allTxns.slice(2), {
      quantity: snapState.quantity,
      totalCostCents: snapState.totalCostCents,
      avgCostCents: snapState.avgCostCents,
      cumulativeRocCents: snapState.cumulativeRocCents,
    });

    expect(delta.quantity).toBe(full.quantity);
    expect(delta.totalCostCents).toBe(full.totalCostCents);
    expect(delta.avgCostCents).toBe(full.avgCostCents);
  });

  it('TC-22: buy with fee included in totalAmountCents ACB', () => {
    // Commission is added to the ACB of the purchase per CRA
    const txns = [
      txn({ type: 'buy', quantity: 100, totalAmountCents: 10000_00, feeCents: 9_99 }),
    ];
    const { state } = computeACB(txns);
    expect(state.totalCostCents).toBe(10009_99); // purchase + commission
    expect(state.avgCostCents).toBe(Math.round(10009_99 / 100));
  });

  it('TC-23: computeUnrealizedPnL works correctly', () => {
    const txns = [
      txn({ type: 'buy', quantity: 100, totalAmountCents: 10000_00, feeCents: 0 }),
    ];
    const { state } = computeACB(txns);
    // If current price is $120/share = 12000 cents
    const unrealized = computeUnrealizedPnL(state, 12000);
    expect(unrealized).toBe(200000); // 120×100 - 100×100 = $2000 = 200000 cents
  });

  it('TC-24: empty transaction list returns zeroed state', () => {
    const { state, events } = computeACB([], { symbol: 'TST', accountId: 'acc-1' });
    expect(state.quantity).toBe(0);
    expect(state.totalCostCents).toBe(0);
    expect(state.avgCostCents).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('TC-25: ROC → negative → gain recognized → subsequent sell still uses zero ACB', () => {
    const txns = [
      txn({ type: 'buy',               quantity: 100, totalAmountCents:  100_00, feeCents: 0, executedAt: '2024-01-01T00:00:00.000Z' }),
      // ROC of $2.00 > ACB of $1.00 → $1.00 gain recognized; ACB = 0
      txn({ type: 'return_of_capital', quantity:   0, totalAmountCents:  200_00, feeCents: 0, executedAt: '2024-06-01T00:00:00.000Z' }),
      // Subsequent sell: ACB is now 0, so ALL proceeds are gain
      txn({ type: 'sell',              quantity: 100, totalAmountCents: 5000_00, feeCents: 0, executedAt: '2024-09-01T00:00:00.000Z' }),
    ];
    const { state, events } = computeACB(txns);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('roc_negative_gain');
    expect(events[0].gainCents).toBe(100_00); // excess: 200 - 100 = 100 cents
    expect(events[1].type).toBe('capital_gain');
    expect(events[1].gainCents).toBe(5000_00); // ACB is 0, so 100% is gain
    expect(state.quantity).toBe(0);
  });
});
