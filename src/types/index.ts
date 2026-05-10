// ============================================================
// Investment Platform — Core TypeScript Types
// Version: v2.1 | Matches schema in 03_Data_Model_Schema.md
// All monetary values stored as integer cents to avoid float errors.
// ============================================================

// ─────────────────────────────────────────────
// Enums & Unions
// ─────────────────────────────────────────────

export type Region = 'CA' | 'US';
export type BaseCurrency = 'CAD' | 'USD';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';
export type AssetTier = 'starter' | 'accumulator' | 'growth' | 'wealth';
export type Province = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export type GoalType =
  | 'house_down_payment'
  | 'retirement'
  | 'education'
  | 'major_purchase'
  | 'wealth_growth'
  | 'other';

export type GoalPriority = 1 | 2 | 3;
export type RiskAllocation = 'conservative' | 'balanced' | 'aggressive';

export type AccountType =
  | 'TFSA'
  | 'RRSP'
  | 'FHSA'
  | 'NonRegistered'
  | 'USD_NonReg'
  | 'CryptoWallet';

// All 12 transaction types — UPDATED in v2.1
export type TransactionType =
  | 'buy'
  | 'sell'
  | 'eligible_dividend'
  | 'non_eligible_dividend'
  | 'dividend'             // generic fallback for crypto/US/unknown
  | 'return_of_capital'    // ROC — reduces ACB without taxable event
  | 'drip'                 // Dividend Reinvestment Plan
  | 'split'
  | 'transfer_in'
  | 'transfer_out'
  | 'fee'
  | 'interest'
  | 'conversion';          // CAD↔USD (Norbert's Gambit, etc.)

export type AssetClass = 'stock' | 'etf' | 'bond' | 'crypto' | 'commodity' | 'cash';

export type AlertType = 'volatility' | 'backup_reminder' | 'tax_reminder' | 'drift';

export type ReportType = 'weekly' | 'monthly';

// ─────────────────────────────────────────────
// Core Entities
// ─────────────────────────────────────────────

export interface User {
  id: string;                     // UUID
  name: string;
  region: Region;                 // MVP only supports CA
  baseCurrency: BaseCurrency;
  riskProfile: RiskProfile;
  assetTier: AssetTier;
  age?: number;
  annualIncomeCents?: number;
  marginalTaxRate?: number;       // e.g., 0.43 = 43%
  province?: Province;
  hasSpouse?: boolean;            // affects Superficial Loss Rule
  emergencyFundCents?: number;
  createdAt: string;              // ISO 8601 UTC
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  goalType: GoalType;
  targetAmountCents: number;
  targetDate: string;             // ISO date string YYYY-MM-DD
  priority: GoalPriority;
  riskAllocation: RiskAllocation;
  monthlyContributionCents?: number;
  expectedAnnualReturn?: number;  // decimal, e.g. 0.07 = 7%
  isFlexible: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;             // soft delete
}

