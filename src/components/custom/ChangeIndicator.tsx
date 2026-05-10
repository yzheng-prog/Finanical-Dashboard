// ============================================================
// <ChangeIndicator /> — Gain/loss with arrow icon
// Color-blind friendly: uses ↑↓ arrows alongside color per doc 04 §9
// ============================================================

import { formatPercent, gainLossClass } from '@/lib/formatters';

interface ChangeIndicatorProps {
  value: number;       // decimal, e.g. 0.135 = +13.5%
  showArrow?: boolean;
  className?: string;
}

export function ChangeIndicator({ value, showArrow = true, className = '' }: ChangeIndicatorProps) {
  const colorClass = gainLossClass(value);
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';

  return (
    <span className={`text-sm font-medium ${colorClass} ${className}`.trim()}>
      {showArrow && <span aria-hidden="true">{arrow} </span>}
      {formatPercent(value, { showSign: true })}
    </span>
  );
}
