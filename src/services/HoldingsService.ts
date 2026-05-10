// ============================================================
// HoldingsService — Compute and persist Holdings from Transactions + Snapshots
// Implements doc 02 §3.4 Holdings Snapshot Mechanism
// ============================================================

import { format, startOfMonth, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Holding, Transaction, ACBState } from '@/types';
import type {
  ITransactionRepository,
  IHoldingRepository,
  ISnapshotRepository,
} from '@/repositories/interfaces';
import { computeACB } from './ACBEngine';

export class HoldingsService {
  private txnRepo: ITransactionRepository;
  private holdingRepo: IHoldingRepository;
  private snapshotRepo: ISnapshotRepository;

  constructor(
    txnRepo: ITransactionRepository,
    holdingRepo: IHoldingRepository,
    snapshotRepo: ISnapshotRepository
  ) {
    this.txnRepo = txnRepo;
    this.holdingRepo = holdingRepo;
    this.snapshotRepo = snapshotRepo;
  }

  /**
   * Recompute a single (accountId, symbol) holding using the snapshot + delta approach.
   * Current Holding = latest snapshot for prior month + replay of current-month txns.
   *
   * @param accountId
   * @param symbol
   * @param assetClass - Caller provides; not stored in transactions
   */
  async computeHolding(
    accountId: string,
    symbol: string,
    assetClass: Holding['assetClass'] = 'stock'
  ): Promise<Holding | null> {
    // 1. Find latest snapshot (prior months)
    const snapshot = await this.snapshotRepo.getLatest(accountId, symbol);

    // 2. Fetch transactions since the snapshot
    const sinceDate = snapshot
      ? `${snapshot.yearMonth}-01` // first day of snapshot month
      : '1900-01-01';               // no snapshot → replay all history

    const allTxns = await this.txnRepo.getByAccountSymbol(accountId, symbol);
    const deltaTxns = allTxns.filter((t) => t.executedAt >= sinceDate);

    // 3. Build initial state from snapshot (if any)
    const initialState: Partial<ACBState> = snapshot
      ? {
          symbol,
          accountId,
          quantity: snapshot.endOfMonthQuantity,
          totalCostCents: snapshot.endOfMonthTotalCostCents,
          avgCostCents: snapshot.endOfMonthAvgCostCents,
          cumulativeRocCents: snapshot.cumulativeRocCents,
          realizedGainCents: 0, // not tracked in snapshot — cumulative tracking TBD
        }
      : {};

    // 4. Replay delta transactions
    if (deltaTxns.length === 0 && !snapshot) return null;

    const { state } = computeACB(deltaTxns, initialState);

    if (state.quantity === 0) return null; // fully sold/transferred out

    // 5. Build Holding record
    const existing = await this.holdingRepo.getByAccountSymbol(accountId, symbol);
    const holding: Holding = {
      id: existing?.id ?? uuidv4(),
      accountId,
      symbol,
      quantity: state.quantity,
      avgCostCents: state.avgCostCents,
      totalCostCents: state.totalCostCents,
      currency: deltaTxns[0]?.currency ?? existing?.currency ?? 'CAD',
      assetClass: existing?.assetClass ?? assetClass,
      sector: existing?.sector,
      region: existing?.region,
      updatedAt: new Date().toISOString(),
    };

    await this.holdingRepo.upsert(holding);
    return holding;
  }

  /**
   * Rebuild all holdings for a user from scratch.
   * Used after bulk import, schema migration, or manual "Rebuild" debug trigger.
   */
  async rebuildAllHoldings(
    userId: string,
    accountIds: string[]
  ): Promise<void> {
    for (const accountId of accountIds) {
      // Get all active transactions for this account
      const allTxns = await this.txnRepo.getAll(accountId);

      // Group by symbol
      const bySymbol = new Map<string, Transaction[]>();
      for (const txn of allTxns) {
        const existing = bySymbol.get(txn.symbol) ?? [];
        existing.push(txn);
        bySymbol.set(txn.symbol, existing);
      }

      // Clear existing holdings for this account
      await this.holdingRepo.deleteAllForAccount(accountId);

      // Recompute each symbol
      for (const [symbol, txns] of bySymbol.entries()) {
        const sorted = [...txns].sort((a, b) =>
          a.executedAt.localeCompare(b.executedAt)
        );
        const { state } = computeACB(sorted);
        if (state.quantity === 0) continue;

        const holding: Holding = {
          id: uuidv4(),
          accountId,
          symbol,
          quantity: state.quantity,
          avgCostCents: state.avgCostCents,
          totalCostCents: state.totalCostCents,
          currency: txns[0]?.currency ?? 'CAD',
          assetClass: 'stock', // default; user can edit in Phase 2
          updatedAt: new Date().toISOString(),
        };
        await this.holdingRepo.upsert(holding);
      }
    }
    void userId; // used for logging in future
  }

  /**
   * Incremental update after a single transaction CUD.
   * Only recomputes the affected (accountId, symbol) pair.
   */
  async recomputeAfterTransactionChange(
    accountId: string,
    symbol: string
  ): Promise<void> {
    await this.computeHolding(accountId, symbol);
  }
}

/**
 * Compute current month key in YYYY-MM format.
 */
export function currentYearMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Compute prior month key.
 */
export function priorYearMonth(): string {
  return format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM');
}
