import { describe, it, expect, beforeEach, vi } from "vitest";
import { FeeCalculatorService } from "./fee-calculator.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { Venue } from "@prisma/client";

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    venue: Venue.POLYMARKET,
    category: null,
    role: "taker",
    feeBps: 200,
    minPrice: null,
    maxPrice: null,
    effectiveAt: new Date("2026-01-01"),
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("FeeCalculatorService", () => {
  let service: FeeCalculatorService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new FeeCalculatorService(db as any);
  });

  describe("estimateFee()", () => {
    it("calculates taker fee for Polymarket using default schedule", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({ feeBps: 200, category: null }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.POLYMARKET,
        side: "BUY",
        price: 0.5,
        size: 100,
        isMaker: false,
      });

      expect(result.feeBps).toBe(200);
      expect(result.feeUsd).toBe(1); // 0.5 * 100 * 0.02 = 1.0
      expect(result.totalCostUsd).toBe(51); // 50 + 1
      expect(result.venue).toBe("POLYMARKET");
      expect(result.isMaker).toBe(false);
    });

    it("uses category-specific fee for Polymarket when available", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({ feeBps: 100, category: "politics" }),
        makeSchedule({ feeBps: 200, category: null }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.POLYMARKET,
        side: "BUY",
        price: 0.6,
        size: 50,
        category: "politics",
        isMaker: false,
      });

      expect(result.feeBps).toBe(100);
      expect(result.feeUsd).toBe(0.3); // 0.6 * 50 * 0.01 = 0.3
    });

    it("falls back to default when category not found on Polymarket", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({ feeBps: 200, category: null }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.POLYMARKET,
        side: "BUY",
        price: 0.5,
        size: 100,
        category: "exotic",
        isMaker: false,
      });

      expect(result.feeBps).toBe(200);
    });

    it("resolves Kalshi fee by price band", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({
          venue: Venue.KALSHI,
          feeBps: 70,
          minPrice: { toNumber: () => 0.01 },
          maxPrice: { toNumber: () => 0.1 },
        }),
        makeSchedule({
          venue: Venue.KALSHI,
          feeBps: 300,
          minPrice: { toNumber: () => 0.25 },
          maxPrice: { toNumber: () => 0.5 },
        }),
        makeSchedule({
          venue: Venue.KALSHI,
          feeBps: 300,
          minPrice: { toNumber: () => 0.5 },
          maxPrice: { toNumber: () => 0.75 },
        }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.KALSHI,
        side: "BUY",
        price: 0.5,
        size: 100,
        isMaker: false,
      });

      expect(result.feeBps).toBe(300);
    });

    it("resolves Kalshi fee at extreme price (low band)", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({
          venue: Venue.KALSHI,
          feeBps: 70,
          minPrice: { toNumber: () => 0.01 },
          maxPrice: { toNumber: () => 0.1 },
        }),
        makeSchedule({
          venue: Venue.KALSHI,
          feeBps: 300,
          minPrice: { toNumber: () => 0.5 },
          maxPrice: { toNumber: () => 0.75 },
        }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.KALSHI,
        side: "BUY",
        price: 0.05,
        size: 200,
        isMaker: false,
      });

      expect(result.feeBps).toBe(70);
      expect(result.feeUsd).toBe(0.07); // 0.05 * 200 * 0.007 = 0.07
    });

    it("calculates maker fee (0 bps for Polymarket)", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({ feeBps: 0, role: "maker" }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.POLYMARKET,
        side: "BUY",
        price: 0.5,
        size: 100,
        isMaker: true,
      });

      expect(result.feeBps).toBe(0);
      expect(result.feeUsd).toBe(0);
      expect(result.totalCostUsd).toBe(50);
      expect(result.isMaker).toBe(true);
    });

    it("handles SELL side (fee reduces proceeds)", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({ feeBps: 200 }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.POLYMARKET,
        side: "SELL",
        price: 0.8,
        size: 100,
        isMaker: false,
      });

      expect(result.feeUsd).toBe(1.6); // 0.8 * 100 * 0.02
      expect(result.totalCostUsd).toBe(78.4); // 80 - 1.6
    });

    it("defaults to 200 bps when no schedule found", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([]);

      const result = await service.estimateFee({
        venue: Venue.POLYMARKET,
        side: "BUY",
        price: 0.5,
        size: 100,
        isMaker: false,
      });

      expect(result.feeBps).toBe(200);
    });

    it("handles negative fee (maker rebate on Kalshi)", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({
          venue: Venue.KALSHI,
          feeBps: -20,
          minPrice: { toNumber: () => 0.01 },
          maxPrice: { toNumber: () => 0.1 },
        }),
      ]);

      const result = await service.estimateFee({
        venue: Venue.KALSHI,
        side: "BUY",
        price: 0.05,
        size: 100,
        isMaker: true,
      });

      expect(result.feeBps).toBe(-20);
      expect(result.feeUsd).toBeLessThan(0);
    });
  });

  describe("compareFees()", () => {
    it("returns only Polymarket when Kalshi unavailable", async () => {
      db.venueFeeSchedule.findMany.mockResolvedValue([
        makeSchedule({ feeBps: 200 }),
      ]);

      const result = await service.compareFees({
        price: 0.5,
        size: 100,
        side: "BUY",
        kalshiAvailable: false,
      });

      expect(result.kalshi).toBeNull();
      expect(result.savings).toBe(0);
      expect(result.recommendedVenue).toBe("POLYMARKET");
    });

    it("recommends cheaper venue when both available", async () => {
      db.venueFeeSchedule.findMany
        .mockResolvedValueOnce([makeSchedule({ feeBps: 200 })])
        .mockResolvedValueOnce([
          makeSchedule({
            venue: Venue.KALSHI,
            feeBps: 70,
            minPrice: { toNumber: () => 0.01 },
            maxPrice: { toNumber: () => 0.1 },
          }),
        ]);

      const result = await service.compareFees({
        price: 0.05,
        size: 100,
        side: "BUY",
        kalshiAvailable: true,
      });

      expect(result.kalshi).not.toBeNull();
      expect(result.savings).toBeGreaterThan(0);
      expect(result.recommendedVenue).toBe("KALSHI");
    });

    it("recommends Polymarket when its fees are lower", async () => {
      db.venueFeeSchedule.findMany
        .mockResolvedValueOnce([
          makeSchedule({ feeBps: 100, category: "politics" }),
        ])
        .mockResolvedValueOnce([
          makeSchedule({
            venue: Venue.KALSHI,
            feeBps: 300,
            minPrice: { toNumber: () => 0.25 },
            maxPrice: { toNumber: () => 0.5 },
          }),
        ]);

      const result = await service.compareFees({
        price: 0.4,
        size: 100,
        side: "BUY",
        category: "politics",
        kalshiAvailable: true,
      });

      expect(result.recommendedVenue).toBe("POLYMARKET");
    });
  });
});
