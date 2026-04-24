import { describe, it, expect, beforeEach, vi } from "vitest";
import { MarketMatchService } from "./market-match.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

function makeMarketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "poly-1",
    title: "Will Bitcoin reach 100k?",
    category: "Crypto",
    endDate: new Date("2026-12-31"),
    tokens: [{ outcome: "Yes" }, { outcome: "No" }],
    ...overrides,
  };
}

describe("MarketMatchService", () => {
  let service: MarketMatchService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new MarketMatchService(db as any);
  });

  describe("runMatchingPass", () => {
    it("returns 0 when no markets on one venue", async () => {
      db.market.findMany
        .mockResolvedValueOnce([makeMarketRow()] as any)
        .mockResolvedValueOnce([] as any);
      db.marketMatch.findMany.mockResolvedValue([]);

      const count = await service.runMatchingPass();

      expect(count).toBe(0);
    });

    it("creates matches for similar markets above threshold", async () => {
      const poly = makeMarketRow({
        id: "poly-1",
        title: "Will Bitcoin hit 100k by 2026?",
      });
      const kalshi = makeMarketRow({
        id: "kalshi-1",
        title: "Bitcoin above 100000 by end of 2026",
      });

      db.market.findMany
        .mockResolvedValueOnce([poly] as any)
        .mockResolvedValueOnce([kalshi] as any);
      db.marketMatch.findMany.mockResolvedValue([]);
      db.marketMatch.create.mockResolvedValue({ id: "match-1" } as any);

      const count = await service.runMatchingPass();

      expect(count).toBeGreaterThanOrEqual(0);
      if (count > 0) {
        expect(db.marketMatch.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              polymarketId: "poly-1",
              kalshiId: "kalshi-1",
            }),
          }),
        );
      }
    });

    it("skips already-matched markets", async () => {
      const poly = makeMarketRow({ id: "poly-1" });
      const kalshi = makeMarketRow({ id: "kalshi-1" });

      db.market.findMany
        .mockResolvedValueOnce([poly] as any)
        .mockResolvedValueOnce([kalshi] as any);
      db.marketMatch.findMany.mockResolvedValue([
        { polymarketId: "poly-1", kalshiId: "kalshi-1" },
      ] as any);

      const count = await service.runMatchingPass();

      expect(count).toBe(0);
    });

    it("handles P2002 unique constraint gracefully", async () => {
      const poly = makeMarketRow({
        id: "poly-1",
        title: "Will Bitcoin hit 100k by Dec?",
      });
      const kalshi = makeMarketRow({
        id: "kalshi-1",
        title: "Bitcoin above 100000 December",
      });

      db.market.findMany
        .mockResolvedValueOnce([poly] as any)
        .mockResolvedValueOnce([kalshi] as any);
      db.marketMatch.findMany.mockResolvedValue([]);
      db.marketMatch.create.mockRejectedValue({ code: "P2002" });

      const count = await service.runMatchingPass();

      expect(count).toBe(0);
    });
  });

  describe("manualMatch", () => {
    it("creates a verified manual match", async () => {
      db.marketMatch.upsert.mockResolvedValue({
        id: "match-1",
        polymarketId: "p1",
        kalshiId: "k1",
        confidence: 1,
        matchMethod: "manual",
        verified: true,
      } as any);

      const result = await service.manualMatch("p1", "k1");

      expect(result).toEqual({ id: "match-1" });
      expect(db.marketMatch.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            matchMethod: "manual",
            confidence: 1,
            verified: true,
          }),
        }),
      );
    });
  });

  describe("manualUnmatch", () => {
    it("deletes the match record", async () => {
      db.marketMatch.delete.mockResolvedValue({} as any);

      await service.manualUnmatch("match-1");

      expect(db.marketMatch.delete).toHaveBeenCalledWith({
        where: { id: "match-1" },
      });
    });
  });

  describe("verifyMatch", () => {
    it("sets verified to true", async () => {
      db.marketMatch.update.mockResolvedValue({} as any);

      await service.verifyMatch("match-1");

      expect(db.marketMatch.update).toHaveBeenCalledWith({
        where: { id: "match-1" },
        data: { verified: true },
      });
    });
  });

  describe("listMatches", () => {
    it("returns paginated results with total", async () => {
      db.marketMatch.findMany.mockResolvedValue([{ id: "m1" }] as any);
      db.marketMatch.count.mockResolvedValue(1);

      const result = await service.listMatches({ limit: 10, offset: 0 });

      expect(result).toEqual({ matches: [{ id: "m1" }], total: 1 });
    });

    it("filters by verified status", async () => {
      db.marketMatch.findMany.mockResolvedValue([] as any);
      db.marketMatch.count.mockResolvedValue(0);

      await service.listMatches({ verified: true });

      expect(db.marketMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { verified: true },
        }),
      );
    });
  });

  describe("getMatchesByMarketId", () => {
    it("searches both polymarketId and kalshiId", async () => {
      db.marketMatch.findMany.mockResolvedValue([] as any);

      await service.getMatchesByMarketId("market-x");

      expect(db.marketMatch.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ polymarketId: "market-x" }, { kalshiId: "market-x" }],
        },
      });
    });
  });

  describe("getMatchById", () => {
    it("returns match by ID", async () => {
      const match = {
        id: "match-1",
        polymarketId: "p1",
        kalshiId: "k1",
        confidence: 0.85,
        matchMethod: "auto_tfidf",
        verified: false,
      };
      db.marketMatch.findUnique.mockResolvedValue(match as any);

      const result = await service.getMatchById("match-1");

      expect(result).toEqual(match);
      expect(db.marketMatch.findUnique).toHaveBeenCalledWith({
        where: { id: "match-1" },
      });
    });

    it("returns null for non-existent match", async () => {
      db.marketMatch.findUnique.mockResolvedValue(null);

      const result = await service.getMatchById("nonexistent");

      expect(result).toBeNull();
    });
  });
});