export interface Account {
  id: string;
  userId: string;
  goalId: string;                 // PRIMARY goal binding (Plan A)
  name: string;
  type: AccountType;
  currency: BaseCurrency | string; // CAD, USD, or crypto ticker
  institution?: string;
  contributionRoomCents?: number;
  contributionRoomYear?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Virtual sub-account for splitting one physical account across multiple goals
// Schema lands in Phase 1; UI for editing deferred to Phase 2+
export interface GoalAllocation {
  id: string;
  accountId: string;
  goalId: string;
  percentage: number;             // 0..1; sum across same accountId must equal 1.0
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  symbol: string;
  type: TransactionType;
  quantity: number;
  pricePerUnitCents: number;
  totalAmountCents: number;
  feeCents: number;
  currency: string;
  fxRate?: number;
  executedAt: string;             // ISO datetime — trade date
  settlementDate?: string;        // NEW v2.1 — CRA uses BoC rate of settlement date for USD capital gains
  // For 'conversion' type only:
  conversionFromCurrency?: string;
  conversionToCurrency?: string;
  conversionFromAmountCents?: number;
  conversionToAmountCents?: number;
  // For 'split' type only:
  splitRatio?: number;            // e.g., 2 for 2:1 split
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Computed cache — never edited directly by UI
export interface Holding {
  id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  avgCostCents: number;
  totalCostCents: number;
  currency: string;
  assetClass: AssetClass;
  sector?: string;
  region?: string;
  updatedAt: string;
}

// Monthly aggregation cache — NEW v2.1
// Current Holding = latest snapshot + current-month delta replay
export interface HoldingsSnapshot {
  id: string;
  accountId: string;
  symbol: string;
  yearMonth: string;              // 'YYYY-MM'
  endOfMonthQuantity: number;
  endOfMonthAvgCostCents: number;
  endOfMonthTotalCostCents: number;
  cumulativeRocCents: number;     // running total of ROC adjustments
  createdAt: string;
}

// ─────────────────────────────────────────────
// Market Data
// ─────────────────────────────────────────────

export interface Quote {
  symbol: string;
  price: number;                  // in native currency
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: string;              // ISO datetime of quote (15-min delayed)
  currency: string;
}

export interface Bar {
  symbol: string;
  date: string;                   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WatchListItem {
  id: string;
  userId: string;
  symbol: string;
  addedAt: string;
}

// ─────────────────────────────────────────────
// News, Alerts, Sentiment
// ─────────────────────────────────────────────

export type NewsCategory =
  | 'company_filing'   // earnings, 10-K, 10-Q
  | 'regulatory'       // SEC/OSC filings, litigation
  | 'industry'         // sector events
  | 'general';         // commentary, analyst notes

export interface NewsItem {
  id: string;
  symbol: string;
  headline: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface AggregatedSentiment {
  symbol: string;
  date: string;                   // YYYY-MM-DD
  overall: 'positive' | 'neutral' | 'negative';
  confidence: number;             // 0..1
  keyThemes: string[];
  cachedAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  symbol?: string;
  message: string;
  triggeredAt: string;
  readAt?: string;
}

// ─────────────────────────────────────────────
// Reports & Advisor (Phase 3 interfaces reserved)
// ─────────────────────────────────────────────

export interface Report {
  id: string;
  userId: string;
  type: ReportType;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  content: string;                // LLM-generated markdown narrative
  metrics: Record<string, number>; // Sharpe, volatility, drawdown, etc.
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tokenCount?: number;
}

// ─────────────────────────────────────────────
// Institutional Holdings (Phase 3)
// ─────────────────────────────────────────────

export interface InstitutionalHolding {
  id: string;
  investorName: string;
  fund: string;
  cik: string;
  symbol: string;
  shares: number;
  valueCents: number;             // USD cents from 13F
  filingDate: string;
  reportedPeriod: string;         // YYYY-MM-DD of quarter end
  changeType?: 'new' | 'increased' | 'decreased' | 'sold_out';
}

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────

export interface Setting {
  id: string;
  userId: string;
  key: string;
  value: string;                  // JSON-serialized
  updatedAt: string;
}

// Well-known setting keys (doc 03 backup keys + others)
export const SETTING_KEYS = {
  BACKUP_LAST_AT:           'backup.lastBackupAt',
  BACKUP_TX_COUNT:          'backup.transactionsSinceBackup',
  BACKUP_SNOOZE_UNTIL:      'backup.reminderSnoozeUntil',
  BACKUP_PREFER_ENCRYPTION: 'backup.preferEncryption',
} as const;

// ─────────────────────────────────────────────
// Backup File Format (doc 03 §Backup File Format)
// ─────────────────────────────────────────────

export interface BackupData {
  users: User[];
  goals: Goal[];
  accounts: Account[];
  goalAllocations: GoalAllocation[];
  transactions: Transaction[];
  watchList: WatchListItem[];
  settings: Setting[];
}

export interface BackupEnvelope {
  format: 'investment-platform-backup';
  schemaVersion: number;          // must match Dexie db.version
  appVersion: string;
  exportedAt: string;
  encrypted: boolean;
  data?: BackupData;              // present when encrypted=false
  // Present when encrypted=true:
  cipher?: 'AES-GCM';
  kdf?: 'PBKDF2-SHA256';
  iterations?: number;
  salt?: string;                  // base64
  iv?: string;                    // base64
  ciphertext?: string;            // base64
  checksum?: string;              // SHA-256 of ciphertext
}

// ─────────────────────────────────────────────
// ACB Engine Types
// ─────────────────────────────────────────────

export interface ACBState {
  symbol: string;
  accountId: string;
  quantity: number;
  totalCostCents: number;         // aggregate book cost in account currency
  avgCostCents: number;           // totalCostCents / quantity
  cumulativeRocCents: number;     // total ROC received (reduces ACB)
  realizedGainCents: number;      // running total of realized capital gains
}

export interface ACBComputeResult {
  finalState: ACBState;
  realizedGainCents: number;
}

// ─────────────────────────────────────────────
// Risk Metrics
// ─────────────────────────────────────────────

export interface RiskMetrics {
  volatilityAnnualized: number;   // standard deviation of daily returns × sqrt(252)
  sharpeRatio: number;            // (return - riskFreeRate) / volatility
  maxDrawdown: number;            // peak-to-trough as decimal, e.g. -0.15 = -15%
  calculatedAt: string;
}
