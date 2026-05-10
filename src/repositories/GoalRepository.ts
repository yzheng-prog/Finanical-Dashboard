import { db } from '@/db';
import type { Goal } from '@/types';
import type { IGoalRepository } from './interfaces';

export class GoalRepository implements IGoalRepository {
  async getAll(userId: string): Promise<Goal[]> {
    return db.goals
      .where('userId').equals(userId)
      .filter((g) => !g.deletedAt)
      .toArray();
  }

  async getById(id: string): Promise<Goal | undefined> {
    return db.goals.get(id);
  }

  async create(goal: Goal): Promise<void> {
    await db.goals.add(goal);
  }

  async update(id: string, changes: Partial<Goal>): Promise<void> {
    await db.goals.update(id, { ...changes, updatedAt: new Date().toISOString() });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.goals.update(id, { deletedAt: now, updatedAt: now });
  }
}
