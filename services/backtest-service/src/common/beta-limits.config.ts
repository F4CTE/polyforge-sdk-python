const envInt = (key: string, defaultValue: number): number => {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export const BETA_LIMITS = {
  maxConcurrentBacktests: envInt("BETA_MAX_CONCURRENT_BACKTESTS", 1),
  maxBacktestHistoryDays: envInt("BETA_MAX_BACKTEST_HISTORY_DAYS", 90),
};
