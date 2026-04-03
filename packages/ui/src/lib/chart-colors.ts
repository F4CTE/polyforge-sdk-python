/**
 * Resolved chart color values that map to the design-token CSS custom properties.
 * Use these constants for Recharts fill/stroke attributes which require
 * concrete color strings (CSS vars don't work in SVG attributes).
 *
 * These mirror the --color-pf-chart-* and --color-pf-* tokens in globals.css.
 * If the design tokens change, update these values to match.
 */

export const chartColors = {
  cyan: "var(--color-pf-cyan-500)",
  cyanLight: "var(--color-pf-cyan-400)",
  cyanGlow: "var(--color-pf-cyan-glow)",
  purple: "var(--color-pf-purple-500)",
  gold: "var(--color-pf-gold-500)",
  success: "var(--color-pf-success)",
  danger: "var(--color-pf-danger)",
  warning: "var(--color-pf-warning)",
  info: "var(--color-pf-info)",
  muted: "var(--color-pf-text-muted)",
  textSecondary: "var(--color-pf-text-secondary)",
  tooltipBg: "var(--color-pf-chart-tooltip-bg)",
  tooltipBorder: "var(--color-pf-chart-tooltip-border)",
  grid: "var(--color-pf-chart-grid)",
  pnlPositive: "var(--color-pf-pnl-positive)",
  pnlNegative: "var(--color-pf-pnl-negative)",
  pnlNeutral: "var(--color-pf-pnl-neutral)",
} as const;

/** Default categorical palette for multi-series charts. */
export const chartPalette = [
  chartColors.cyan,
  chartColors.purple,
  chartColors.gold,
  chartColors.success,
  chartColors.info,
  chartColors.danger,
] as const;
