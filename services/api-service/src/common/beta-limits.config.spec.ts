import { describe, expect, it } from "vitest";
import { BETA_LIMITS_DEFAULTS } from "@polyforge/shared-redis";

describe("BETA_LIMITS_DEFAULTS", () => {
  it("uses the beta market-data limit outside CI", () => {
    const inCI = process.env.CI === "true";
    if (inCI) {
      // Running in CI — verify permissive limit
      expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(10_000);
    } else {
      expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(100);
    }
  });

  it("all keys are positive numbers", () => {
    expect(BETA_LIMITS_DEFAULTS.maxActiveStrategies).toBeGreaterThan(0);
    expect(BETA_LIMITS_DEFAULTS.maxConcurrentBacktests).toBeGreaterThan(0);
    expect(BETA_LIMITS_DEFAULTS.maxBacktestHistoryDays).toBeGreaterThan(0);
  });
});
