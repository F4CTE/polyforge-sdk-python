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

/**
 * Resolves the common Recharts theme colors from CSS custom properties at runtime.
 * Recharts renders to SVG — CSS `var()` strings don't work in SVG fill/stroke
 * attributes, so we must read actual computed values via getComputedStyle.
 *
 * Call inside a `useMemo(() => resolveChartTheme(), [isDark])` to avoid
 * triggering layout-thrashing getComputedStyle calls on every render.
 */
export function resolveChartTheme() {
  const s = typeof window !== "undefined"
    ? getComputedStyle(document.documentElement)
    : null;
  const get = (v: string, fallback: string) =>
    s?.getPropertyValue(v).trim() || fallback;
  return {
    cyan500:       get("--color-pf-cyan-500",       "#06b6d4"),
    success:       get("--color-pf-success",        "#10b981"),
    danger:        get("--color-pf-danger",         "#ef4444"),
    textMuted:     get("--color-pf-text-muted",     "#64748b"),
    textSecondary: get("--color-pf-text-secondary", "#94a3b8"),
    textPrimary:   get("--color-pf-text",           "#e2e8f0"),
    bgElevated:    get("--color-pf-elevated",       "#0f172a"),
    borderColor:   get("--color-pf-border",         "#1e293b"),
    base:          get("--color-pf-base",           "#020817"),
  };
}

/** Default categorical palette for multi-series charts. */
export const chartPalette = [
  chartColors.cyan,
  chartColors.purple,
  chartColors.gold,
  chartColors.success,
  chartColors.info,
  chartColors.danger,
] as const;
