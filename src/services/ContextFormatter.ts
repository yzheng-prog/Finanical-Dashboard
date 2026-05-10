// ============================================================
// ContextFormatter — LLM Context Assembly (Phase 3 stub)
// Implements doc 02 §3.3 and §3.5 MCP Interface Reservation
//
// Phase 1: Stub only. Interfaces are MCP-compatible (function signatures
// compatible with future MCP tool calls per doc 02 §3.5).
// Phase 3: Wire these functions to real Claude API calls.
//
// The formatter converts raw holdings JSON to compact text, reducing
// token usage by 60–70% (from ~800 tokens to ~120 for 10 holdings).
// ============================================================

import type { Holding, Goal, User, AggregatedSentiment } from '@/types';

export interface FormattedContext {
  holdingsText: string;
  goalsText: string;
  userProfileText: string;
  asOfTime: string;
}

// ── MCP-compatible tool signatures (reserved for Phase 4+ MCP server) ──

/**
 * Get holdings for a specific symbol.
 * MCP tool signature: getHoldings(symbol?: string) → Holding[]
 */
export async function getHoldings(symbol?: string): Promise<Holding[]> {
  // Phase 1: stub — returns empty. Phase 3: query IndexedDB via MCP transport.
  void symbol;
  return [];
}

/**
 * Get realized gains for a tax year.
 * MCP tool signature: getRealizedGains(year: number) → { gainCents: number }
 */
export async function getRealizedGains(year: number): Promise<{ gainCents: number }> {
  // Phase 1: stub
  void year;
  return { gainCents: 0 };
}

// ── Context Formatting ──────────────────────────────────────

/**
 * Convert holdings array to compact text format for LLM context injection.
 * Reduces token usage from ~800 to ~120 tokens for 10 holdings.
 *
 * Example output:
 *   AAPL: 100 sh @ avg $150.00, now $170.20 (+13.5%, +$2,020 unrealized)
 *   VFV.TO: 50 sh @ avg $98.50, now $112.30 (+14.0%, +$690 unrealized)
 */
export function formatHoldingsContext(
  holdings: Holding[],
  quotes?: Record<string, number> // symbol → current price in cents
): string {
  if (holdings.length === 0) return 'No holdings.';

  return holdings
    .map((h) => {
      const avgCost = (h.avgCostCents / 100).toFixed(2);
      const totalCost = (h.totalCostCents / 100).toFixed(0);

      if (quotes?.[h.symbol] != null) {
        const currentPriceCents = quotes[h.symbol];
        const currentValue = (currentPriceCents * h.quantity) / 100;
        const unrealized = currentValue - h.totalCostCents / 100;
        const pct = ((currentValue - h.totalCostCents / 100) / (h.totalCostCents / 100)) * 100;
        const sign = unrealized >= 0 ? '+' : '';
        return (
          `${h.symbol}: ${h.quantity} sh @ avg $${avgCost}, ` +
          `now $${(currentPriceCents / 100).toFixed(2)} ` +
          `(${sign}${pct.toFixed(1)}%, ${sign}$${Math.round(unrealized)} unrealized)`
        );
      }

      return `${h.symbol}: ${h.quantity} sh @ avg $${avgCost} (book value $${totalCost})`;
    })
    .join('\n');
}

/**
 * Format goals for LLM context.
 */
export function formatGoalsContext(goals: Goal[]): string {
  if (goals.length === 0) return 'No goals set.';
  return goals
    .map((g) => {
      const target = (g.targetAmountCents / 100).toLocaleString('en-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0,
      });
      return `${g.name} (${g.goalType}): target ${target} by ${g.targetDate}, allocation: ${g.riskAllocation}`;
    })
    .join('\n');
}

/**
 * Format user profile for LLM context.
 */
export function formatUserProfileContext(user: User): string {
  return [
    `Region: ${user.region}`,
    `Risk Profile: ${user.riskProfile}`,
    `Asset Tier: ${user.assetTier}`,
    user.province ? `Province: ${user.province}` : null,
    user.marginalTaxRate != null
      ? `Marginal Tax Rate: ${(user.marginalTaxRate * 100).toFixed(0)}%`
      : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Assemble full LLM context with mandatory as_of_time injection.
 * System prompt MUST include: "Quotes are delayed by 15 minutes. Do not provide
 * real-time or swing-trading advice. as_of: {timestamp}"
 */
export function assembleContext(
  user: User,
  holdings: Holding[],
  goals: Goal[],
  quotes?: Record<string, number>,
  _sentiment?: AggregatedSentiment[] // Phase 3: wire up
): FormattedContext {
  const asOfTime = new Date().toISOString();
  return {
    holdingsText: formatHoldingsContext(holdings, quotes),
    goalsText: formatGoalsContext(goals),
    userProfileText: formatUserProfileContext(user),
    asOfTime,
  };
}

/**
 * Build the mandatory system prompt prefix for all LLM calls.
 * Per doc 02 §3.3: must always include as_of_time and 15-min delay disclaimer.
 */
export function buildSystemPromptPrefix(asOfTime: string): string {
  return (
    `You are a personal investment advisor assistant. ` +
    `Quotes are delayed by 15 minutes. Do not provide real-time or swing-trading advice. ` +
    `as_of: ${asOfTime}\n` +
    `Base your analysis ONLY on the holdings data provided. Do not hallucinate numbers. ` +
    `Always end responses with a disclaimer that this is not professional financial advice.`
  );
}
