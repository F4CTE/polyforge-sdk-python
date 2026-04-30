import { afterEach, describe, expect, it, vi } from "vitest";

describe("BETA_LIMITS", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("uses the beta market-data limit outside CI", async () => {
    delete process.env.CI;
    delete process.env.BETA_MARKET_DATA_RATE_LIMIT;

    const { BETA_LIMITS } = await import("./beta-limits.config.js");

    expect(BETA_LIMITS.marketDataRateLimitPerMinute).toBe(100);
  });

  it("uses a permissive market-data limit in CI when no explicit override is set", async () => {
    process.env.CI = "true";
    delete process.env.BETA_MARKET_DATA_RATE_LIMIT;

    const { BETA_LIMITS } = await import("./beta-limits.config.js");

    expect(BETA_LIMITS.marketDataRateLimitPerMinute).toBe(10_000);
  });

  it("honors an explicit market-data limit override in CI", async () => {
    process.env.CI = "true";
    process.env.BETA_MARKET_DATA_RATE_LIMIT = "250";

    const { BETA_LIMITS } = await import("./beta-limits.config.js");

    expect(BETA_LIMITS.marketDataRateLimitPerMinute).toBe(250);
  });
});
