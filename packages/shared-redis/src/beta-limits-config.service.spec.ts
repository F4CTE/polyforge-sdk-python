import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BetaLimitsConfigService } from "./beta-limits-config.service";
import { BETA_LIMITS_KEY, betaLimitFieldKey } from "./beta-limits-config.types";

function makeRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    getJson: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    setJson: vi.fn().mockResolvedValue(undefined),
  };
}

describe("BetaLimitsConfigService", () => {
  let service: BetaLimitsConfigService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    service = new BetaLimitsConfigService(redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAllLimits", () => {
    it("returns env defaults when Redis is empty", async () => {
      redis.getJson.mockResolvedValue(null);

      const limits = await service.getAllLimits();

      expect(limits.maxActiveStrategies).toBeGreaterThan(0);
      expect(limits.maxConcurrentBacktests).toBeGreaterThan(0);
      expect(limits.maxBacktestHistoryDays).toBeGreaterThan(0);
      expect(limits.maxMonthlyVolumeUsdc).toBeGreaterThan(0);
      expect(limits.maxPositionSizeUsdc).toBeGreaterThan(0);
      expect(limits.marketDataRateLimitPerMinute).toBeGreaterThan(0);
      expect(limits.maxMarketplaceListings).toBeGreaterThan(0);
      expect(limits.maxDailyStrategyExecutions).toBeGreaterThan(0);
    });

    it("merges Redis overrides with env defaults", async () => {
      redis.getJson.mockResolvedValue({
        maxActiveStrategies: 10,
        maxMarketplaceListings: 5,
      });

      const limits = await service.getAllLimits();

      expect(limits.maxActiveStrategies).toBe(10);
      expect(limits.maxMarketplaceListings).toBe(5);
      expect(limits.maxConcurrentBacktests).toBeGreaterThan(0);
    });

    it("reads from the config:beta_limits key", async () => {
      redis.getJson.mockResolvedValue(null);

      await service.getAllLimits();

      expect(redis.getJson).toHaveBeenCalledWith(BETA_LIMITS_KEY);
    });

    it("falls back to env defaults on Redis error", async () => {
      redis.getJson.mockRejectedValue(new Error("ECONNREFUSED"));

      const limits = await service.getAllLimits();

      expect(limits.maxActiveStrategies).toBeGreaterThan(0);
    });
  });

  describe("getLimit", () => {
    it("returns the per-field Redis value when set", async () => {
      redis.get.mockResolvedValue("25");

      const val = await service.getLimit("maxActiveStrategies");

      expect(val).toBe(25);
      expect(redis.get).toHaveBeenCalledWith(
        betaLimitFieldKey("maxActiveStrategies"),
      );
    });

    it("falls back to the JSON blob when field key is null", async () => {
      redis.get.mockResolvedValue(null);
      redis.getJson.mockResolvedValue({ maxActiveStrategies: 42 });

      const val = await service.getLimit("maxActiveStrategies");

      expect(val).toBe(42);
    });

    it("returns env default when neither field nor blob has the value", async () => {
      redis.get.mockResolvedValue(null);
      redis.getJson.mockResolvedValue(null);

      const val = await service.getLimit("maxActiveStrategies");

      expect(val).toBeGreaterThan(0);
    });

    it("returns env default on Redis error", async () => {
      redis.get.mockRejectedValue(new Error("ECONNREFUSED"));

      const val = await service.getLimit("maxActiveStrategies");

      expect(val).toBeGreaterThan(0);
    });
  });

  describe("setLimits", () => {
    it("writes both the full JSON blob and per-field keys", async () => {
      await service.setLimits({ maxActiveStrategies: 7 });

      // Writes the full blob
      expect(redis.setJson).toHaveBeenCalledWith(
        BETA_LIMITS_KEY,
        expect.objectContaining({ maxActiveStrategies: 7 }),
      );

      // Writes the per-field key
      expect(redis.set).toHaveBeenCalledWith(
        betaLimitFieldKey("maxActiveStrategies"),
        "7",
      );
    });

    it("returns the merged limits after update", async () => {
      redis.getJson.mockResolvedValue({ maxActiveStrategies: 3 });

      const result = await service.setLimits({ maxConcurrentBacktests: 5 });

      expect(result.maxActiveStrategies).toBe(3);
      expect(result.maxConcurrentBacktests).toBe(5);
    });

    it("preserves existing values not included in the update", async () => {
      redis.getJson.mockResolvedValue({
        maxActiveStrategies: 10,
        maxConcurrentBacktests: 4,
      });

      await service.setLimits({ maxActiveStrategies: 20 });

      const setJsonCall = redis.setJson.mock.calls[0];
      expect(setJsonCall[1].maxConcurrentBacktests).toBe(4);
      expect(setJsonCall[1].maxActiveStrategies).toBe(20);
    });
  });
});
