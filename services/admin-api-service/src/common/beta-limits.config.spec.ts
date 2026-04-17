import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("BETA_LIMITS config (envInt)", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    // Reset module cache so the config re-evaluates env vars
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("uses default values when env vars are not set", async () => {
    delete process.env.BETA_MAX_ACTIVE_STRATEGIES;
    delete process.env.BETA_MAX_CONCURRENT_BACKTESTS;

    const { BETA_LIMITS } = await import("./beta-limits.config");

    expect(BETA_LIMITS.maxActiveStrategies).toBe(3);
    expect(BETA_LIMITS.maxConcurrentBacktests).toBe(1);
  });

  it("parses integer env vars correctly", async () => {
    process.env.BETA_MAX_ACTIVE_STRATEGIES = "10";
    process.env.BETA_MAX_CONCURRENT_BACKTESTS = "5";

    const { BETA_LIMITS } = await import("./beta-limits.config");

    expect(BETA_LIMITS.maxActiveStrategies).toBe(10);
    expect(BETA_LIMITS.maxConcurrentBacktests).toBe(5);
  });

  it("falls back to default when env var is empty string", async () => {
    process.env.BETA_MAX_ACTIVE_STRATEGIES = "";

    const { BETA_LIMITS } = await import("./beta-limits.config");

    expect(BETA_LIMITS.maxActiveStrategies).toBe(3);
  });

  it("falls back to default when env var is non-numeric", async () => {
    process.env.BETA_MAX_ACTIVE_STRATEGIES = "not-a-number";

    const { BETA_LIMITS } = await import("./beta-limits.config");

    expect(BETA_LIMITS.maxActiveStrategies).toBe(3);
  });
});
