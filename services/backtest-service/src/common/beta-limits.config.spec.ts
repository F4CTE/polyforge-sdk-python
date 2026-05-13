import { describe, it, expect } from "vitest";
import { BETA_LIMITS_DEFAULTS } from "@polyforge/shared-redis";

describe("BETA_LIMITS config", () => {
  it("uses the agreed beta defaults for backtest-relevant fields", () => {
    expect(BETA_LIMITS_DEFAULTS.maxConcurrentBacktests).toBe(1);
    expect(BETA_LIMITS_DEFAULTS.maxBacktestHistoryDays).toBe(90);
  });

  it("all backtest-relevant keys are positive numbers", () => {
    expect(BETA_LIMITS_DEFAULTS.maxConcurrentBacktests).toBeGreaterThan(0);
    expect(BETA_LIMITS_DEFAULTS.maxBacktestHistoryDays).toBeGreaterThan(0);
    expect(typeof BETA_LIMITS_DEFAULTS.maxConcurrentBacktests).toBe("number");
    expect(typeof BETA_LIMITS_DEFAULTS.maxBacktestHistoryDays).toBe("number");
  });

  it("exports the per-strategy daily execution limit", () => {
    expect(BETA_LIMITS_DEFAULTS.maxDailyStrategyExecutions).toBe(500);
    expect(typeof BETA_LIMITS_DEFAULTS.maxDailyStrategyExecutions).toBe(
      "number",
    );
  });

  it("exports a market-data rate limit appropriate for the environment", () => {
    expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBeGreaterThan(
      0,
    );
    const isCI = process.env.CI === "true";
    if (isCI) {
      expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(10_000);
    } else {
      expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(100);
    }
  });
});
