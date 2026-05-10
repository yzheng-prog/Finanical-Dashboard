import { db } from '@/db';
import type { Account } from '@/types';
import type { IAccountRepository } from './interfaces';

export class AccountRepository implements IAccountRepository {
  async getAll(userId: string): Promise<Account[]> {
    return db.accounts
      .where('userId').equals(userId)
      .filter((a) => !a.deletedAt)
      .toArray();
  }

  async getById(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  }

  async getByGoalId(goalId: string): Promise<Account[]> {
    return db.accounts
      .where('goalId').equals(goalId)
      .filter((a) => !a.deletedAt)
      .toArray();
  }

  async create(account: Account): Promise<void> {
    await db.accounts.add(account);
  }

  async update(id: string, changes: Partial<Account>): Promise<void> {
    await db.accounts.update(id, { ...changes, updatedAt: new Date().toISOString() });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.accounts.update(id, { deletedAt: now, updatedAt: now });
  }
}
