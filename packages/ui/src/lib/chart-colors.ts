/**
 * Resolved chart color values that map to the design-token CSS custom properties.
 * Use these constants for Recharts fill/stroke attributes which require
 * concrete color strings (CSS vars don't work in SVG attributes).
 *
 * These mirror the --color-chart-* and accent/palette tokens in globals.css.
 * If the design tokens change, update these values to match.
 */

export const chartColors = {
  cyan: "var(--accent-default)",
  cyanLight: "var(--accent-text)",
  cyanGlow: "var(--accent-subtle)",
  purple: "var(--color-purple-500)",
  gold: "var(--color-gold-500)",
  success: "var(--gain)",
  danger: "var(--loss)",
  warning: "var(--warning)",
  info: "var(--info)",
  muted: "var(--text-tertiary)",
  textSecondary: "var(--text-secondary)",
  tooltipBg: "var(--bg-overlay)",
  tooltipBorder: "var(--border-default)",
  grid: "var(--color-chart-grid)",
  pnlPositive: "var(--gain)",
  pnlNegative: "var(--loss)",
  pnlNeutral: "var(--text-tertiary)",
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
    cyan500:       get("--color-accent",       "#06b6d4"),
    success:       get("--color-gain",        "#10b981"),
    danger:        get("--color-loss",         "#ef4444"),
    textMuted:     get("--color-tertiary",     "#64748b"),
    textSecondary: get("--color-secondary", "#94a3b8"),
    textPrimary:   get("--color-primary",           "#e2e8f0"),
    bgElevated:    get("--color-elevated",       "#0f172a"),
    borderColor:   get("--color-subtle",         "#1e293b"),
    base:          get("--color-app",           "#020817"),
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
