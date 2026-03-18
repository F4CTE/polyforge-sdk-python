import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CacheAdminService } from "./cache.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRedisClient(overrides: Record<string, unknown> = {}) {
  return {
    info: vi
      .fn()
      .mockResolvedValue(
        "used_memory_human:1.50M\r\nused_memory_peak_human:2.00M\r\n",
      ),
    scan: vi.fn().mockResolvedValue(["0", []]),
    dbsize: vi.fn().mockResolvedValue(100),
    del: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeRedis(client = makeRedisClient()) {
  return {
    getClient: vi.fn().mockReturnValue(client),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("CacheAdminService", () => {
  let service: CacheAdminService;
  let redis: ReturnType<typeof makeRedis>;
  let client: ReturnType<typeof makeRedisClient>;

  beforeEach(() => {
    client = makeRedisClient();
    redis = makeRedis(client);
    service = new CacheAdminService(redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("returns memoryUsed from the info output", async () => {
      const result = await service.getStats();

      expect(result.memoryUsed).toBe("1.50M");
    });

    it("returns memoryPeak from the info output", async () => {
      const result = await service.getStats();

      expect(result.memoryPeak).toBe("2.00M");
    });

    it("returns totalKeys from dbsize", async () => {
      client.dbsize.mockResolvedValue(250);

      const result = await service.getStats();

      expect(result.totalKeys).toBe(250);
    });

    it("returns keysByPrefix record", async () => {
      const result = await service.getStats();

      expect(result.keysByPrefix).toBeDefined();
      expect(typeof result.keysByPrefix).toBe("object");
    });

    it('calls info with "memory" argument', async () => {
      await service.getStats();

      expect(client.info).toHaveBeenCalledWith("memory");
    });

    it("handles missing memory fields gracefully (returns undefined)", async () => {
      client.info.mockResolvedValue("# Memory\r\n");

      const result = await service.getStats();

      expect(result.memoryUsed).toBeUndefined();
      expect(result.memoryPeak).toBeUndefined();
    });

    it("counts keys for each of the 5 known prefixes", async () => {
      // Each scan call returns 2 keys, cursor terminates immediately
      client.scan.mockResolvedValue(["0", ["k1", "k2"]]);

      const result = await service.getStats();

      // 5 prefixes × 2 keys each
      const totalPrefixKeys = Object.values(result.keysByPrefix).reduce(
        (a, b) => a + b,
        0,
      );
      expect(totalPrefixKeys).toBe(10);
    });

    it("accumulates across multiple scan pages per prefix", async () => {
      // First call returns cursor '42' (not done), second returns '0' (done)
      client.scan
        .mockResolvedValueOnce(["42", ["k1", "k2"]])
        .mockResolvedValueOnce(["0", ["k3"]])
        // Remaining 4 prefixes: each single scan returning empty
        .mockResolvedValue(["0", []]);

      const result = await service.getStats();

      // First prefix has 3 keys across 2 pages
      const values = Object.values(result.keysByPrefix);
      expect(values[0]).toBe(3);
    });
  });

  // ── flushPattern ──────────────────────────────────────────────────────────

  describe("flushPattern", () => {
    it("returns keysDeleted: 0 for non-cache: patterns without touching Redis", async () => {
      const result = await service.flushPattern("health:*");

      expect(result).toEqual({ keysDeleted: 0 });
      expect(client.scan).not.toHaveBeenCalled();
      expect(client.del).not.toHaveBeenCalled();
    });

    it("rejects patterns not starting with cache:", async () => {
      const result = await service.flushPattern("invite:*");

      expect(result.keysDeleted).toBe(0);
    });

    it("returns keysDeleted: 0 when no matching keys exist", async () => {
      client.scan.mockResolvedValue(["0", []]);

      const result = await service.flushPattern("cache:price:*");

      expect(result).toEqual({ keysDeleted: 0 });
    });

    it("deletes matching keys and returns the count", async () => {
      client.scan.mockResolvedValueOnce([
        "0",
        ["cache:price:ETH", "cache:price:BTC"],
      ]);

      const result = await service.flushPattern("cache:price:*");

      expect(result.keysDeleted).toBe(2);
      expect(client.del).toHaveBeenCalledWith(
        "cache:price:ETH",
        "cache:price:BTC",
      );
    });

    it("accumulates deleted keys across multiple scan pages", async () => {
      client.scan
        .mockResolvedValueOnce(["99", ["cache:price:A", "cache:price:B"]])
        .mockResolvedValueOnce(["0", ["cache:price:C"]]);

      const result = await service.flushPattern("cache:price:*");

      expect(result.keysDeleted).toBe(3);
    });

    it("does not call del when scan returns empty keys page", async () => {
      client.scan.mockResolvedValue(["0", []]);

      await service.flushPattern("cache:book:*");

      expect(client.del).not.toHaveBeenCalled();
    });

    it("allows cache:market: prefix pattern", async () => {
      client.scan.mockResolvedValueOnce(["0", ["cache:market:1"]]);

      const result = await service.flushPattern("cache:market:*");

      expect(result.keysDeleted).toBe(1);
    });
  });
});
