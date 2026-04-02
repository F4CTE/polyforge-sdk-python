import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PortfolioService } from "./portfolio.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Factories ────────────────────────────────────────────────────────────────

function makePosition(overrides: Record<string, unknown> = {}) {
  return {
    id: "position-uuid-1",
    userId: "user-uuid-1",
    marketId: "market-uuid-1",
    tokenId: "token-uuid-1",
    outcome: "YES",
    size: "100.00",
    avgPrice: "0.60",
    realizedPnl: "10.00",
    resolutionStatus: "UNRESOLVED",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PortfolioService", () => {
  let service: PortfolioService;
  let db: MockDb;
  let redis: RedisService;

  beforeEach(() => {
    db = createMockDb();
    redis = {
      get: vi.fn().mockResolvedValue(null),
      getClient: vi.fn().mockReturnValue({
        mget: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as RedisService;
    service = new PortfolioService(db as any, redis);
    // Default: no markets found (positions will have empty marketTitle)
    db.market.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getPortfolio ──────────────────────────────────────────────────────────

  describe("getPortfolio", () => {
    it("returns positions, totalUnrealizedPnl and totalRealizedPnl", async () => {
      db.position.findMany.mockResolvedValue([makePosition()] as any);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions).toHaveLength(1);
      expect(result.totalUnrealizedPnl).toBeDefined();
      expect(result.totalRealizedPnl).toBeDefined();
    });

    it("queries only UNRESOLVED positions", async () => {
      db.position.findMany.mockResolvedValue([]);

      await service.getPortfolio("user-uuid-1");

      expect(db.position.findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1", resolutionStatus: "UNRESOLVED" },
      });
    });

    it("enriches each position with current price from Redis cache", async () => {
      const position = makePosition({
        tokenId: "token-uuid-1",
        avgPrice: "0.50",
        size: "100.00",
      });
      db.position.findMany.mockResolvedValue([position] as any);
      (redis.getClient() as any).mget.mockResolvedValue([
        JSON.stringify({ price: "0.70" }),
      ]);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions[0].currentPrice).toBe("0.700000");
    });

    it("uses 0 as currentPrice when Redis cache is missing", async () => {
      const position = makePosition({ avgPrice: "0.60", size: "100.00" });
      db.position.findMany.mockResolvedValue([position] as any);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getPortfolio("user-uuid-1");

      // currentPrice=0, avgPrice=0.60, size=100 → unrealizedPnl = (0 - 0.60)*100 = -60
      expect(result.positions[0].currentPrice).toBe("0.000000");
      expect(parseFloat(result.positions[0].unrealizedPnl)).toBeLessThan(0);
    });

    it("reads prices from Redis via batch MGET", async () => {
      const position = makePosition({ tokenId: "token-abc" });
      db.position.findMany.mockResolvedValue([position] as any);

      await service.getPortfolio("user-uuid-1");

      expect(redis.getClient().mget).toHaveBeenCalledWith(
        "cache:price:token-abc",
      );
    });

    it("calculates unrealizedPnl as (currentPrice - avgEntry) * size", async () => {
      const position = makePosition({
        avgPrice: "0.50",
        size: "200.00",
        tokenId: "token-uuid-1",
      });
      db.position.findMany.mockResolvedValue([position] as any);
      (redis.getClient() as any).mget.mockResolvedValue([
        JSON.stringify({ price: "0.80" }),
      ]);

      const result = await service.getPortfolio("user-uuid-1");

      // (0.80 - 0.50) * 200 = 60
      expect(parseFloat(result.positions[0].unrealizedPnl)).toBeCloseTo(60, 4);
    });

    it("accumulates totalUnrealizedPnl across all positions", async () => {
      const positions = [
        makePosition({
          id: "p1",
          tokenId: "token-1",
          avgPrice: "0.50",
          size: "100.00",
          realizedPnl: "0",
        }),
        makePosition({
          id: "p2",
          tokenId: "token-2",
          avgPrice: "0.40",
          size: "50.00",
          realizedPnl: "0",
        }),
      ];
      db.position.findMany.mockResolvedValue(positions as any);
      // MGET returns values in the same order as keys
      (redis.getClient() as any).mget.mockResolvedValue([
        JSON.stringify({ price: "0.70" }), // token-1
        JSON.stringify({ price: "0.60" }), // token-2
      ]);

      const result = await service.getPortfolio("user-uuid-1");

      // pos1: (0.70 - 0.50) * 100 = 20; pos2: (0.60 - 0.40) * 50 = 10; total = 30
      expect(parseFloat(result.totalUnrealizedPnl)).toBeCloseTo(30, 4);
    });

    it("accumulates totalRealizedPnl from position.realizedPnl", async () => {
      const positions = [
        makePosition({ id: "p1", tokenId: "token-1", realizedPnl: "15.50" }),
        makePosition({ id: "p2", tokenId: "token-2", realizedPnl: "4.50" }),
      ];
      db.position.findMany.mockResolvedValue(positions as any);
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getPortfolio("user-uuid-1");

      expect(parseFloat(result.totalRealizedPnl)).toBeCloseTo(20, 4);
    });

    it("returns empty positions array when user has no open positions", async () => {
      db.position.findMany.mockResolvedValue([]);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions).toEqual([]);
      expect(result.totalUnrealizedPnl).toBe("0.000000");
      expect(result.totalRealizedPnl).toBe("0.000000");
    });

    it("includes resolutionStatus in each enriched position", async () => {
      db.position.findMany.mockResolvedValue([makePosition()] as any);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions[0].resolutionStatus).toBe("UNRESOLVED");
    });
  });

  // ── getPnl ────────────────────────────────────────────────────────────────

  describe("getPnl", () => {
    it("returns snapshots, totalPnl and winRate", async () => {
      const snapshots = [
        { time: new Date("2025-01-01"), pnl: "50.00" },
        { time: new Date("2025-01-02"), pnl: "25.00" },
      ];
      db.$queryRaw.mockResolvedValue(snapshots as any);

      const result = await service.getPnl("user-uuid-1", "30d");

      expect(result.snapshots).toHaveLength(2);
      expect(result.totalPnl).toBe("75.00");
      expect(result.winRate).toBe("0");
    });

    it("maps snapshot time and pnl to strings", async () => {
      const time = new Date("2025-01-01");
      db.$queryRaw.mockResolvedValue([{ time, pnl: "10" }] as any);

      const result = await service.getPnl("user-uuid-1", "30d");

      expect(result.snapshots[0].time).toBe(time);
      expect(result.snapshots[0].pnl).toBe("10");
    });

    it("handles null pnl in snapshot gracefully", async () => {
      db.$queryRaw.mockResolvedValue([{ time: new Date(), pnl: null }] as any);

      const result = await service.getPnl("user-uuid-1", "30d");

      expect(result.snapshots[0].pnl).toBe("0");
      expect(result.totalPnl).toBe("0.00");
    });

    it('returns empty snapshots and totalPnl "0.00" when no data', async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      const result = await service.getPnl("user-uuid-1", "30d");

      expect(result.snapshots).toEqual([]);
      expect(result.totalPnl).toBe("0.00");
    });

    it("uses 7d period window", async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      await service.getPnl("user-uuid-1", "7d");

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("uses 90d period window", async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      await service.getPnl("user-uuid-1", "90d");

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("uses allTime period (epoch 0 start)", async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      await service.getPnl("user-uuid-1", "allTime");

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("defaults to 30d window for unknown period values", async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      await service.getPnl("user-uuid-1", "some-unknown-period");

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("queries with strategyId when provided", async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      await service.getPnl("user-uuid-1", "30d", "strategy-uuid-1");

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("queries without strategyId when not provided", async () => {
      db.$queryRaw.mockResolvedValue([] as any);

      await service.getPnl("user-uuid-1", "30d");

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });
  });
});
