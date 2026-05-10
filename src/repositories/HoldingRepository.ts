import { db } from '@/db';
import type { Holding } from '@/types';
import type { IHoldingRepository } from './interfaces';

export class HoldingRepository implements IHoldingRepository {
  async getAll(accountId: string): Promise<Holding[]> {
    return db.holdings.where('accountId').equals(accountId).toArray();
  }

  async getAllForUser(accountIds: string[]): Promise<Holding[]> {
    if (accountIds.length === 0) return [];
    const all = await Promise.all(
      accountIds.map((id) => db.holdings.where('accountId').equals(id).toArray())
    );
    return all.flat();
  }

  async getByAccountSymbol(accountId: string, symbol: string): Promise<Holding | undefined> {
    return db.holdings
      .where('[accountId+symbol]').equals([accountId, symbol])
      .first();
  }

  // Holdings are only written by HoldingsService / ACBEngine — never directly from UI
  async upsert(holding: Holding): Promise<void> {
    await db.holdings.put(holding);
  }

  async delete(accountId: string, symbol: string): Promise<void> {
    await db.holdings
      .where('[accountId+symbol]').equals([accountId, symbol])
      .delete();
  }

  async deleteAllForAccount(accountId: string): Promise<void> {
    await db.holdings.where('accountId').equals(accountId).delete();
  }
}
