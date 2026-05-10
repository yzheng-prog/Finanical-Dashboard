// ============================================================
// <Money /> — Currency-aware amount display
// Uses tabular-nums for column alignment per doc 04 §3
// Applies gain/loss color only to delta amounts (not principal)
// ============================================================

import { formatCurrency, gainLossClass } from '@/lib/formatters';

interface MoneyProps {
  cents: number;
  currency?: string;
  showSign?: boolean;
  /** Apply gain/loss color based on sign */
  colored?: boolean;
  /** Use compact display ($1.23M) */
  compact?: boolean;
  className?: string;
}

export function Money({
  cents,
  currency = 'CAD',
  showSign = false,
  colored = false,
  compact = false,
  className = '',
}: MoneyProps) {
  const colorClass = colored ? gainLossClass(cents) : '';
  const sign = showSign && cents > 0 ? '+' : '';

  const formatted = compact
    ? formatCurrency(Math.abs(cents), currency, { compact: true })
    : formatCurrency(Math.abs(cents), currency);

  const display = cents < 0 ? `-${formatted}` : `${sign}${formatted}`;

  return (
    <span
      className={`font-mono tabular-nums ${colorClass} ${className}`.trim()}
    >
      {display}
    </span>
  );
}
