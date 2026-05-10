import { db } from '@/db';
import type { User } from '@/types';
import type { IUserRepository } from './interfaces';

export class UserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    return db.users.toArray();
  }

  async getById(id: string): Promise<User | undefined> {
    return db.users.get(id);
  }

  async create(user: User): Promise<void> {
    await db.users.add(user);
  }

  async update(id: string, changes: Partial<User>): Promise<void> {
    await db.users.update(id, { ...changes, updatedAt: new Date().toISOString() });
  }

  async delete(id: string): Promise<void> {
    await db.users.delete(id);
  }
}
