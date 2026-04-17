/**
 * Beta Guardrails config — subset used by strategy-engine.
 * Keep in sync with services/api-service/src/common/beta-limits.config.ts.
 */
function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const BETA_LIMITS = {
  maxDailyStrategyExecutions: envInt("BETA_MAX_DAILY_STRATEGY_EXECUTIONS", 500),
};
