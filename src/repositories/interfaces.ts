// ============================================================
// Repository Interfaces — Part of the Repository Pattern (doc 02 §3.1)
// Implementations: IndexedDB (Phase 1), Supabase (Phase 3+ optional)
// ============================================================

import type {
  User, Goal, Account, GoalAllocation,
  Transaction, Holding, HoldingsSnapshot,
} from '@/types';

// ── User ────────────────────────────────────────────────────
export interface IUserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | undefined>;
  create(user: User): Promise<void>;
  update(id: string, changes: Partial<User>): Promise<void>;
  delete(id: string): Promise<void>;
}

// ── Goal ────────────────────────────────────────────────────
export interface IGoalRepository {
  getAll(userId: string): Promise<Goal[]>;
  getById(id: string): Promise<Goal | undefined>;
  create(goal: Goal): Promise<void>;
  update(id: string, changes: Partial<Goal>): Promise<void>;
  softDelete(id: string): Promise<void>;
}

// ── Account ─────────────────────────────────────────────────
export interface IAccountRepository {
  getAll(userId: string): Promise<Account[]>;
  getById(id: string): Promise<Account | undefined>;
  getByGoalId(goalId: string): Promise<Account[]>;
  create(account: Account): Promise<void>;
  update(id: string, changes: Partial<Account>): Promise<void>;
  softDelete(id: string): Promise<void>;
}

// ── GoalAllocation ───────────────────────────────────────────
export interface IGoalAllocationRepository {
  getByAccount(accountId: string): Promise<GoalAllocation[]>;
  getById(id: string): Promise<GoalAllocation | undefined>;
  create(allocation: GoalAllocation): Promise<void>;
  update(id: string, changes: Partial<GoalAllocation>): Promise<void>;
  delete(id: string): Promise<void>;
  // Replace all allocations for an account atomically
  replaceForAccount(accountId: string, allocations: GoalAllocation[]): Promise<void>;
}

// ── Transaction ──────────────────────────────────────────────
export interface ITransactionRepository {
  getAll(accountId: string): Promise<Transaction[]>;
  getByAccountSymbol(accountId: string, symbol: string): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | undefined>;
  getByDateRange(accountId: string, from: string, to: string): Promise<Transaction[]>;
  create(transaction: Transaction): Promise<void>;
  update(id: string, changes: Partial<Transaction>): Promise<void>;
  softDelete(id: string): Promise<void>;
  // All active (non-deleted) transactions across all user accounts
  getAllForUser(accountIds: string[]): Promise<Transaction[]>;
}

// ── Holding ──────────────────────────────────────────────────
// Holdings are NEVER written directly from UI — only via ACBEngine
export interface IHoldingRepository {
  getAll(accountId: string): Promise<Holding[]>;
  getAllForUser(accountIds: string[]): Promise<Holding[]>;
  getByAccountSymbol(accountId: string, symbol: string): Promise<Holding | undefined>;
  upsert(holding: Holding): Promise<void>;
  delete(accountId: string, symbol: string): Promise<void>;
  deleteAllForAccount(accountId: string): Promise<void>;
}

// ── HoldingsSnapshot ─────────────────────────────────────────
export interface ISnapshotRepository {
  getLatest(accountId: string, symbol: string): Promise<HoldingsSnapshot | undefined>;
  getByYearMonth(yearMonth: string): Promise<HoldingsSnapshot[]>;
  upsert(snapshot: HoldingsSnapshot): Promise<void>;
  deleteAllForAccount(accountId: string): Promise<void>;
}
