import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketMatchService } from "./market-match.service";
import { Venue } from "@prisma/client";

// ─── Prisma mock ────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    market: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    marketMatch: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }) => ({
        id: "match-1",
        ...data,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      upsert: vi.fn().mockImplementation(({ create }) => ({
        id: "match-manual",
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(({ data }) => ({
        id: "match-1",
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      count: vi.fn().mockResolvedValue(0),
    },
  } as any;
}

function makeMarket(
  id: string,
  venue: Venue,
  title: string,
  opts?: {
    category?: string;
    endDate?: Date;
    tokens?: { outcome: string }[];
  },
) {
  return {
    id,
    venue,
    slug: `${venue.toLowerCase()}-${id}`,
    title,
    description: null,
    category: opts?.category ?? "Politics",
    image: null,
    seriesSlug: null,
    eventId: null,
    endDate: opts?.endDate ?? new Date("2026-12-31"),
    closed: false,
    negRisk: false,
    volume24h: 0,
    firstSeenAt: new Date(),
    lastUpdatedAt: new Date(),
    tokens: opts?.tokens ?? [{ outcome: "Yes" }, { outcome: "No" }],
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("MarketMatchService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: MarketMatchService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new MarketMatchService(prisma);
  });

  describe("scoreCandidate", () => {
    it("returns high confidence for identical titles, same category, close dates, same outcomes", () => {
      const poly = makeMarket(
        "p1",
        Venue.POLYMARKET,
        "Will Biden win 2026 election?",
        {
          category: "Politics",
          endDate: new Date("2026-11-05"),
          tokens: [{ outcome: "Yes" }, { outcome: "No" }],
        },
      );
      const kalshi = makeMarket(
        "k1",
        Venue.KALSHI,
        "Will Biden win 2026 election?",
        {
          category: "Politics",
          endDate: new Date("2026-11-05"),
          tokens: [{ outcome: "Yes" }, { outcome: "No" }],
        },
      );

      const result = service.scoreCandidate(poly, kalshi, 1.0);

      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.polymarketId).toBe("p1");
      expect(result.kalshiId).toBe("k1");
    });

    it("returns lower confidence when categories differ", () => {
      const poly = makeMarket("p1", Venue.POLYMARKET, "Bitcoin at 100k", {
        category: "Crypto",
      });
      const kalshi = makeMarket("k1", Venue.KALSHI, "Bitcoin at 100k", {
        category: "Finance",
      });

      const result = service.scoreCandidate(poly, kalshi, 1.0);
      expect(result.confidence).toBeLessThan(0.95);
    });

    it("returns lower confidence when end dates are far apart", () => {
      const poly = makeMarket("p1", Venue.POLYMARKET, "Will X happen?", {
        endDate: new Date("2026-06-01"),
      });
      const kalshi = makeMarket("k1", Venue.KALSHI, "Will X happen?", {
        endDate: new Date("2027-01-01"),
      });

      const result = service.scoreCandidate(poly, kalshi, 1.0);
      expect(result.signals.endDateProximity).toBe(0);
    });

    it("returns lower confidence when outcome labels differ", () => {
      const poly = makeMarket("p1", Venue.POLYMARKET, "Same question", {
        tokens: [{ outcome: "Yes" }, { outcome: "No" }],
      });
      const kalshi = makeMarket("k1", Venue.KALSHI, "Same question", {
        tokens: [{ outcome: "Above" }, { outcome: "Below" }],
      });

      const result = service.scoreCandidate(poly, kalshi, 1.0);
      expect(result.signals.outcomeMatch).toBe(0);
    });

    it("caps confidence at 1.0", () => {
      const poly = makeMarket("p1", Venue.POLYMARKET, "Test");
      const kalshi = makeMarket("k1", Venue.KALSHI, "Test");
      const result = service.scoreCandidate(poly, kalshi, 1.0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("runAutoMatch", () => {
    it("returns zero when no markets exist", async () => {
      const result = await service.runAutoMatch();
      expect(result).toEqual({ created: 0, skipped: 0 });
    });

    it("creates matches for high-confidence pairs", async () => {
      const polyMarkets = [
        makeMarket("p1", Venue.POLYMARKET, "Will Biden win 2026 election?", {
          category: "Politics",
          endDate: new Date("2026-11-05"),
        }),
      ];
      const kalshiMarkets = [
        makeMarket("k1", Venue.KALSHI, "Will Biden win the 2026 election?", {
          category: "Politics",
          endDate: new Date("2026-11-05"),
        }),
      ];

      prisma.market.findMany
        .mockResolvedValueOnce(polyMarkets)
        .mockResolvedValueOnce(kalshiMarkets);
      prisma.marketMatch.findMany.mockResolvedValueOnce([]);

      const result = await service.runAutoMatch();
      expect(result.created).toBeGreaterThanOrEqual(1);
      expect(prisma.marketMatch.create).toHaveBeenCalled();
    });

    it("skips already-matched pairs", async () => {
      const polyMarkets = [
        makeMarket("p1", Venue.POLYMARKET, "Bitcoin to 100k?"),
      ];
      const kalshiMarkets = [
        makeMarket("k1", Venue.KALSHI, "Bitcoin to 100k?"),
      ];

      prisma.market.findMany
        .mockResolvedValueOnce(polyMarkets)
        .mockResolvedValueOnce(kalshiMarkets);
      prisma.marketMatch.findMany.mockResolvedValueOnce([
        { polymarketId: "p1", kalshiId: "k1" },
      ]);

      const result = await service.runAutoMatch();
      expect(result.created).toBe(0);
      expect(prisma.marketMatch.create).not.toHaveBeenCalled();
    });

    it("enforces 1:1 matching (greedy assignment)", async () => {
      const polyMarkets = [
        makeMarket("p1", Venue.POLYMARKET, "Will BTC reach 100k?"),
      ];
      const kalshiMarkets = [
        makeMarket("k1", Venue.KALSHI, "Will BTC reach 100k?"),
        makeMarket("k2", Venue.KALSHI, "BTC to hit 100k?"),
      ];

      prisma.market.findMany
        .mockResolvedValueOnce(polyMarkets)
        .mockResolvedValueOnce(kalshiMarkets);
      prisma.marketMatch.findMany.mockResolvedValueOnce([]);

      const result = await service.runAutoMatch();
      // Only one match should be created (best confidence wins)
      expect(result.created).toBeLessThanOrEqual(1);
    });
  });

  describe("createManualMatch", () => {
    it("creates a verified match with confidence 1", async () => {
      prisma.market.findUnique
        .mockResolvedValueOnce({ id: "p1" })
        .mockResolvedValueOnce({ id: "k1" });

      await service.createManualMatch("p1", "k1");

      expect(prisma.marketMatch.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            polymarketId: "p1",
            kalshiId: "k1",
            confidence: 1,
            matchMethod: "manual",
            verified: true,
          }),
        }),
      );
    });

    it("throws when polymarket market does not exist", async () => {
      prisma.market.findUnique.mockResolvedValue(null);
      await expect(service.createManualMatch("p1", "k1")).rejects.toThrow(
        "Polymarket market p1 not found",
      );
    });
  });

  describe("listMatches", () => {
    it("applies verifiedOnly filter", async () => {
      await service.listMatches({ verifiedOnly: true });
      expect(prisma.marketMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ verified: true }),
        }),
      );
    });

    it("applies minConfidence filter", async () => {
      await service.listMatches({ minConfidence: 0.8 });
      expect(prisma.marketMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ confidence: { gte: 0.8 } }),
        }),
      );
    });
  });

  describe("getMatchesForMarket", () => {
    it("queries by either polymarketId or kalshiId", async () => {
      await service.getMatchesForMarket("m1");
      expect(prisma.marketMatch.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ polymarketId: "m1" }, { kalshiId: "m1" }],
        },
      });
    });
  });
});
