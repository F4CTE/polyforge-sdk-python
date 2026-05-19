import { describe, expect, it } from "vitest";
import { BETA_LIMITS_DEFAULTS } from "@polyforge/shared-redis";

describe("BETA_LIMITS_DEFAULTS", () => {
  it("uses the beta market-data limit by default", () => {
    expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(100);
  });

  it("all keys are positive numbers", () => {
    expect(BETA_LIMITS_DEFAULTS.maxActiveStrategies).toBeGreaterThan(0);
    expect(BETA_LIMITS_DEFAULTS.maxConcurrentBacktests).toBeGreaterThan(0);
    expect(BETA_LIMITS_DEFAULTS.maxBacktestHistoryDays).toBeGreaterThan(0);
  });
});
