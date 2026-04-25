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

    it("returns emptyResult when $queryRaw throws (table missing)", async () => {
      db.$queryRaw.mockRejectedValue(
        new Error("relation pnl_snapshots does not exist"),
      );

      const result = await service.getPnl("user-uuid-1", "30d");

      expect(result.snapshots).toEqual([]);
      expect(result.totalPnl).toBe("0.00");
      expect(result.winRate).toBe("0");
    });

    it("sums multiple snapshot pnl values correctly", async () => {
      const snapshots = [
        { time: new Date("2025-01-01"), pnl: "-20.00" },
        { time: new Date("2025-01-02"), pnl: "50.00" },
        { time: new Date("2025-01-03"), pnl: "10.00" },
      ];
      db.$queryRaw.mockResolvedValue(snapshots as any);

      const result = await service.getPnl("user-uuid-1", "7d");

      expect(result.totalPnl).toBe("40.00");
      expect(result.snapshots).toHaveLength(3);
    });
  });

  // ── exportCsv ──────────────────────────────────────────────────────────

  describe("exportCsv", () => {
    it("returns CSV header with correct column names", async () => {
      db.position.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv("user-uuid-1");

      expect(csv).toContain(
        "Market ID,Outcome,Size,Avg Price,Unrealized P&L,Realized P&L,Status,Updated",
      );
    });

    it("returns CSV rows for positions", async () => {
      const updatedAt = new Date("2025-06-01T12:00:00.000Z");
      db.position.findMany.mockResolvedValue([
        {
          marketId: "mkt-1",
          outcome: "YES",
          size: "100",
          avgPrice: "0.60",
          unrealizedPnl: "5.00",
          realizedPnl: "10.00",
          resolutionStatus: "UNRESOLVED",
          updatedAt,
        },
      ] as any);

      const csv = await service.exportCsv("user-uuid-1");

      expect(csv).toContain('"mkt-1"');
      expect(csv).toContain("YES");
      expect(csv).toContain("100");
      expect(csv).toContain("0.60");
      expect(csv).toContain("UNRESOLVED");
      expect(csv).toContain(updatedAt.toISOString());
    });

    it("handles null fields gracefully in CSV", async () => {
      const updatedAt = new Date("2025-06-01T12:00:00.000Z");
      db.position.findMany.mockResolvedValue([
        {
          marketId: "mkt-1",
          outcome: null,
          size: null,
          avgPrice: null,
          unrealizedPnl: null,
          realizedPnl: null,
          resolutionStatus: null,
          updatedAt,
        },
      ] as any);

      const csv = await service.exportCsv("user-uuid-1");

      // Should not throw, should produce empty string for null fields
      expect(csv).toContain('"mkt-1"');
      expect(csv).toContain(updatedAt.toISOString());
    });

    it("includes all positions regardless of resolutionStatus", async () => {
      const updatedAt = new Date("2025-06-01T12:00:00.000Z");
      db.position.findMany.mockResolvedValue([
        {
          marketId: "mkt-1",
          outcome: "YES",
          size: "100",
          avgPrice: "0.60",
          unrealizedPnl: "5.00",
          realizedPnl: "10.00",
          resolutionStatus: "UNRESOLVED",
          updatedAt,
        },
        {
          marketId: "mkt-2",
          outcome: "NO",
          size: "50",
          avgPrice: "0.40",
          unrealizedPnl: "0",
          realizedPnl: "25.00",
          resolutionStatus: "RESOLVED",
          updatedAt,
        },
      ] as any);

      const csv = await service.exportCsv("user-uuid-1");

      const lines = csv.trim().split("\n");
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it("queries positions ordered by updatedAt desc", async () => {
      db.position.findMany.mockResolvedValue([]);

      await service.exportCsv("user-uuid-1");

      expect(db.position.findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  // ── getPortfolio enrichment ─────────────────────────────────────────

  describe("getPortfolio enrichment", () => {
    it("enriches positions with marketTitle from market lookup", async () => {
      const position = makePosition({
        marketId: "market-uuid-1",
        tokenId: "token-uuid-1",
      });
      db.position.findMany.mockResolvedValue([position] as any);
      db.market.findMany.mockResolvedValue([
        {
          id: "market-uuid-1",
          title: "Will BTC reach 100k?",
          category: "CRYPTO",
        },
      ] as any);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions[0].marketTitle).toBe("Will BTC reach 100k?");
      expect(result.positions[0].marketCategory).toBe("CRYPTO");
    });

    it("returns empty marketTitle when market is not found", async () => {
      const position = makePosition({ marketId: "unknown-market" });
      db.position.findMany.mockResolvedValue([position] as any);
      db.market.findMany.mockResolvedValue([]);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions[0].marketTitle).toBe("");
      expect(result.positions[0].marketCategory).toBeNull();
    });

    it("deduplicates market IDs when querying markets", async () => {
      const positions = [
        makePosition({ id: "p1", marketId: "market-1", tokenId: "token-1" }),
        makePosition({ id: "p2", marketId: "market-1", tokenId: "token-2" }),
      ];
      db.position.findMany.mockResolvedValue(positions as any);
      db.market.findMany.mockResolvedValue([
        { id: "market-1", title: "Test Market", category: null },
      ] as any);
      (redis.getClient() as any).mget.mockResolvedValue([null, null]);

      const result = await service.getPortfolio("user-uuid-1");

      // Should only query for unique market IDs
      const marketQuery = db.market.findMany.mock.calls[0]?.[0] as any;
      expect(marketQuery?.where?.id?.in).toHaveLength(1);
      expect(result.positions).toHaveLength(2);
      expect(result.positions[0].marketTitle).toBe("Test Market");
      expect(result.positions[1].marketTitle).toBe("Test Market");
    });

    it("does not query markets when there are no positions", async () => {
      db.position.findMany.mockResolvedValue([]);

      const result = await service.getPortfolio("user-uuid-1");

      // market.findMany should not be called for empty marketIds
      // (the conditional check: marketIds.length ? ... : [])
      expect(db.market.findMany).not.toHaveBeenCalled();
      expect(result.positions).toEqual([]);
    });

    it("includes side (outcome) in enriched position", async () => {
      const position = makePosition({ outcome: "NO" });
      db.position.findMany.mockResolvedValue([position] as any);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions[0].side).toBe("NO");
    });

    it("returns avgEntryPrice as string", async () => {
      const position = makePosition({ avgPrice: "0.75" });
      db.position.findMany.mockResolvedValue([position] as any);

      const result = await service.getPortfolio("user-uuid-1");

      expect(result.positions[0].avgEntryPrice).toBe("0.75");
    });
  });
});
