// ============================================================
// SnapshotService — Monthly Holdings Snapshot Generator
// Implements doc 02 §3.4 Holdings Snapshot Mechanism
//
// Snapshots are generated on 1st of each month for the prior month.
// On-demand during bulk import / schema migration via rebuildAll().
// ============================================================

import { format, endOfMonth, parseISO, startOfMonth, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { HoldingsSnapshot, Transaction } from '@/types';
import type {
  ITransactionRepository,
  ISnapshotRepository,
} from '@/repositories/interfaces';
import { computeACB } from './ACBEngine';

export class SnapshotService {
  private txnRepo: ITransactionRepository;
  private snapshotRepo: ISnapshotRepository;

  constructor(
    txnRepo: ITransactionRepository,
    snapshotRepo: ISnapshotRepository
  ) {
    this.txnRepo = txnRepo;
    this.snapshotRepo = snapshotRepo;
  }

  /**
   * Generate snapshot for a single (accountId, symbol) for the given yearMonth.
   * Replays all transactions up to and including the end of yearMonth.
   */
  async generateSnapshot(
    accountId: string,
    symbol: string,
    yearMonth: string // 'YYYY-MM'
  ): Promise<HoldingsSnapshot | null> {
    const allTxns = await this.txnRepo.getByAccountSymbol(accountId, symbol);

    // Include only transactions up to end of the target month
    const monthEnd = format(endOfMonth(parseISO(`${yearMonth}-01`)), 'yyyy-MM-dd');
    const txnsUpToMonth = allTxns
      .filter((t) => t.executedAt.slice(0, 10) <= monthEnd)
      .sort((a, b) => a.executedAt.localeCompare(b.executedAt));

    if (txnsUpToMonth.length === 0) return null;

    const { state } = computeACB(txnsUpToMonth);
    if (state.quantity <= 0) return null;

    const snapshot: HoldingsSnapshot = {
      id: uuidv4(),
      accountId,
      symbol,
      yearMonth,
      endOfMonthQuantity: state.quantity,
      endOfMonthAvgCostCents: state.avgCostCents,
      endOfMonthTotalCostCents: state.totalCostCents,
      cumulativeRocCents: state.cumulativeRocCents,
      createdAt: new Date().toISOString(),
    };

    await this.snapshotRepo.upsert(snapshot);
    return snapshot;
  }

  /**
   * Generate snapshots for all (accountId, symbol) pairs for the prior month.
   * Called automatically on 1st of each month (triggered by app startup check).
   */
  async triggerMonthlySnapshots(accountIds: string[]): Promise<void> {
    const priorMonth = format(
      subMonths(startOfMonth(new Date()), 1),
      'yyyy-MM'
    );

    for (const accountId of accountIds) {
      const allTxns = await this.txnRepo.getAll(accountId);

      // Find all unique symbols with transactions up to prior month
      const symbols = new Set<string>();
      const priorMonthEnd = format(
        endOfMonth(parseISO(`${priorMonth}-01`)),
        'yyyy-MM-dd'
      );
      for (const txn of allTxns) {
        if (txn.executedAt.slice(0, 10) <= priorMonthEnd) {
          symbols.add(txn.symbol);
        }
      }

      for (const symbol of symbols) {
        await this.generateSnapshot(accountId, symbol, priorMonth);
      }
    }
  }

  /**
   * Full rebuild of all snapshots for an account.
   * Used after bulk import or schema migration.
   * Generates one snapshot per month per symbol from first transaction date to last completed month.
   */
  async rebuildAll(accountId: string): Promise<void> {
    await this.snapshotRepo.deleteAllForAccount(accountId);

    const allTxns = await this.txnRepo.getAll(accountId);
    if (allTxns.length === 0) return;

    const symbols = new Set(allTxns.map((t) => t.symbol));
    const priorMonth = format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM');

    for (const symbol of symbols) {
      const symbolTxns = allTxns
        .filter((t) => t.symbol === symbol)
        .sort((a, b) => a.executedAt.localeCompare(b.executedAt));

      if (symbolTxns.length === 0) continue;

      const firstMonth = symbolTxns[0].executedAt.slice(0, 7); // YYYY-MM
      let current = firstMonth;

      // Generate a snapshot for each month from first transaction to prior month
      while (current <= priorMonth) {
        await this.generateSnapshot(accountId, symbol, current);
        // Advance to next month
        const nextDate = startOfMonth(
          new Date(parseISO(`${current}-01`).getTime() + 32 * 24 * 60 * 60 * 1000)
        );
        current = format(nextDate, 'yyyy-MM');
      }
    }
  }

  /**
   * Check if monthly snapshot generation is due (called on app startup).
   * Returns true if today is the 1st and prior month snapshot hasn't been generated yet.
   */
  async isMonthlySnapshotDue(accountIds: string[]): Promise<boolean> {
    const today = new Date();
    if (today.getDate() !== 1) return false;

    const priorMonth = format(subMonths(startOfMonth(today), 1), 'yyyy-MM');
    const existingSnapshots = await this.snapshotRepo.getByYearMonth(priorMonth);

    // Check if any account is missing a snapshot for prior month
    for (const accountId of accountIds) {
      const hasSnapshot = existingSnapshots.some((s) => s.accountId === accountId);
      if (!hasSnapshot) return true;
    }
    return false;
  }
}

/**
 * Helper: get transactions after a snapshot's month end for delta replay.
 */
export function getTransactionsSinceSnapshot(
  allTxns: Transaction[],
  snapshotYearMonth: string | undefined
): Transaction[] {
  if (!snapshotYearMonth) return allTxns;
  const cutoff = `${snapshotYearMonth}-01`;
  return allTxns.filter((t) => t.executedAt >= cutoff);
}
