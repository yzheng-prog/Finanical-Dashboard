// ============================================================
// ACB Engine — CRA-compliant Adjusted Cost Base calculator
// Implements average-cost method per 03_Data_Model_Schema.md §ACB calculation
//
// Rules summary:
//   buy:               totalCost += amount;  qty += q;   avgCost = totalCost / qty
//   sell:              realized = (sellPrice - avgCost) × q
//                      totalCost -= avgCost × q;  qty -= q
//   eligible_dividend / non_eligible_dividend: no ACB change
//   return_of_capital: totalCost -= amount   (qty unchanged)
//                      if totalCost < 0 → recognize gain = |totalCost|; set totalCost = 0
//   drip:              totalCost += amount;  qty += q;   (dividend portion recognized separately)
//   split (ratio R):   qty ×= R;             avgCost /= R  (totalCost unchanged)
//   transfer_in:       totalCost += amount;  qty += q
//   transfer_out:      totalCost -= avgCost × q;  qty -= q  (proportional)
//   fee / interest:    no effect on ACB/qty
//   conversion:        no effect on ACB of any held symbol
// ============================================================

import type { Transaction, ACBState } from '@/types';

export interface ACBRunResult {
  state: ACBState;
  /** Capital gain/loss recognized on each sell or ROC-negative event */
  events: ACBEvent[];
}

export interface ACBEvent {
  transactionId: string;
  type: 'capital_gain' | 'capital_loss' | 'roc_negative_gain';
  gainCents: number;     // positive = gain, negative = loss
  executedAt: string;
}

/**
 * Compute ACB state by replaying a list of transactions in chronological order.
 * Transactions MUST be sorted by executedAt ascending before calling this function.
 *
 * @param transactions - Pre-sorted, non-deleted transactions for one (accountId, symbol)
 * @param initialState - Optional starting state (from a HoldingsSnapshot)
 * @returns Final ACBState and list of taxable events
 */
export function computeACB(
  transactions: Transaction[],
  initialState?: Partial<ACBState>
): ACBRunResult {
  const state: ACBState = {
    symbol: transactions[0]?.symbol ?? initialState?.symbol ?? '',
    accountId: transactions[0]?.accountId ?? initialState?.accountId ?? '',
    quantity: initialState?.quantity ?? 0,
    totalCostCents: initialState?.totalCostCents ?? 0,
    avgCostCents: initialState?.avgCostCents ?? 0,
    cumulativeRocCents: initialState?.cumulativeRocCents ?? 0,
    realizedGainCents: initialState?.realizedGainCents ?? 0,
  };

  const events: ACBEvent[] = [];

  for (const txn of transactions) {
    switch (txn.type) {
      case 'buy':
      case 'transfer_in': {
        state.totalCostCents += txn.totalAmountCents + txn.feeCents;
        state.quantity += txn.quantity;
        state.avgCostCents = state.quantity > 0
          ? Math.round(state.totalCostCents / state.quantity)
          : 0;
        break;
      }

      case 'sell': {
        if (state.quantity <= 0) break; // nothing to sell (guard)
        const costOfSoldShares = Math.round(state.avgCostCents * txn.quantity);
        const proceeds = txn.totalAmountCents - txn.feeCents;
        const gainCents = proceeds - costOfSoldShares;

        state.totalCostCents -= costOfSoldShares;
        state.quantity -= txn.quantity;
        state.avgCostCents = state.quantity > 0
          ? Math.round(state.totalCostCents / state.quantity)
          : 0;
        state.realizedGainCents += gainCents;

        events.push({
          transactionId: txn.id,
          type: gainCents >= 0 ? 'capital_gain' : 'capital_loss',
          gainCents,
          executedAt: txn.executedAt,
        });
        break;
      }

      case 'transfer_out': {
        if (state.quantity <= 0) break;
        const costOfTransferred = Math.round(state.avgCostCents * txn.quantity);
        state.totalCostCents -= costOfTransferred;
        state.quantity -= txn.quantity;
        state.avgCostCents = state.quantity > 0
          ? Math.round(state.totalCostCents / state.quantity)
          : 0;
        break;
      }

      case 'return_of_capital': {
        state.totalCostCents -= txn.totalAmountCents;
        state.cumulativeRocCents += txn.totalAmountCents;

        // If ACB goes negative, CRA requires recognizing the excess as a capital gain
        if (state.totalCostCents < 0) {
          const gainCents = Math.abs(state.totalCostCents);
          state.realizedGainCents += gainCents;
          events.push({
            transactionId: txn.id,
            type: 'roc_negative_gain',
            gainCents,
            executedAt: txn.executedAt,
          });
          state.totalCostCents = 0;
        }

        state.avgCostCents = state.quantity > 0
          ? Math.round(state.totalCostCents / state.quantity)
          : 0;
        break;
      }

      case 'drip': {
        // DRIP: dividend is taxable income; simultaneously reinvested shares increase ACB
        state.totalCostCents += txn.totalAmountCents;
        state.quantity += txn.quantity;
        state.avgCostCents = state.quantity > 0
          ? Math.round(state.totalCostCents / state.quantity)
          : 0;
        break;
      }

      case 'split': {
        // e.g. 2:1 split → ratio = 2, qty doubles, avgCost halves, totalCost unchanged
        const ratio = txn.splitRatio ?? 1;
        if (ratio <= 0) break;
        state.quantity = Math.round(state.quantity * ratio);
        state.avgCostCents = state.quantity > 0
          ? Math.round(state.totalCostCents / state.quantity)
          : 0;
        break;
      }

      case 'eligible_dividend':
      case 'non_eligible_dividend':
      case 'dividend':     // generic — no ACB impact
      case 'fee':
      case 'interest':
      case 'conversion':   // FX conversions don't affect the symbol's ACB
        break;

      default:
        // Future transaction types — safe to ignore
        break;
    }
  }

  // Final sanity: if qty rounds to near-zero due to float ops, clamp to 0
  if (Math.abs(state.quantity) < 1e-8) {
    state.quantity = 0;
    state.totalCostCents = 0;
    state.avgCostCents = 0;
  }

  return { state, events };
}

/**
 * Incremental update: apply a single new transaction to an existing ACBState.
 * Use this after each transaction CUD to avoid full replay.
 */
export function applyTransaction(
  state: ACBState,
  txn: Transaction
): ACBRunResult {
  return computeACB([txn], state);
}

/**
 * Calculate unrealized P&L given a current market price.
 */
export function computeUnrealizedPnL(
  state: ACBState,
  currentPriceCents: number
): number {
  return Math.round(currentPriceCents * state.quantity) - state.totalCostCents;
}
