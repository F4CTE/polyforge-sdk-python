/**
 * Beta Guardrails — single source of truth for all per-user usage caps.
 *
 * Every value is env-configurable so limits can be adjusted without a deploy.
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

function ciAwareLimit(defaultValue: number): number {
  return process.env.CI === "true" ? 10_000 : defaultValue;
}

export const BETA_LIMITS: BetaLimits = {
  maxActiveStrategies: envInt("BETA_MAX_ACTIVE_STRATEGIES", 3),
  maxConcurrentBacktests: envInt("BETA_MAX_CONCURRENT_BACKTESTS", 1),
  maxBacktestHistoryDays: envInt("BETA_MAX_BACKTEST_HISTORY_DAYS", 90),
  maxMonthlyVolumeUsdc: envInt("BETA_MAX_MONTHLY_VOLUME_USDC", 5000),
  maxPositionSizeUsdc: envInt("BETA_MAX_POSITION_SIZE_USDC", 500),
  marketDataRateLimitPerMinute: envInt(
    "BETA_MARKET_DATA_RATE_LIMIT",
    ciAwareLimit(100),
  ),
  maxMarketplaceListings: envInt("BETA_MAX_MARKETPLACE_LISTINGS", 2),
  maxDailyStrategyExecutions: envInt("BETA_MAX_DAILY_STRATEGY_EXECUTIONS", 500),
};
