import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BuilderService } from "./builder.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    order: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { size: null },
        _count: { id: 0 },
      }),
    },
    strategy: {
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: (key: string) => overrides[key] ?? undefined,
  } as any;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("BuilderService", () => {
  let service: BuilderService;
  let prisma: ReturnType<typeof makePrisma>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BuilderService(prisma as any, makeConfig({
      BUILDER_API_URL: "http://builder:3099",
      POLY_BUILDER_API_KEY: "test-key",
      POLY_BUILDER_SECRET: "test-secret",
      POLY_BUILDER_PASSPHRASE: "test-pass",
    }));
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("returns all expected fields", async () => {
      const result = await service.getStats();

      expect(result).toHaveProperty("attributedVolumeUsdc");
      expect(result).toHaveProperty("totalOrders");
      expect(result).toHaveProperty("activeStrategies");
      expect(result).toHaveProperty("connectedUsers");
      expect(result).toHaveProperty("currentTier");
      expect(result).toHaveProperty("weeklyRewardUsdc");
    });

    it("returns zero attributedVolumeUsdc when _sum.size is null", async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { size: null },
        _count: { id: 0 },
      });

      const result = await service.getStats();

      expect(result.attributedVolumeUsdc).toBe(0);
    });

    it("returns the actual sum when orders exist", async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { size: 12345.67 },
        _count: { id: 42 },
      });

      const result = await service.getStats();

      expect(result.attributedVolumeUsdc).toBe(12345.67);
      expect(result.totalOrders).toBe(42);
    });

    it("returns correct activeStrategies count", async () => {
      prisma.strategy.count.mockResolvedValue(7);

      const result = await service.getStats();

      expect(result.activeStrategies).toBe(7);
    });

    it("returns correct connectedUsers count", async () => {
      prisma.user.count.mockResolvedValue(33);

      const result = await service.getStats();

      expect(result.connectedUsers).toBe(33);
    });

    it("aggregates only CONFIRMED orders with a strategyId", async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { size: 0 },
        _count: { id: 0 },
      });

      await service.getStats();

      const call = prisma.order.aggregate.mock.calls[0][0];
      expect(call.where.status).toBe("CONFIRMED");
      expect(call.where.strategyId).toEqual({ not: null });
    });

    it("counts only RUNNING strategies", async () => {
      prisma.strategy.count.mockResolvedValue(0);

      await service.getStats();

      const call = prisma.strategy.count.mock.calls[0][0];
      expect(call.where.status).toBe("RUNNING");
    });

    it("counts only polymarketConnected, non-suspended, non-deleted users", async () => {
      prisma.user.count.mockResolvedValue(0);

      await service.getStats();

      const call = prisma.user.count.mock.calls[0][0];
      expect(call.where.polymarketConnected).toBe(true);
      expect(call.where.suspended).toBe(false);
      expect(call.where.deleted).toBe(false);
    });

    it("returns totalOrders as 0 when no confirmed orders exist", async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { size: null },
        _count: { id: 0 },
      });

      const result = await service.getStats();

      expect(result.totalOrders).toBe(0);
    });
  });

  // ── fetchBuilderData ────────────────────────────────────────────────────

  describe("fetchBuilderData", () => {
    it("fetches trades from Polymarket Builder API", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          trades: [],
          totalVolume: 300_000,
          tier: "VERIFIED",
          weeklyRewardUsdc: 150,
        }),
      });

      const result = await service.fetchBuilderData();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://builder:3099/builder-trades",
      );
      expect(result.currentTier).toBeDefined();
      expect(result.weeklyRewardUsdc).toBe(150);
    });

    it("uses tier from API response when available", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          trades: [],
          totalVolume: 1_500_000,
          tier: "VERIFIED",
          weeklyRewardUsdc: 500,
        }),
      });

      const result = await service.fetchBuilderData();

      expect(result.currentTier).toBe("VERIFIED");
    });

    it("handles API failure and falls back to local data", async () => {
      fetchSpy.mockRejectedValue(new Error("network error"));

      prisma.order.aggregate.mockResolvedValue({
        _sum: { size: 75_000 },
      });

      const result = await service.fetchBuilderData();

      // Should not throw — falls back to env BUILDER_TIER or default
      expect(result.currentTier).toBeDefined();
      expect(typeof result.weeklyRewardUsdc === 'number' || result.weeklyRewardUsdc === null).toBe(true);
    });

    it("handles non-OK response and falls back to local data", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
      });

      prisma.order.aggregate.mockResolvedValue({
        _sum: { size: null },
      });

      const result = await service.fetchBuilderData();

      expect(result.currentTier).toBeDefined();
    });
  });

  // ── getStats with builder API ───────────────────────────────────────────

  describe("getStats with builder API", () => {
    it("populates currentTier and weeklyRewardUsdc from API", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          trades: [],
          totalVolume: 100_000,
          tier: "VERIFIED",
          weeklyRewardUsdc: 50,
        }),
      });

      const result = await service.getStats();

      expect(result.currentTier).toBe("VERIFIED");
      expect(result.weeklyRewardUsdc).toBe(50);
    });
  });
});
