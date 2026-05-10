// ============================================================
// Dexie IndexedDB Schema
// Version: 2 | Matches 03_Data_Model_Schema.md §IndexedDB Indexes
// ============================================================

// Store definitions in Dexie syntax:
//   First field = primary key (no '&' needed if it's just a name)
//   '&' prefix = unique index
//   '*' prefix = multi-entry index
//   '[a+b]' = compound index
//   'deletedAt' = included so soft-delete queries can filter on it

export const SCHEMA_V1 = {
  users:                  'id',
  goals:                  'id, userId, deletedAt',
  accounts:               'id, userId, goalId, deletedAt',
  transactions:           'id, accountId, symbol, executedAt, deletedAt, [accountId+symbol]',
  holdings:               'id, accountId, symbol, [accountId+symbol]',
  quotes:                 'symbol, timestamp',
  priceHistory:           '[symbol+date], symbol',
  watchList:              'id, userId, symbol',
  alerts:                 'id, userId, triggeredAt, readAt',
  news:                   'id, symbol, publishedAt',
  reports:                'id, userId, generatedAt, type',
  chatMessages:           'id, userId, createdAt',
  institutionalHoldings:  'id, investorName, symbol, filingDate',
  settings:               'id, [userId+key]',
};

// v2 adds:
//   - goalAllocations (virtual sub-accounts)
//   - holdingsSnapshots (monthly aggregation cache)
//   - settlementDate index on transactions
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  goalAllocations:     'id, accountId, goalId, [accountId+goalId]',
  holdingsSnapshots:   'id, [accountId+symbol+yearMonth], yearMonth, accountId',
  // Extend transactions with settlementDate index
  transactions: 'id, accountId, symbol, executedAt, settlementDate, deletedAt, [accountId+symbol]',
};

export const CURRENT_SCHEMA_VERSION = 2;
export const APP_VERSION = '0.1.0';
