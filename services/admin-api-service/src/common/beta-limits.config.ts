/**
 * Beta Guardrails config — subset used by admin-api-service.
 * Keep in sync with services/api-service/src/common/beta-limits.config.ts.
 */
function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const BETA_LIMITS = {
  maxActiveStrategies: envInt("BETA_MAX_ACTIVE_STRATEGIES", 3),
  maxConcurrentBacktests: envInt("BETA_MAX_CONCURRENT_BACKTESTS", 1),
  maxMonthlyVolumeUsdc: envInt("BETA_MAX_MONTHLY_VOLUME_USDC", 5000),
  maxPositionSizeUsdc: envInt("BETA_MAX_POSITION_SIZE_USDC", 500),
  maxMarketplaceListings: envInt("BETA_MAX_MARKETPLACE_LISTINGS", 2),
  maxDailyStrategyExecutions: envInt("BETA_MAX_DAILY_STRATEGY_EXECUTIONS", 500),
};
