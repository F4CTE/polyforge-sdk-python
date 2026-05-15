import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BetaLimits } from "@polyforge/shared-redis";
import { BETA_LIMITS_DEFAULTS } from "@polyforge/shared-redis";

describe("BETA_LIMITS_DEFAULTS (envInt)", () => {
  it("all limit keys exist and are positive numbers", () => {
    const keys: (keyof BetaLimits)[] = [
      "maxActiveStrategies",
      "maxConcurrentBacktests",
      "maxBacktestHistoryDays",
      "maxMonthlyVolumeUsdc",
      "maxPositionSizeUsdc",
      "marketDataRateLimitPerMinute",
      "maxMarketplaceListings",
      "maxDailyStrategyExecutions",
    ];
    for (const key of keys) {
      expect(BETA_LIMITS_DEFAULTS[key]).toBeGreaterThan(0);
      expect(typeof BETA_LIMITS_DEFAULTS[key]).toBe("number");
    }
  });

  it("uses known defaults matching the agreed beta limits", () => {
    expect(BETA_LIMITS_DEFAULTS.maxActiveStrategies).toBe(3);
    expect(BETA_LIMITS_DEFAULTS.maxConcurrentBacktests).toBe(1);
    expect(BETA_LIMITS_DEFAULTS.maxBacktestHistoryDays).toBe(90);
    expect(BETA_LIMITS_DEFAULTS.maxMonthlyVolumeUsdc).toBe(5000);
    expect(BETA_LIMITS_DEFAULTS.maxPositionSizeUsdc).toBe(500);
    expect(BETA_LIMITS_DEFAULTS.maxMarketplaceListings).toBe(2);
    expect(BETA_LIMITS_DEFAULTS.maxDailyStrategyExecutions).toBe(500);
  });

  it("exposes marketDataRateLimitPerMinute (100 outside CI, 10000 in CI)", () => {
    const inCI = process.env.CI === "true";
    if (inCI) {
      expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(10_000);
    } else {
      expect(BETA_LIMITS_DEFAULTS.marketDataRateLimitPerMinute).toBe(100);
    }
  });
});
