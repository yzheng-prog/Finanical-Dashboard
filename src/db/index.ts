// ============================================================
// Dexie Database Instance — single export used by all repositories
// ============================================================

import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  User, Goal, Account, GoalAllocation, Transaction,
  Holding, HoldingsSnapshot, Quote, Bar as PriceHistoryBar,
  WatchListItem, Alert, NewsItem, Report, ChatMessage,
  InstitutionalHolding, Setting,
} from '@/types';
import { SCHEMA_V1, SCHEMA_V2 } from './schema';
import { migrateV1toV2 } from './migrations';

// Extend Dexie with typed table accessors
class InvestmentDatabase extends Dexie {
  users!:                 EntityTable<User,                 'id'>;
  goals!:                 EntityTable<Goal,                 'id'>;
  accounts!:              EntityTable<Account,              'id'>;
  goalAllocations!:       EntityTable<GoalAllocation,       'id'>;
  transactions!:          EntityTable<Transaction,          'id'>;
  holdings!:              EntityTable<Holding,              'id'>;
  holdingsSnapshots!:     EntityTable<HoldingsSnapshot,     'id'>;
  quotes!:                EntityTable<Quote,                'symbol'>;
  priceHistory!:          Table<PriceHistoryBar>; // compound PK [symbol+date], use Table not EntityTable
  watchList!:             EntityTable<WatchListItem,        'id'>;
  alerts!:                EntityTable<Alert,                'id'>;
  news!:                  EntityTable<NewsItem,             'id'>;
  reports!:               EntityTable<Report,               'id'>;
  chatMessages!:          EntityTable<ChatMessage,          'id'>;
  institutionalHoldings!: EntityTable<InstitutionalHolding, 'id'>;
  settings!:              EntityTable<Setting,              'id'>;

  constructor() {
    super('InvestmentPlatform');

    this.version(1).stores(SCHEMA_V1);

    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade(async (trans) => {
        // Pass the Dexie instance to the migration helper
        await migrateV1toV2(trans.db as unknown as Dexie);
      });
  }
}

export const db = new InvestmentDatabase();
export default db;
