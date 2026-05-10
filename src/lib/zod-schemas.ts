// ============================================================
// Zod Validation Schemas — one per entity form
// Used with React Hook Form via @hookform/resolvers/zod
// ============================================================

import { z } from 'zod';

// ── User Profile ────────────────────────────────────────────

export const UserProfileSchema = z.object({
  name:             z.string().min(1, 'Name is required').max(80),
  region:           z.enum(['CA', 'US']).default('CA'),
  baseCurrency:     z.enum(['CAD', 'USD']).default('CAD'),
  riskProfile:      z.enum(['conservative', 'moderate', 'aggressive']),
  assetTier:        z.enum(['starter', 'accumulator', 'growth', 'wealth']),
  age:              z.number().int().min(18).max(120).optional(),
  annualIncomeCents: z.number().int().min(0).optional(),
  marginalTaxRate:  z.number().min(0).max(1).optional(),
  province:         z.enum(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']).optional(),
  hasSpouse:        z.boolean().optional(),
  emergencyFundCents: z.number().int().min(0).optional(),
});

export type UserProfileFormData = z.infer<typeof UserProfileSchema>;

// ── Goal ────────────────────────────────────────────────────

export const GoalSchema = z.object({
  name:               z.string().min(1, 'Goal name is required').max(80),
  goalType:           z.enum(['house_down_payment','retirement','education','major_purchase','wealth_growth','other']),
  targetAmountCents:  z.number().int().min(1, 'Target amount must be greater than 0'),
  targetDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  priority:           z.union([z.literal(1), z.literal(2), z.literal(3)]),
  riskAllocation:     z.enum(['conservative', 'balanced', 'aggressive']),
  monthlyContributionCents: z.number().int().min(0).optional(),
  expectedAnnualReturn: z.number().min(0).max(1).optional(),
  isFlexible:         z.boolean().default(false),
});

export type GoalFormData = z.infer<typeof GoalSchema>;

// ── Account ─────────────────────────────────────────────────

export const AccountSchema = z.object({
  name:           z.string().min(1, 'Account name is required').max(80),
  type:           z.enum(['TFSA','RRSP','FHSA','NonRegistered','USD_NonReg','CryptoWallet']),
  goalId:         z.string().uuid('Please select a goal'),
  currency:       z.string().default('CAD'),
  institution:    z.string().max(100).optional(),
  contributionRoomCents: z.number().int().min(0).optional(),
  contributionRoomYear:  z.number().int().min(2000).max(2100).optional(),
});

export type AccountFormData = z.infer<typeof AccountSchema>;

// ── Transaction ─────────────────────────────────────────────

export const TransactionSchema = z.object({
  accountId:          z.string().uuid(),
  symbol:             z.string().min(1, 'Symbol is required').max(20).toUpperCase(),
  type:               z.enum([
    'buy','sell',
    'eligible_dividend','non_eligible_dividend','dividend',
    'return_of_capital','drip',
    'split',
    'transfer_in','transfer_out',
    'fee','interest',
    'conversion',
  ]),
  quantity:           z.number().min(0),
  pricePerUnitCents:  z.number().int().min(0),
  totalAmountCents:   z.number().int().min(0),
  feeCents:           z.number().int().min(0).default(0),
  currency:           z.string().default('CAD'),
  fxRate:             z.number().min(0).optional(),
  executedAt:         z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date is required'),
  settlementDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  splitRatio:         z.number().positive().optional(),
  conversionFromCurrency: z.string().optional(),
  conversionToCurrency:   z.string().optional(),
  conversionFromAmountCents: z.number().int().min(0).optional(),
  conversionToAmountCents:   z.number().int().min(0).optional(),
  notes:              z.string().max(500).optional(),
}).refine(
  (data) => {
    // split type requires a splitRatio
    if (data.type === 'split') return (data.splitRatio ?? 0) > 0;
    return true;
  },
  { message: 'Split ratio is required for split transactions', path: ['splitRatio'] }
).refine(
  (data) => {
    // conversion type requires from/to currency
    if (data.type === 'conversion') {
      return !!data.conversionFromCurrency && !!data.conversionToCurrency;
    }
    return true;
  },
  { message: 'From/To currency required for conversion transactions', path: ['conversionFromCurrency'] }
);

export type TransactionFormData = z.infer<typeof TransactionSchema>;
