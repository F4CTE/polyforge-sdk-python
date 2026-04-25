import { describe, it, expect, beforeEach, vi } from "vitest";
import { ArbRiskService } from "./arb-risk.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";
import { ArbPositionStatus, Venue } from "@prisma/client";

function makeOpenPosition(overrides: Record<string, unknown> = {}) {
  return {
    id: "arb-1",
    userId: "user-1",
    matchId: "match-1",
    status: ArbPositionStatus.OPEN,
    buyVenue: Venue.POLYMARKET,
    buyTokenId: "poly-yes",
    buyPrice: "0.40",
    buySize: "100",
    buyFillPrice: "0.40",
    buyFillSize: "100",
    sellVenue: Venue.KALSHI,
    sellTokenId: "kalshi-yes",
    sellPrice: "0.50",
    sellSize: "100",
    sellFillPrice: "0.50",
    sellFillSize: "100",
    entrySpreadPct: "10",
    currentSpreadPct: null,
    realizedPnl: null,
    unrealizedPnl: "5.00",
    ...overrides,
  };
}

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

function makeMarket(id: string, title: string, endDate: Date | null = null) {
  return { id, title, endDate, category: "Crypto" };
}

describe("ArbRiskService", () => {
  let service: ArbRiskService;
  let db: MockDb;
  let redis: RedisService;
  let mgetFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    mgetFn = vi.fn().mockResolvedValue([]);
    redis = {
      getClient: vi.fn().mockReturnValue({ mget: mgetFn }),
    } as unknown as RedisService;
    service = new ArbRiskService(db as any, redis);
  });

  describe("getDashboard", () => {
    it("returns zero-state when no positions exist", async () => {
      db.arbPosition.findMany.mockResolvedValue([] as any);

      const result = await service.getDashboard("user-1");

      expect(result.openPositions).toBe(0);
      expect(result.pendingPositions).toBe(0);
      expect(result.totalDeployed).toBe(0);
      expect(result.totalRealizedPnl).toBe(0);
      expect(result.avgSpreadPct).toBe(0);
    });

    it("calculates exposure correctly for open positions", async () => {
      const pos = makeOpenPosition();
      db.arbPosition.findMany.mockResolvedValue([pos] as any);

      const result = await service.getDashboard("user-1");

      expect(result.openPositions).toBe(1);
      expect(result.netExposure.polymarket).toBe(40);
      expect(result.netExposure.kalshi).toBe(50);
      expect(result.totalDeployed).toBe(90);
      expect(result.totalUnrealizedPnl).toBe(5);
      expect(result.avgSpreadPct).toBe(10);
    });

    it("aggregates multiple positions", async () => {
      const pos1 = makeOpenPosition({ id: "arb-1" });
      const pos2 = makeOpenPosition({
        id: "arb-2",
        buyVenue: Venue.KALSHI,
        sellVenue: Venue.POLYMARKET,
        entrySpreadPct: "6",
        unrealizedPnl: "3.00",
      });
      db.arbPosition.findMany.mockResolvedValue([pos1, pos2] as any);

      const result = await service.getDashboard("user-1");

      expect(result.openPositions).toBe(2);
      expect(result.avgSpreadPct).toBe(8);
      expect(result.totalUnrealizedPnl).toBe(8);
    });

    it("counts realized P&L from closed positions", async () => {
      const closedPos = makeOpenPosition({
        status: ArbPositionStatus.CLOSED,
        realizedPnl: "15.50",
      });
      db.arbPosition.findMany.mockResolvedValue([closedPos] as any);

      const result = await service.getDashboard("user-1");

      expect(result.totalRealizedPnl).toBe(15.5);
      expect(result.positionsByStatus.CLOSED).toBe(1);
    });
  });

  describe("getSettlementRisks", () => {
    it("returns [] when no open positions", async () => {
      db.arbPosition.findMany.mockResolvedValue([] as any);

      const result = await service.getSettlementRisks("user-1");

      expect(result).toEqual([]);
    });

    it("identifies HIGH risk for end date mismatch > 7 days", async () => {
      db.arbPosition.findMany.mockResolvedValue([
        { matchId: "match-1" },
      ] as any);
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "BTC 100k Poly", new Date("2026-06-01")),
        makeMarket("kalshi-1", "BTC 100k Kalshi", new Date("2026-06-15")),
      ] as any);

      const result = await service.getSettlementRisks("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].riskLevel).toBe("HIGH");
      expect(result[0].endDateDiffDays).toBe(14);
    });

    it("identifies MEDIUM risk for end date mismatch 2-7 days", async () => {
      db.arbPosition.findMany.mockResolvedValue([
        { matchId: "match-1" },
      ] as any);
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "BTC 100k Poly", new Date("2026-06-01")),
        makeMarket("kalshi-1", "BTC 100k Kalshi", new Date("2026-06-04")),
      ] as any);

      const result = await service.getSettlementRisks("user-1");

      expect(result[0].riskLevel).toBe("MEDIUM");
      expect(result[0].endDateDiffDays).toBe(3);
    });

    it("identifies LOW risk for matched end dates", async () => {
      db.arbPosition.findMany.mockResolvedValue([
        { matchId: "match-1" },
      ] as any);
      db.marketMatch.findMany.mockResolvedValue([makeMatch()] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "BTC 100k Poly", new Date("2026-06-01")),
        makeMarket("kalshi-1", "BTC 100k Kalshi", new Date("2026-06-01")),
      ] as any);

      const result = await service.getSettlementRisks("user-1");

      expect(result[0].riskLevel).toBe("LOW");
    });

    it("flags HIGH risk for low confidence match", async () => {
      db.arbPosition.findMany.mockResolvedValue([
        { matchId: "match-1" },
      ] as any);
      db.marketMatch.findMany.mockResolvedValue([
        makeMatch({ confidence: 0.55 }),
      ] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "BTC Poly", new Date("2026-06-01")),
        makeMarket("kalshi-1", "BTC Kalshi", new Date("2026-06-01")),
      ] as any);

      const result = await service.getSettlementRisks("user-1");

      expect(result[0].riskLevel).toBe("HIGH");
      expect(result[0].reason).toContain("Low match confidence");
    });

    it("sorts by risk level (HIGH first)", async () => {
      db.arbPosition.findMany.mockResolvedValue([
        { matchId: "match-1" },
        { matchId: "match-2" },
      ] as any);
      db.marketMatch.findMany.mockResolvedValue([
        makeMatch({ id: "match-1" }),
        makeMatch({
          id: "match-2",
          polymarketId: "poly-2",
          kalshiId: "kalshi-2",
          confidence: 0.55,
        }),
      ] as any);
      db.market.findMany.mockResolvedValue([
        makeMarket("poly-1", "A", new Date("2026-06-01")),
        makeMarket("kalshi-1", "A", new Date("2026-06-01")),
        makeMarket("poly-2", "B", new Date("2026-06-01")),
        makeMarket("kalshi-2", "B", new Date("2026-06-01")),
      ] as any);

      const result = await service.getSettlementRisks("user-1");

      expect(result[0].riskLevel).toBe("HIGH");
      expect(result[1].riskLevel).toBe("LOW");
    });
  });

  describe("refreshUnrealizedPnl", () => {
    it("returns 0 when no open positions", async () => {
      db.arbPosition.findMany.mockResolvedValue([] as any);

      const result = await service.refreshUnrealizedPnl("user-1");

      expect(result).toBe(0);
    });

    it("updates unrealized P&L from live prices", async () => {
      db.arbPosition.findMany.mockResolvedValue([makeOpenPosition()] as any);
      mgetFn.mockResolvedValue([
        JSON.stringify({ price: "0.45" }),
        JSON.stringify({ price: "0.48" }),
      ]);
      db.arbPosition.update.mockResolvedValue({} as any);

      const result = await service.refreshUnrealizedPnl("user-1");

      expect(result).toBe(1);
      expect(db.arbPosition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "arb-1" },
          data: expect.objectContaining({
            unrealizedPnl: expect.any(Number),
            currentSpreadPct: expect.any(Number),
          }),
        }),
      );
    });

    it("skips positions with missing live prices", async () => {
      db.arbPosition.findMany.mockResolvedValue([makeOpenPosition()] as any);
      mgetFn.mockResolvedValue([null, null]);

      const result = await service.refreshUnrealizedPnl("user-1");

      expect(result).toBe(0);
      expect(db.arbPosition.update).not.toHaveBeenCalled();
    });
  });
});
