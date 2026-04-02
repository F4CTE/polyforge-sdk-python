import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GasSponsorService } from "./gas-sponsor.service";

// ─── Mock helpers ────────────────────────────────────────────────────────────

function createMockRedis() {
  const client = {
    incrbyfloat: vi.fn().mockResolvedValue("0"),
    expire: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  };
  return {
    get: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue(client),
    _client: client,
  };
}

function createMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    GAS_SPONSOR_ENABLED: "true",
    GAS_DAILY_LIMIT_MATIC: "0.5",
    GAS_SPONSOR_PRIVATE_KEY:
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    NODE_ENV: "development",
    GAS_ESTIMATE_MATIC: "0.002",
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => defaults[key]),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("GasSponsorService", () => {
  let service: GasSponsorService;
  let redis: ReturnType<typeof createMockRedis>;
  let config: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T12:00:00Z"));
    redis = createMockRedis();
    config = createMockConfig();
    service = new GasSponsorService(config as any, redis as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── sponsorGas ──────────────────────────────────────────────────────────────

  describe("sponsorGas", () => {
    it("returns true and records gas when within daily limit", async () => {
      // incrbyfloat returns the NEW total after increment (0.1 + 0.05 = 0.15)
      redis._client.incrbyfloat.mockResolvedValue("0.15");

      const result = await service.sponsorGas("user-1", 0.05);

      expect(result).toBe(true);
      expect(redis._client.incrbyfloat).toHaveBeenCalled();
      expect(redis._client.expire).toHaveBeenCalled();
    });

    it("returns false when daily limit would be exceeded", async () => {
      // incrbyfloat returns a total above the limit (0.53 > 0.5)
      redis._client.incrbyfloat.mockResolvedValue("0.53");

      const result = await service.sponsorGas("user-1", 0.05);

      expect(result).toBe(false);
      // Should rollback the increment
      expect(redis._client.incrbyfloat).toHaveBeenCalledTimes(2); // increment + rollback
    });

    it("returns true when gas cost exactly reaches the limit", async () => {
      redis._client.incrbyfloat.mockResolvedValue("0.5"); // exactly at limit

      const result = await service.sponsorGas("user-1", 0.1);

      expect(result).toBe(true);
    });

    it("handles first gas usage of the day (no existing Redis key)", async () => {
      redis._client.incrbyfloat.mockResolvedValue("0.02"); // first usage, post-increment = gasCost

      const result = await service.sponsorGas("user-1", 0.02);

      expect(result).toBe(true);
      expect(redis._client.incrbyfloat).toHaveBeenCalled();
      expect(redis._client.expire).toHaveBeenCalled();
    });

    it("returns false when sponsor is disabled", async () => {
      config = createMockConfig({ GAS_SPONSOR_ENABLED: "false" });
      service = new GasSponsorService(config as any, redis as any);

      const result = await service.sponsorGas("user-1", 0.01);

      expect(result).toBe(false);
    });

    it("returns false when private key is missing", async () => {
      config = createMockConfig({ GAS_SPONSOR_PRIVATE_KEY: "" });
      service = new GasSponsorService(config as any, redis as any);

      const result = await service.sponsorGas("user-1", 0.01);

      expect(result).toBe(false);
    });
  });

  // ── gasEstimateMatic from env ─────────────────────────────────────────────

  describe("gasEstimateMatic", () => {
    it("reads gas estimate from GAS_ESTIMATE_MATIC env var", () => {
      config = createMockConfig({ GAS_ESTIMATE_MATIC: "0.005" });
      service = new GasSponsorService(config as any, redis as any);

      expect(service.gasEstimateMatic).toBe(0.005);
    });

    it("defaults to 0.002 when GAS_ESTIMATE_MATIC is not set", () => {
      const configWithoutGas = createMockConfig();
      // Remove the key to test default
      configWithoutGas.get.mockImplementation((key: string) => {
        const defaults: Record<string, string> = {
          GAS_SPONSOR_ENABLED: "true",
          GAS_DAILY_LIMIT_MATIC: "0.5",
          GAS_SPONSOR_PRIVATE_KEY: "0xdeadbeef",
          NODE_ENV: "development",
        };
        return defaults[key];
      });
      service = new GasSponsorService(configWithoutGas as any, redis as any);

      expect(service.gasEstimateMatic).toBe(0.002);
    });

    it("parses string value to float", () => {
      config = createMockConfig({ GAS_ESTIMATE_MATIC: "0.0035" });
      service = new GasSponsorService(config as any, redis as any);

      expect(service.gasEstimateMatic).toBe(0.0035);
    });
  });

  // ── getUsageStats ───────────────────────────────────────────────────────────

  describe("getUsageStats", () => {
    it("returns correct spent/limit/remaining when usage exists", async () => {
      redis.get.mockResolvedValue("0.3");

      const stats = await service.getUsageStats("user-1");

      expect(stats).toEqual({
        userId: "user-1",
        todayUsage: 0.3,
        dailyLimit: 0.5,
        remaining: 0.2,
        sponsorEnabled: true,
      });
    });

    it("returns 0 spent when no Redis key exists", async () => {
      redis.get.mockResolvedValue(null);

      const stats = await service.getUsageStats("user-1");

      expect(stats.todayUsage).toBe(0);
      expect(stats.remaining).toBe(0.5);
    });

    it("clamps remaining to 0 when usage exceeds limit", async () => {
      redis.get.mockResolvedValue("0.7");

      const stats = await service.getUsageStats("user-1");

      expect(stats.remaining).toBe(0);
    });

    it("reflects disabled state when GAS_SPONSOR_ENABLED=false", async () => {
      config = createMockConfig({ GAS_SPONSOR_ENABLED: "false" });
      service = new GasSponsorService(config as any, redis as any);

      const stats = await service.getUsageStats("user-1");

      expect(stats.sponsorEnabled).toBe(false);
    });
  });

  // ── isActive ────────────────────────────────────────────────────────────────

  describe("isActive", () => {
    it("returns true when enabled and private key is set", () => {
      expect(service.isActive()).toBe(true);
    });

    it("returns false when GAS_SPONSOR_ENABLED=false", () => {
      config = createMockConfig({ GAS_SPONSOR_ENABLED: "false" });
      service = new GasSponsorService(config as any, redis as any);

      expect(service.isActive()).toBe(false);
    });

    it("returns false when private key is empty", () => {
      config = createMockConfig({ GAS_SPONSOR_PRIVATE_KEY: "" });
      service = new GasSponsorService(config as any, redis as any);

      expect(service.isActive()).toBe(false);
    });
  });

  // ── Daily key format ────────────────────────────────────────────────────────

  describe("Redis key format", () => {
    it("uses YYYY-MM-DD date string in the key", async () => {
      redis._client.incrbyfloat.mockResolvedValue("0.01");

      await service.sponsorGas("user-42", 0.01);

      expect(redis._client.incrbyfloat).toHaveBeenCalledWith(
        "gas:spent:user-42:2026-03-24",
        0.01,
      );
    });

    it("uses a different key on a different day", async () => {
      vi.setSystemTime(new Date("2026-01-15T08:00:00Z"));
      redis._client.incrbyfloat.mockResolvedValue("0.01");

      await service.sponsorGas("user-42", 0.01);

      expect(redis._client.incrbyfloat).toHaveBeenCalledWith(
        "gas:spent:user-42:2026-01-15",
        0.01,
      );
    });
  });

  // ── getSponsorAddress ───────────────────────────────────────────────────────

  describe("getSponsorAddress", () => {
    it("returns placeholder address in dev mode", () => {
      const address = service.getSponsorAddress();

      expect(address).toBe("0x00000000000000000000000000000000GasSponsor");
    });

    it("returns null when sponsor is inactive", () => {
      config = createMockConfig({ GAS_SPONSOR_ENABLED: "false" });
      service = new GasSponsorService(config as any, redis as any);

      expect(service.getSponsorAddress()).toBeNull();
    });
  });

  // ── Gas sponsor with exactly-at-limit usage ────────────────────────────────

  describe("sponsorGas — boundary conditions", () => {
    it("returns false when spent exactly equals the daily limit (no room for more)", async () => {
      // Post-increment total 0.51 exceeds the 0.5 limit
      redis._client.incrbyfloat.mockResolvedValue("0.51");

      const result = await service.sponsorGas("user-1", 0.01);

      expect(result).toBe(false);
    });

    it("returns true when spending exactly reaches the limit", async () => {
      redis._client.incrbyfloat.mockResolvedValue("0.45");

      const result = await service.sponsorGas("user-1", 0.05);
      // 0.45 + 0.05 = 0.50 which equals the limit (should be allowed)
      expect(result).toBe(true);
    });

    it("handles very small gas amounts", async () => {
      redis._client.incrbyfloat.mockResolvedValue("0.0");

      const result = await service.sponsorGas("user-1", 0.001);

      expect(result).toBe(true);
    });
  });

  // ── Redis connection failure ────────────────────────────────────────────────

  describe("sponsorGas — Redis failure", () => {
    it("propagates error when Redis incrbyfloat fails", async () => {
      redis._client.incrbyfloat.mockRejectedValue(
        new Error("Redis connection refused"),
      );

      await expect(service.sponsorGas("user-1", 0.01)).rejects.toThrow(
        "Redis connection refused",
      );
    });

    it("getUsageStats propagates error when Redis get fails", async () => {
      redis.get.mockRejectedValue(new Error("Redis connection refused"));

      await expect(service.getUsageStats("user-1")).rejects.toThrow(
        "Redis connection refused",
      );
    });
  });
});
