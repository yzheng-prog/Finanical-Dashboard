// ============================================================
// Formatters — consistent display logic per doc 04 design spec
// All monetary input is integer cents (to avoid float errors).
// ============================================================

import { format, parseISO, isValid } from 'date-fns';

/**
 * Format integer cents to a display currency string.
 * e.g. formatCurrency(10050, 'CAD') → "$100.50"
 */
export function formatCurrency(
  cents: number,
  currency: string = 'CAD',
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const amount = cents / 100;
  const locale = currency === 'CAD' ? 'en-CA' : 'en-US';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: options?.compact ? 0 : 2,
  }).format(Math.abs(amount));

  if (options?.showSign && cents !== 0) {
    return cents > 0 ? `+${formatted}` : `-${formatted}`;
  }
  return cents < 0 ? `-${formatted}` : formatted;
}

/**
 * Format a decimal as a percentage string.
 * e.g. formatPercent(0.1350) → "+13.50%"
 */
export function formatPercent(
  value: number,
  options?: { showSign?: boolean; decimals?: number }
): string {
  const decimals = options?.decimals ?? 2;
  const abs = Math.abs(value * 100).toFixed(decimals);
  if (options?.showSign) {
    return value >= 0 ? `+${abs}%` : `-${abs}%`;
  }
  return `${value < 0 ? '-' : ''}${abs}%`;
}

/**
 * Format a quantity (shares) with up to 4 decimal places for fractional shares.
 */
export function formatQuantity(qty: number): string {
  if (Number.isInteger(qty)) return qty.toLocaleString('en-CA');
  return qty.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * Format an ISO date string to a readable date.
 * e.g. formatDate('2024-03-15') → 'Mar 15, 2024'
 */
export function formatDate(isoString: string): string {
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return isoString;
    return format(date, 'MMM d, yyyy');
  } catch {
    return isoString;
  }
}

/**
 * Format an ISO datetime string to relative + absolute.
 * e.g. '2024-03-15T14:30:00Z' → 'Mar 15, 2024, 2:30 PM'
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return isoString;
    return format(date, "MMM d, yyyy, h:mm a");
  } catch {
    return isoString;
  }
}

/**
 * Return gain/loss CSS color class based on value sign.
 * Used with Tailwind: text-gain or text-loss
 */
export function gainLossClass(value: number): string {
  if (value > 0) return 'text-gain';
  if (value < 0) return 'text-loss';
  return 'text-subtext';
}

/**
 * Format a price from cents to string (e.g., for display in a quote).
 */
export function formatPrice(priceCents: number, currency: string = 'CAD'): string {
  return formatCurrency(priceCents, currency);
}

/**
 * Compact large numbers: $1,234,567 → $1.23M
 */
export function formatCompact(cents: number, currency: string = 'CAD'): string {
  const amount = cents / 100;
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(cents, currency);
}
