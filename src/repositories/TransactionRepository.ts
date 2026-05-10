import { db } from '@/db';
import type { Transaction } from '@/types';
import type { ITransactionRepository } from './interfaces';

export class TransactionRepository implements ITransactionRepository {
  async getAll(accountId: string): Promise<Transaction[]> {
    return db.transactions
      .where('accountId').equals(accountId)
      .filter((t) => !t.deletedAt)
      .toArray();
  }

  async getByAccountSymbol(accountId: string, symbol: string): Promise<Transaction[]> {
    return db.transactions
      .where('[accountId+symbol]').equals([accountId, symbol])
      .filter((t) => !t.deletedAt)
      .sortBy('executedAt');
  }

  async getById(id: string): Promise<Transaction | undefined> {
    return db.transactions.get(id);
  }

  async getByDateRange(accountId: string, from: string, to: string): Promise<Transaction[]> {
    return db.transactions
      .where('accountId').equals(accountId)
      .filter((t) => !t.deletedAt && t.executedAt >= from && t.executedAt <= to)
      .toArray();
  }

  async create(transaction: Transaction): Promise<void> {
    await db.transactions.add(transaction);
  }

  async update(id: string, changes: Partial<Transaction>): Promise<void> {
    await db.transactions.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.transactions.update(id, { deletedAt: now, updatedAt: now });
  }

  async getAllForUser(accountIds: string[]): Promise<Transaction[]> {
    if (accountIds.length === 0) return [];
    const all = await Promise.all(
      accountIds.map((accountId) =>
        db.transactions
          .where('accountId').equals(accountId)
          .filter((t) => !t.deletedAt)
          .toArray()
      )
    );
    return all.flat().sort((a, b) => a.executedAt.localeCompare(b.executedAt));
  }
}
