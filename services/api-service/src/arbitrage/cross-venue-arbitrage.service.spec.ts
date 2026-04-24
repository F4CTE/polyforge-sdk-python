import { describe, it, expect, beforeEach, vi } from "vitest";
import { CrossVenueArbitrageService } from "./cross-venue-arbitrage.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    polymarketId: "poly-1",
    kalshiId: "kalshi-1",
    confidence: 0.85,
    matchMethod: "auto_tfidf",
    verified: false,
    ...overrides,
  };
}

function makeMarket(
  id: string,
  yesPrice: string,
  noPrice: string,
  title = "Test Market",
) {
  return {
    id,
    title,
    category: "Crypto",
    tokens: [
      { id: `${id}-yes`, outcome: "YES", price: yesPrice },
      { id: `${id}-no`, outcome: "NO", price: noPrice },
    ],
  };
}

describe("CrossVenueArbitrageService", () => {
  let service: CrossVenueArbitrageService;
  let db: MockDb;
  let redis: RedisService;
  let mgetFn: ReturnType<typeof vi.fn>;
  let xaddFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    mgetFn = vi.fn().mockResolvedValue([]);
    xaddFn = vi.fn().mockResolvedValue("ok");
    redis = {
      getClient: vi.fn().mockReturnValue({ mget: mgetFn }),
      xadd: xaddFn,
    } as unknown as RedisService;
    service = new CrossVenueArbitrageService(db as any, redis);
  });

  describe("getOpportunities", () => {
    it("returns [] when no matches exist", async () => {
      db.marketMatch.findMany.mockResolvedValue([]);

      const result = await service.getOpportunities();

      expect(result).toEqual([]);
    });

    it("returns opportunity when spread exceeds threshold", async () => {
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "0.40", "0.60", "Bitcoin 100k Polymarket"),
        makeMarket("kalshi-1", "0.50", "0.50", "Bitcoin 100k Kalshi"),
      ] as any);
      mgetFn.mockResolvedValue([null, null, null, null]);

      const result = await service.getOpportunities(5);

      expect(result).toHaveLength(1);
      expect(result[0].spreadPct).toBe(10);
      expect(result[0].direction).toBe("buy_poly_sell_kalshi");
    });

    it("filters out spreads below threshold", async () => {
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "0.49", "0.51"),
        makeMarket("kalshi-1", "0.50", "0.50"),
      ] as any);
      mgetFn.mockResolvedValue([null, null, null, null]);

      const result = await service.getOpportunities(3);

      expect(result).toEqual([]);
    });

    it("uses live Redis prices when available", async () => {
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "0.40", "0.60"),
        makeMarket("kalshi-1", "0.50", "0.50"),
      ] as any);
      mgetFn.mockResolvedValue([
        JSON.stringify({ price: "0.35" }),
        null,
        JSON.stringify({ price: "0.55" }),
        null,
      ]);

      const result = await service.getOpportunities(5);

      expect(result).toHaveLength(1);
      expect(result[0].polymarketYes).toBe(0.35);
      expect(result[0].kalshiYes).toBe(0.55);
      expect(result[0].spreadPct).toBe(20);
    });

    it("sorts by spreadPct descending", async () => {
      db.marketMatch.findMany.mockResolvedValue([
        makeMatch({ id: "m1", polymarketId: "p1", kalshiId: "k1" }),
        makeMatch({ id: "m2", polymarketId: "p2", kalshiId: "k2" }),
      ] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("p1", "0.40", "0.60"),
        makeMarket("k1", "0.50", "0.50"),
        makeMarket("p2", "0.30", "0.70"),
        makeMarket("k2", "0.60", "0.40"),
      ] as any);
      mgetFn.mockResolvedValue(Array(8).fill(null));

      const result = await service.getOpportunities(5);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].spreadPct).toBeGreaterThanOrEqual(result[1].spreadPct);
    });

    it("skips matches where one market is closed", async () => {
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "0.40", "0.60"),
      ] as any);
      mgetFn.mockResolvedValue([null, null]);

      const result = await service.getOpportunities();

      expect(result).toEqual([]);
    });
  });

  describe("getComparison", () => {
    it("returns null for non-existent matchId", async () => {
      db.marketMatch.findUnique.mockResolvedValue(null);

      const result = await service.getComparison("nonexistent");

      expect(result).toBeNull();
    });

    it("returns full comparison with prices", async () => {
      db.marketMatch.findUnique.mockResolvedValue(makeMatch() as any);
      db.market.findUnique
        .mockResolvedValueOnce(
          makeMarket("poly-1", "0.45", "0.55", "Bitcoin Poly") as any,
        )
        .mockResolvedValueOnce(
          makeMarket("kalshi-1", "0.50", "0.50", "Bitcoin Kalshi") as any,
        );
      mgetFn.mockResolvedValue([null, null, null, null]);

      const result = await service.getComparison("match-1");

      expect(result).not.toBeNull();
      expect(result!.matchId).toBe("match-1");
      expect(result!.polymarket.yesPrice).toBe(0.45);
      expect(result!.kalshi.yesPrice).toBe(0.5);
      expect(result!.spreadPct).toBe(5);
    });

    it("returns null if one market not found", async () => {
      db.marketMatch.findUnique.mockResolvedValue(makeMatch() as any);
      db.market.findUnique
        .mockResolvedValueOnce(makeMarket("poly-1", "0.45", "0.55") as any)
        .mockResolvedValueOnce(null);

      const result = await service.getComparison("match-1");

      expect(result).toBeNull();
    });
  });

  describe("getOpportunitiesForMarket", () => {
    it("filters opportunities by marketId", async () => {
      db.marketMatch.findMany.mockResolvedValue([
        makeMatch({ id: "m1", polymarketId: "p1", kalshiId: "k1" }),
        makeMatch({ id: "m2", polymarketId: "p2", kalshiId: "k2" }),
      ] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("p1", "0.40", "0.60"),
        makeMarket("k1", "0.50", "0.50"),
        makeMarket("p2", "0.30", "0.70"),
        makeMarket("k2", "0.60", "0.40"),
      ] as any);
      mgetFn.mockResolvedValue(Array(8).fill(null));

      const result = await service.getOpportunitiesForMarket("p1", 5);

      expect(result.length).toBe(1);
      expect(result[0].polymarketId).toBe("p1");
    });

    it("returns [] when market not in any opportunities", async () => {
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "0.49", "0.51"),
        makeMarket("kalshi-1", "0.50", "0.50"),
      ] as any);
      mgetFn.mockResolvedValue(Array(4).fill(null));

      const result = await service.getOpportunitiesForMarket("nonexistent", 1);

      expect(result).toEqual([]);
    });
  });

  describe("getSpreadComparison", () => {
    it("returns spread summaries sorted by yesSpreadPct", async () => {
      db.marketMatch.findMany.mockResolvedValue([
        makeMatch({ id: "m1", polymarketId: "p1", kalshiId: "k1" }),
      ] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("p1", "0.40", "0.60", "Bitcoin Poly"),
        makeMarket("k1", "0.50", "0.50", "Bitcoin Kalshi"),
      ] as any);
      mgetFn.mockResolvedValue(Array(4).fill(null));

      const result = await service.getSpreadComparison();

      expect(result).toHaveLength(1);
      expect(result[0].yesSpreadPct).toBe(10);
      expect(result[0].polymarket.marketId).toBe("p1");
      expect(result[0].kalshi.marketId).toBe("k1");
    });

    it("returns [] when no matches", async () => {
      db.marketMatch.findMany.mockResolvedValue([]);

      const result = await service.getSpreadComparison();

      expect(result).toEqual([]);
    });
  });

  describe("getHistory", () => {
    it("returns paginated snapshots", async () => {
      const snapshots = [
        {
          id: "s1",
          matchId: "m1",
          spreadPct: 5,
          direction: "buy_poly_sell_kalshi",
          scannedAt: new Date(),
        },
      ];
      db.arbitrageSnapshot.findMany.mockResolvedValue(snapshots as any);
      db.arbitrageSnapshot.count.mockResolvedValue(1);

      const result = await service.getHistory({ limit: 10, offset: 0 });

      expect(result.snapshots).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("filters by matchId", async () => {
      db.arbitrageSnapshot.findMany.mockResolvedValue([]);
      db.arbitrageSnapshot.count.mockResolvedValue(0);

      await service.getHistory({ matchId: "m1" });

      expect(db.arbitrageSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchId: "m1" },
        }),
      );
    });
  });

  describe("persistSnapshots", () => {
    it("persists detected opportunities", async () => {
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "0.40", "0.60"),
        makeMarket("kalshi-1", "0.50", "0.50"),
      ] as any);
      mgetFn.mockResolvedValue(Array(4).fill(null));
      db.arbitrageSnapshot.createMany.mockResolvedValue({ count: 1 } as any);

      const count = await service.persistSnapshots();

      expect(count).toBe(1);
      expect(db.arbitrageSnapshot.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            matchId: "match-1",
            direction: "buy_poly_sell_kalshi",
          }),
        ]),
      });
    });

    it("returns 0 when no opportunities", async () => {
      db.marketMatch.findMany.mockResolvedValue([]);

      const count = await service.persistSnapshots();

      expect(count).toBe(0);
    });
  });
});
