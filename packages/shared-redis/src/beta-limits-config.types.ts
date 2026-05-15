/**
 * Beta Guardrails — single source of truth for all per-user usage caps.
 *
 * These limits are now Redis-backed. The env vars serve as fallback defaults
 * when Redis is unavailable or no override has been persisted.
 *
 * Defaults match the agreed beta limits from POLA-32 / POLA-87.
 */
export interface BetaLimits {
  /** Max non-archived strategies a user may own simultaneously */
  maxActiveStrategies: number;
  /** Max concurrently running backtest jobs per user (additional runs are queued) */
  maxConcurrentBacktests: number;
  /** Max look-back window (days) for backtest date range */
  maxBacktestHistoryDays: number;
  /** Max cumulative filled-order volume (USDC) per calendar month per user */
  maxMonthlyVolumeUsdc: number;
  /** Max single-order position size (USDC) */
  maxPositionSizeUsdc: number;
  /** Max market-data API requests per minute per user / API key */
  marketDataRateLimitPerMinute: number;
  /** Max ACTIVE marketplace listings per user */
  maxMarketplaceListings: number;
  /** Max strategy-engine tick executions per strategy per UTC day */
  maxDailyStrategyExecutions: number;
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const BETA_LIMITS_DEFAULTS: BetaLimits = {
  maxActiveStrategies: envInt("BETA_MAX_ACTIVE_STRATEGIES", 3),
  maxConcurrentBacktests: envInt("BETA_MAX_CONCURRENT_BACKTESTS", 1),
  maxBacktestHistoryDays: envInt("BETA_MAX_BACKTEST_HISTORY_DAYS", 90),
  maxMonthlyVolumeUsdc: envInt("BETA_MAX_MONTHLY_VOLUME_USDC", 5000),
  maxPositionSizeUsdc: envInt("BETA_MAX_POSITION_SIZE_USDC", 500),
  marketDataRateLimitPerMinute: envInt(
    "BETA_MARKET_DATA_RATE_LIMIT",
    process.env.CI === "true" ? 10_000 : 100,
  ),
  maxMarketplaceListings: envInt("BETA_MAX_MARKETPLACE_LISTINGS", 2),
  maxDailyStrategyExecutions: envInt("BETA_MAX_DAILY_STRATEGY_EXECUTIONS", 500),
};

export const BETA_LIMITS_KEY = "config:beta_limits";

/** Per-field Redis keys for individual limit reads (avoids full JSON parse on hot paths) */
const FIELD_KEYS: Record<keyof BetaLimits, string> = {
  maxActiveStrategies: `${BETA_LIMITS_KEY}:max_active_strategies`,
  maxConcurrentBacktests: `${BETA_LIMITS_KEY}:max_concurrent_backtests`,
  maxBacktestHistoryDays: `${BETA_LIMITS_KEY}:max_backtest_history_days`,
  maxMonthlyVolumeUsdc: `${BETA_LIMITS_KEY}:max_monthly_volume_usdc`,
  maxPositionSizeUsdc: `${BETA_LIMITS_KEY}:max_position_size_usdc`,
  marketDataRateLimitPerMinute: `${BETA_LIMITS_KEY}:market_data_rate_limit_per_minute`,
  maxMarketplaceListings: `${BETA_LIMITS_KEY}:max_marketplace_listings`,
  maxDailyStrategyExecutions: `${BETA_LIMITS_KEY}:max_daily_strategy_executions`,
};

export function betaLimitFieldKey(field: keyof BetaLimits): string {
  return FIELD_KEYS[field];
}
