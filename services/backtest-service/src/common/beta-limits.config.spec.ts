import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const MODULE_PATH = "../common/beta-limits.config";

describe("BETA_LIMITS config", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules();
    savedEnv = { ...process.env };
    delete process.env.BETA_MAX_CONCURRENT_BACKTESTS;
    delete process.env.BETA_MAX_BACKTEST_HISTORY_DAYS;
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.resetModules();
  });

  it("uses defaults when no env vars are set", async () => {
    const { BETA_LIMITS } = await import("./beta-limits.config.js");
    expect(BETA_LIMITS.maxConcurrentBacktests).toBe(1);
    expect(BETA_LIMITS.maxBacktestHistoryDays).toBe(90);
  });

  it("reads overrides from environment variables", async () => {
    process.env.BETA_MAX_CONCURRENT_BACKTESTS = "5";
    process.env.BETA_MAX_BACKTEST_HISTORY_DAYS = "180";

    const { BETA_LIMITS } = await import("./beta-limits.config.js");
    expect(BETA_LIMITS.maxConcurrentBacktests).toBe(5);
    expect(BETA_LIMITS.maxBacktestHistoryDays).toBe(180);
  });

  it("falls back to default when env var is empty string", async () => {
    process.env.BETA_MAX_CONCURRENT_BACKTESTS = "";
    process.env.BETA_MAX_BACKTEST_HISTORY_DAYS = "";

    const { BETA_LIMITS } = await import("./beta-limits.config.js");
    expect(BETA_LIMITS.maxConcurrentBacktests).toBe(1);
    expect(BETA_LIMITS.maxBacktestHistoryDays).toBe(90);
  });

  it("falls back to default when env var is not a valid number", async () => {
    process.env.BETA_MAX_CONCURRENT_BACKTESTS = "not-a-number";
    process.env.BETA_MAX_BACKTEST_HISTORY_DAYS = "twelve";

    const { BETA_LIMITS } = await import("./beta-limits.config.js");
    expect(BETA_LIMITS.maxConcurrentBacktests).toBe(1);
    expect(BETA_LIMITS.maxBacktestHistoryDays).toBe(90);
  });
});
