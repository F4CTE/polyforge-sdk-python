import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FeesController } from "./fees.controller";
import { FeeCalculatorService } from "./fee-calculator.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { Venue } from "@prisma/client";

function makeToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok-1",
    marketId: "mkt-1",
    outcome: "YES",
    price: "0.50",
    market: {
      id: "mkt-1",
      venue: Venue.POLYMARKET,
      category: "politics",
      title: "Will X win?",
    },
    ...overrides,
  };
}

function makeUser() {
  return { sub: "user-1", email: "u@test.com" } as any;
}

describe("FeesController", () => {
  let controller: FeesController;
  let db: MockDb;
  let feeCalc: FeeCalculatorService;
  let config: ConfigService;

  beforeEach(() => {
    db = createMockDb();
    feeCalc = new FeeCalculatorService(db as any);
    config = {
      get: vi.fn().mockReturnValue("true"),
    } as unknown as ConfigService;
    controller = new FeesController(feeCalc, db as any, config);
  });

  describe("previewOrder()", () => {
    it("returns fee comparison for a Polymarket token with Kalshi match", async () => {
      db.token.findUnique.mockResolvedValue(makeToken() as any);
      db.marketMatch.findFirst.mockResolvedValue({
        id: "match-1",
        confidence: "0.92",
      } as any);
      db.venueFeeSchedule.findMany
        .mockResolvedValueOnce([
          { feeBps: 100, category: "politics", minPrice: null, maxPrice: null },
        ] as any)
        .mockResolvedValueOnce([
          {
            feeBps: 300,
            category: null,
            minPrice: { toNumber: () => 0.25 },
            maxPrice: { toNumber: () => 0.5 },
          },
        ] as any);

      const result = await controller.previewOrder(makeUser(), {
        tokenId: "tok-1",
        side: "BUY" as any,
        size: 100,
        price: 0.4,
      });

      expect(result.polymarket).toBeDefined();
      expect(result.kalshi).toBeDefined();
      expect(result.marketMatch).toEqual({
        matchId: "match-1",
        confidence: 0.92,
      });
      expect(result.recommendedVenue).toBeDefined();
      expect(typeof result.savings).toBe("number");
    });

    it("returns only Polymarket when Kalshi is disabled", async () => {
      (config.get as any).mockReturnValue("false");
      db.token.findUnique.mockResolvedValue(makeToken() as any);
      db.venueFeeSchedule.findMany.mockResolvedValue([
        { feeBps: 200, category: null, minPrice: null, maxPrice: null },
      ] as any);

      const result = await controller.previewOrder(makeUser(), {
        tokenId: "tok-1",
        side: "BUY" as any,
        size: 100,
        price: 0.5,
      });

      expect(result.kalshi).toBeNull();
      expect(result.marketMatch).toBeNull();
      expect(result.recommendedVenue).toBe("POLYMARKET");
    });

    it("returns only Polymarket when no market match exists", async () => {
      db.token.findUnique.mockResolvedValue(makeToken() as any);
      db.marketMatch.findFirst.mockResolvedValue(null);
      db.venueFeeSchedule.findMany.mockResolvedValue([
        { feeBps: 200, category: null, minPrice: null, maxPrice: null },
      ] as any);

      const result = await controller.previewOrder(makeUser(), {
        tokenId: "tok-1",
        side: "BUY" as any,
        size: 100,
        price: 0.5,
      });

      expect(result.kalshi).toBeNull();
      expect(result.marketMatch).toBeNull();
    });

    it("throws NotFoundException for unknown token", async () => {
      db.token.findUnique.mockResolvedValue(null);

      await expect(
        controller.previewOrder(makeUser(), {
          tokenId: "nonexistent",
          side: "BUY" as any,
          size: 100,
          price: 0.5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("identifies POST_ONLY as maker order", async () => {
      db.token.findUnique.mockResolvedValue(makeToken() as any);
      db.marketMatch.findFirst.mockResolvedValue(null);
      db.venueFeeSchedule.findMany.mockResolvedValue([
        { feeBps: 0, category: null, minPrice: null, maxPrice: null },
      ] as any);

      const result = await controller.previewOrder(makeUser(), {
        tokenId: "tok-1",
        side: "BUY" as any,
        size: 100,
        price: 0.5,
        orderType: "POST_ONLY",
      });

      expect(result.polymarket.isMaker).toBe(true);
    });

    it("handles Kalshi-venue token looking up Polymarket match", async () => {
      db.token.findUnique.mockResolvedValue(
        makeToken({
          market: {
            id: "kalshi-mkt-1",
            venue: Venue.KALSHI,
            category: null,
            title: "Kalshi market",
          },
        }) as any,
      );
      db.marketMatch.findFirst.mockResolvedValue({
        id: "match-2",
        confidence: "0.85",
      } as any);
      db.venueFeeSchedule.findMany
        .mockResolvedValueOnce([
          { feeBps: 200, category: null, minPrice: null, maxPrice: null },
        ] as any)
        .mockResolvedValueOnce([
          {
            feeBps: 150,
            category: null,
            minPrice: { toNumber: () => 0.1 },
            maxPrice: { toNumber: () => 0.25 },
          },
        ] as any);

      const result = await controller.previewOrder(makeUser(), {
        tokenId: "tok-1",
        side: "BUY" as any,
        size: 50,
        price: 0.15,
      });

      expect(result.marketMatch?.matchId).toBe("match-2");
    });
  });

  describe("listSchedules()", () => {
    it("returns grouped schedules for all venues", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        {
          venue: Venue.POLYMARKET,
          category: null,
          role: "taker",
          feeBps: 200,
          minPrice: null,
          maxPrice: null,
          effectiveAt: new Date(),
        },
        {
          venue: Venue.POLYMARKET,
          category: "politics",
          role: "taker",
          feeBps: 100,
          minPrice: null,
          maxPrice: null,
          effectiveAt: new Date(),
        },
        {
          venue: Venue.KALSHI,
          category: null,
          role: "taker",
          feeBps: 300,
          minPrice: "0.25",
          maxPrice: "0.50",
          effectiveAt: new Date(),
        },
      ] as any);

      const result = await controller.listSchedules();

      expect(result.polymarket).toHaveLength(2);
      expect(result.kalshi).toHaveLength(1);
      expect(result.polymarket[0].role).toBe("taker");
      expect(result.kalshi[0].feeBps).toBe(300);
    });

    it("returns empty arrays when no schedules exist", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([]);

      const result = await controller.listSchedules();

      expect(result.polymarket).toEqual([]);
      expect(result.kalshi).toEqual([]);
    });
  });
});
