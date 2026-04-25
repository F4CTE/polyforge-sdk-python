import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { ArbExecutionService } from "./arb-execution.service";
import { CrossVenueArbitrageService } from "./cross-venue-arbitrage.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";
import { ArbPositionStatus, Venue } from "@prisma/client";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    polymarketConnected: true,
    kalshiConnected: true,
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

function makeComparison(polyYes = 0.4, kalshiYes = 0.5, spreadPct = 10) {
  return {
    matchId: "match-1",
    polymarket: {
      marketId: "poly-1",
      title: "BTC 100k Polymarket",
      yesPrice: polyYes,
      noPrice: 1 - polyYes,
    },
    kalshi: {
      marketId: "kalshi-1",
      title: "BTC 100k Kalshi",
      yesPrice: kalshiYes,
      noPrice: 1 - kalshiYes,
    },
    spreadPct,
    confidence: 0.85,
    verified: false,
  };
}

function makeArbPosition(overrides: Record<string, unknown> = {}) {
  return {
    id: "arb-1",
    userId: "user-1",
    matchId: "match-1",
    status: ArbPositionStatus.OPEN,
    buyVenue: Venue.POLYMARKET,
    buyOrderId: "order-1",
    buyTokenId: "poly-1-yes",
    buyPrice: "0.40",
    buySize: "100",
    buyFillPrice: "0.40",
    buyFillSize: "100",
    sellVenue: Venue.KALSHI,
    sellOrderId: "order-2",
    sellTokenId: "kalshi-1-yes",
    sellPrice: "0.50",
    sellSize: "100",
    sellFillPrice: "0.50",
    sellFillSize: "100",
    entrySpreadPct: "10",
    currentSpreadPct: null,
    realizedPnl: null,
    unrealizedPnl: null,
    openedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ArbExecutionService", () => {
  let service: ArbExecutionService;
  let db: MockDb;
  let redis: RedisService;
  let crossVenue: CrossVenueArbitrageService;
  let pipelineExecFn: ReturnType<typeof vi.fn>;
  let pipelineXaddFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    pipelineExecFn = vi.fn().mockResolvedValue([]);
    pipelineXaddFn = vi.fn().mockReturnThis();
    redis = {
      getClient: vi.fn().mockReturnValue({
        pipeline: vi.fn().mockReturnValue({
          xadd: pipelineXaddFn,
          exec: pipelineExecFn,
        }),
      }),
    } as unknown as RedisService;
    crossVenue = {
      getComparison: vi.fn(),
    } as unknown as CrossVenueArbitrageService;
    service = new ArbExecutionService(db as any, redis, crossVenue);
  });

  describe("execute", () => {
    it("throws ForbiddenException when venues not connected", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ kalshiConnected: false }) as any,
      );

      await expect(
        service.execute("user-1", { matchId: "match-1", size: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException when match not found", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(makeUser() as any);
      db.marketMatch.findUnique.mockResolvedValue(null);

      await expect(
        service.execute("user-1", { matchId: "bad-id", size: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws UnprocessableEntityException when comparison unavailable", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(makeUser() as any);
      db.marketMatch.findUnique.mockResolvedValue(makeMatch() as any);
      (crossVenue.getComparison as any).mockResolvedValue(null);

      await expect(
        service.execute("user-1", { matchId: "match-1", size: 100 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws UnprocessableEntityException when spread too low", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(makeUser() as any);
      db.marketMatch.findUnique.mockResolvedValue(makeMatch() as any);
      (crossVenue.getComparison as any).mockResolvedValue(
        makeComparison(0.49, 0.5, 0.5),
      );

      await expect(
        service.execute("user-1", { matchId: "match-1", size: 100 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("creates arb position and publishes two order intents", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(makeUser() as any);
      db.marketMatch.findUnique.mockResolvedValue(makeMatch() as any);
      (crossVenue.getComparison as any).mockResolvedValue(
        makeComparison(0.4, 0.5, 10),
      );
      db.token.findFirst.mockResolvedValue({ id: "token-yes" } as any);
      db.arbPosition.create.mockResolvedValue({
        id: "arb-new",
        status: ArbPositionStatus.PENDING,
      } as any);

      const result = await service.execute("user-1", {
        matchId: "match-1",
        size: 100,
      });

      expect(result.arbPositionId).toBe("arb-new");
      expect(result.status).toBe("PENDING");
      expect(result.entrySpreadPct).toBe(10);
      expect(result.buyLeg.venue).toBe(Venue.POLYMARKET);
      expect(result.sellLeg.venue).toBe(Venue.KALSHI);
      expect(pipelineXaddFn).toHaveBeenCalledTimes(2);
      expect(pipelineExecFn).toHaveBeenCalledTimes(1);
    });

    it("respects maxSlippagePct parameter", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(makeUser() as any);
      db.marketMatch.findUnique.mockResolvedValue(makeMatch() as any);
      (crossVenue.getComparison as any).mockResolvedValue(
        makeComparison(0.4, 0.5, 10),
      );
      db.token.findFirst.mockResolvedValue({ id: "token-yes" } as any);
      db.arbPosition.create.mockResolvedValue({
        id: "arb-slippage",
        status: ArbPositionStatus.PENDING,
      } as any);

      const result = await service.execute("user-1", {
        matchId: "match-1",
        size: 50,
        maxSlippagePct: 2,
      });

      expect(result.buyLeg.price).toBeCloseTo(0.408, 2);
    });
  });

  describe("listPositions", () => {
    it("returns paginated positions", async () => {
      db.arbPosition.findMany.mockResolvedValue([makeArbPosition()] as any);
      db.arbPosition.count.mockResolvedValue(1);

      const result = await service.listPositions("user-1", { limit: 10 });

      expect(result.total).toBe(1);
      expect(result.positions).toHaveLength(1);
    });

    it("filters by status", async () => {
      db.arbPosition.findMany.mockResolvedValue([] as any);
      db.arbPosition.count.mockResolvedValue(0);

      await service.listPositions("user-1", {
        status: ArbPositionStatus.CLOSED,
      });

      expect(db.arbPosition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", status: ArbPositionStatus.CLOSED },
        }),
      );
    });
  });

  describe("getPosition", () => {
    it("returns position when found", async () => {
      db.arbPosition.findFirst.mockResolvedValue(makeArbPosition() as any);

      const result = await service.getPosition("user-1", "arb-1");

      expect(result.id).toBe("arb-1");
    });

    it("throws NotFoundException when not found", async () => {
      db.arbPosition.findFirst.mockResolvedValue(null);

      await expect(service.getPosition("user-1", "bad-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("closePosition", () => {
    it("submits reverse orders and updates status to CLOSING", async () => {
      db.arbPosition.findFirst.mockResolvedValue(makeArbPosition() as any);
      db.arbPosition.update.mockResolvedValue({} as any);

      const result = await service.closePosition("user-1", "arb-1");

      expect(result.status).toBe("CLOSING");
      expect(pipelineXaddFn).toHaveBeenCalledTimes(2);
      expect(db.arbPosition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ArbPositionStatus.CLOSING },
        }),
      );
    });

    it("throws when position not OPEN", async () => {
      db.arbPosition.findFirst.mockResolvedValue(
        makeArbPosition({ status: ArbPositionStatus.PENDING }) as any,
      );

      await expect(service.closePosition("user-1", "arb-1")).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("throws NotFoundException when position not found", async () => {
      db.arbPosition.findFirst.mockResolvedValue(null);

      await expect(service.closePosition("user-1", "bad-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
