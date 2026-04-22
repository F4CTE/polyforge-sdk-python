import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArbitrageService } from "./arbitrage.service";

function makePrisma() {
  return {
    marketMatch: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    market: {
      findUnique: vi.fn(),
    },
    token: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    xadd: vi.fn().mockResolvedValue("1-0"),
  } as any;
}

const MATCH = {
  id: "match-1",
  polymarketId: "pm-btc",
  kalshiId: "kal-btc",
  confidence: 0.9,
  matchMethod: "title_similarity",
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMarketWithTokens(
  id: string,
  title: string,
  tokens: { id: string; outcome: string; price: number }[],
) {
  return {
    id,
    title,
    tokens: tokens.map((t) => ({
      ...t,
      marketId: id,
      liquidity: 0,
      price: t.price,
    })),
  };
}

describe("ArbitrageService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let service: ArbitrageService;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    service = new ArbitrageService(prisma, redis);
  });

  describe("getPriceComparison", () => {
    it("returns null when match does not exist", async () => {
      prisma.marketMatch.findUnique.mockResolvedValue(null);
      const result = await service.getPriceComparison("no-match");
      expect(result).toBeNull();
    });

    it("returns price data from both venues", async () => {
      prisma.marketMatch.findUnique.mockResolvedValue(MATCH);
      prisma.token.findMany
        .mockResolvedValueOnce([
          { id: "pm-yes", outcome: "Yes", price: 0.55, marketId: "pm-btc" },
        ])
        .mockResolvedValueOnce([
          { id: "kal-yes", outcome: "Yes", price: 0.6, marketId: "kal-btc" },
        ]);

      const result = await service.getPriceComparison("match-1");
      expect(result).not.toBeNull();
      expect(result!.polymarket).toHaveLength(1);
      expect(result!.kalshi).toHaveLength(1);
      expect(result!.polymarket[0].venue).toBe("polymarket");
      expect(result!.kalshi[0].venue).toBe("kalshi");
    });

    it("uses redis-cached prices when available", async () => {
      prisma.marketMatch.findUnique.mockResolvedValue(MATCH);
      prisma.token.findMany
        .mockResolvedValueOnce([
          { id: "pm-yes", outcome: "Yes", price: 0.5, marketId: "pm-btc" },
        ])
        .mockResolvedValueOnce([]);

      redis.get.mockResolvedValueOnce(
        JSON.stringify({ price: 0.62, timestamp: 1000 }),
      );

      const result = await service.getPriceComparison("match-1");
      expect(result!.polymarket[0].price).toBe(0.62);
    });
  });

  describe("detectForMatch", () => {
    it("detects arbitrage when spread exceeds threshold", async () => {
      prisma.market.findUnique
        .mockResolvedValueOnce(
          makeMarketWithTokens("pm-btc", "BTC 100k", [
            { id: "pm-yes", outcome: "Yes", price: 0.5 },
          ]),
        )
        .mockResolvedValueOnce(
          makeMarketWithTokens("kal-btc", "BTC 100k", [
            { id: "kal-yes", outcome: "Yes", price: 0.58 },
          ]),
        );

      const opps = await service.detectForMatch(MATCH as any, 3);
      expect(opps).toHaveLength(1);
      expect(opps[0].spreadPct).toBeGreaterThan(3);
      expect(opps[0].direction).toBe("BUY_POLYMARKET_SELL_KALSHI");
    });

    it("returns empty when spread is below threshold", async () => {
      prisma.market.findUnique
        .mockResolvedValueOnce(
          makeMarketWithTokens("pm-btc", "BTC 100k", [
            { id: "pm-yes", outcome: "Yes", price: 0.5 },
          ]),
        )
        .mockResolvedValueOnce(
          makeMarketWithTokens("kal-btc", "BTC 100k", [
            { id: "kal-yes", outcome: "Yes", price: 0.51 },
          ]),
        );

      const opps = await service.detectForMatch(MATCH as any, 3);
      expect(opps).toHaveLength(0);
    });

    it("returns empty when market not found", async () => {
      prisma.market.findUnique.mockResolvedValue(null);
      const opps = await service.detectForMatch(MATCH as any, 3);
      expect(opps).toHaveLength(0);
    });

    it("matches outcomes case-insensitively", async () => {
      prisma.market.findUnique
        .mockResolvedValueOnce(
          makeMarketWithTokens("pm-btc", "BTC 100k", [
            { id: "pm-yes", outcome: "YES", price: 0.4 },
          ]),
        )
        .mockResolvedValueOnce(
          makeMarketWithTokens("kal-btc", "BTC 100k", [
            { id: "kal-yes", outcome: "yes", price: 0.55 },
          ]),
        );

      const opps = await service.detectForMatch(MATCH as any, 3);
      expect(opps).toHaveLength(1);
      expect(opps[0].outcome).toBe("YES");
    });

    it("indicates correct direction when kalshi is cheaper", async () => {
      prisma.market.findUnique
        .mockResolvedValueOnce(
          makeMarketWithTokens("pm-btc", "BTC 100k", [
            { id: "pm-yes", outcome: "Yes", price: 0.7 },
          ]),
        )
        .mockResolvedValueOnce(
          makeMarketWithTokens("kal-btc", "BTC 100k", [
            { id: "kal-yes", outcome: "Yes", price: 0.55 },
          ]),
        );

      const opps = await service.detectForMatch(MATCH as any, 3);
      expect(opps[0].direction).toBe("BUY_KALSHI_SELL_POLYMARKET");
    });
  });

  describe("findOpportunities", () => {
    it("returns opportunities sorted by spread descending", async () => {
      prisma.marketMatch.findMany.mockResolvedValue([MATCH]);
      prisma.market.findUnique
        .mockResolvedValueOnce(
          makeMarketWithTokens("pm-btc", "BTC 100k", [
            { id: "pm-yes", outcome: "Yes", price: 0.45 },
            { id: "pm-no", outcome: "No", price: 0.55 },
          ]),
        )
        .mockResolvedValueOnce(
          makeMarketWithTokens("kal-btc", "BTC 100k", [
            { id: "kal-yes", outcome: "Yes", price: 0.52 },
            { id: "kal-no", outcome: "No", price: 0.48 },
          ]),
        );

      const opps = await service.findOpportunities({ thresholdPct: 3 });
      for (let i = 1; i < opps.length; i++) {
        expect(opps[i - 1].spreadPct).toBeGreaterThanOrEqual(opps[i].spreadPct);
      }
    });
  });

  describe("scanAndAlert", () => {
    it("emits arbitrage events to stream:events", async () => {
      prisma.marketMatch.findMany.mockResolvedValue([MATCH]);
      prisma.market.findUnique
        .mockResolvedValueOnce(
          makeMarketWithTokens("pm-btc", "BTC 100k", [
            { id: "pm-yes", outcome: "Yes", price: 0.4 },
          ]),
        )
        .mockResolvedValueOnce(
          makeMarketWithTokens("kal-btc", "BTC 100k", [
            { id: "kal-yes", outcome: "Yes", price: 0.55 },
          ]),
        );

      const alertCount = await service.scanAndAlert(3);
      expect(alertCount).toBe(1);
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "ARBITRAGE_OPPORTUNITY",
          matchId: "match-1",
        }),
      );
    });

    it("respects cooldown — no duplicate alerts within 15 min", async () => {
      prisma.marketMatch.findMany.mockResolvedValue([MATCH]);
      const marketMock = () => {
        prisma.market.findUnique
          .mockResolvedValueOnce(
            makeMarketWithTokens("pm-btc", "BTC 100k", [
              { id: "pm-yes", outcome: "Yes", price: 0.4 },
            ]),
          )
          .mockResolvedValueOnce(
            makeMarketWithTokens("kal-btc", "BTC 100k", [
              { id: "kal-yes", outcome: "Yes", price: 0.55 },
            ]),
          );
      };

      marketMock();
      await service.scanAndAlert(3);
      expect(redis.xadd).toHaveBeenCalledTimes(1);

      // Second scan within cooldown
      marketMock();
      await service.scanAndAlert(3);
      expect(redis.xadd).toHaveBeenCalledTimes(1); // still 1
    });
  });
});
