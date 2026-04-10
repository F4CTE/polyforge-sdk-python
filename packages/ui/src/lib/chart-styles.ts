/**
 * Shared Recharts tooltip and axis style objects.
 *
 * Centralizes the inline-style objects previously copy-pasted across 8+ chart
 * components with inconsistent values (borderRadius 4 vs 6, fontSize 9–12).
 *
 * Import and spread into Recharts `<Tooltip>` and `<XAxis>`/`<YAxis>` props:
 *
 * ```tsx
 * import { chartTooltipContentStyle, chartTooltipLabelStyle, chartAxisTick } from '@polyforge/ui/lib/chart-styles';
 * <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} />
 * <XAxis tick={chartAxisTick} />
 * ```
 */

import type { CSSProperties } from 'react';

/** Tooltip content (outer box) — background, border, radius, font. */
export const chartTooltipContentStyle: CSSProperties = {
  background: 'var(--color-pf-chart-tooltip-bg)',
  border: '1px solid var(--color-pf-chart-tooltip-border)',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  padding: '4px 8px',
};

/** Tooltip label row styling. */
export const chartTooltipLabelStyle: CSSProperties = {
  color: 'var(--color-pf-text-secondary)',
  marginBottom: 2,
};

/** Axis tick text style (XAxis / YAxis `tick` prop). */
export const chartAxisTick = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  fill: 'var(--color-pf-text-muted)',
} as const;

/** Legend wrapper style — consistent font, color, and spacing across all chart legends. */
export const chartLegendStyle: CSSProperties = {
  fontSize: 'var(--font-size-pf-label)',
  color: 'var(--color-pf-text-secondary)',
  paddingTop: 'var(--spacing-pf-2)',
};
