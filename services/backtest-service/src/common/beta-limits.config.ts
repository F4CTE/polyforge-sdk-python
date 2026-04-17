/**
 * Beta Guardrails config — shared subset used by backtest-service.
 * Keep in sync with services/api-service/src/common/beta-limits.config.ts.
 */
function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const BETA_LIMITS = {
  maxConcurrentBacktests: envInt("BETA_MAX_CONCURRENT_BACKTESTS", 1),
  maxBacktestHistoryDays: envInt("BETA_MAX_BACKTEST_HISTORY_DAYS", 90),
};
