import { db } from '@/db';
import type { HoldingsSnapshot } from '@/types';
import type { ISnapshotRepository } from './interfaces';

export class SnapshotRepository implements ISnapshotRepository {
  async getLatest(accountId: string, symbol: string): Promise<HoldingsSnapshot | undefined> {
    // Find the snapshot with the most recent yearMonth for this (account, symbol)
    const snapshots = await db.holdingsSnapshots
      .where('accountId').equals(accountId)
      .filter((s) => s.symbol === symbol)
      .toArray();

    if (snapshots.length === 0) return undefined;
    // Sort descending and return first
    return snapshots.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
  }

  async getByYearMonth(yearMonth: string): Promise<HoldingsSnapshot[]> {
    return db.holdingsSnapshots
      .where('yearMonth').equals(yearMonth)
      .toArray();
  }

  async upsert(snapshot: HoldingsSnapshot): Promise<void> {
    // Check for existing snapshot for same (accountId, symbol, yearMonth)
    const existing = await db.holdingsSnapshots
      .where('[accountId+symbol+yearMonth]')
      .equals([snapshot.accountId, snapshot.symbol, snapshot.yearMonth])
      .first();

    if (existing) {
      await db.holdingsSnapshots.update(existing.id, snapshot);
    } else {
      await db.holdingsSnapshots.add(snapshot);
    }
  }

  async deleteAllForAccount(accountId: string): Promise<void> {
    await db.holdingsSnapshots.where('accountId').equals(accountId).delete();
  }
}
