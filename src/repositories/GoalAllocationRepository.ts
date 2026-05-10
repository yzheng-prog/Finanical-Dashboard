import { db } from '@/db';
import type { GoalAllocation } from '@/types';
import type { IGoalAllocationRepository } from './interfaces';

export class GoalAllocationRepository implements IGoalAllocationRepository {
  async getByAccount(accountId: string): Promise<GoalAllocation[]> {
    return db.goalAllocations
      .where('accountId').equals(accountId)
      .toArray();
  }

  async getById(id: string): Promise<GoalAllocation | undefined> {
    return db.goalAllocations.get(id);
  }

  async create(allocation: GoalAllocation): Promise<void> {
    await db.goalAllocations.add(allocation);
  }

  async update(id: string, changes: Partial<GoalAllocation>): Promise<void> {
    await db.goalAllocations.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.goalAllocations.delete(id);
  }

  // Replace all allocations for an account atomically (Phase 2+ UI)
  async replaceForAccount(accountId: string, allocations: GoalAllocation[]): Promise<void> {
    await db.transaction('rw', db.goalAllocations, async () => {
      await db.goalAllocations.where('accountId').equals(accountId).delete();
      if (allocations.length > 0) {
        await db.goalAllocations.bulkAdd(allocations);
      }
    });
  }
}
