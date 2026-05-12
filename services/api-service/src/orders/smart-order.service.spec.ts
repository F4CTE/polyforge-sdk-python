import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { SmartOrderService } from "./smart-order.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-uuid-1",
    polymarketConnected: true,
    ...overrides,
  };
}

function makeSmartOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "smart-uuid-1",
    userId: "user-uuid-1",
    type: "TWAP",
    status: "PENDING",
    marketId: "market-uuid-1",
    tokenId: "token-uuid-1",
    outcome: "YES",
    side: "BUY",
    totalSize: 100,
    config: { slices: 5, intervalMinutes: 10, limitPrice: null },
    slicesTotal: 5,
    slicesFilled: 0,
    nextExecuteAt: new Date(),
    completedAt: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeTwapDto(overrides: Record<string, unknown> = {}) {
  return {
    type: "TWAP",
    tokenId: "token-uuid-1",
    side: "BUY",
    outcome: "YES",
    totalSize: 100,
    slices: 5,
    intervalMinutes: 10,
    ...overrides,
  };
}

function makeBracketDto(overrides: Record<string, unknown> = {}) {
  return {
    type: "BRACKET",
    tokenId: "token-uuid-1",
    side: "BUY",
    outcome: "YES",
    totalSize: 100,
    entryPrice: 0.5,
    takeProfitPrice: 0.8,
    stopLossPrice: 0.3,
    ...overrides,
  };
}

function makeOcoDto(overrides: Record<string, unknown> = {}) {
  return {
    type: "OCO",
    tokenId: "token-uuid-1",
    side: "BUY",
    outcome: "YES",
    totalSize: 100,
    priceA: 0.4,
    priceB: 0.6,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("SmartOrderService", () => {
  let service: SmartOrderService;
  let db: MockDb;
  let redis: RedisService;

  beforeEach(() => {
    db = createMockDb();
    redis = {
      xadd: vi.fn().mockResolvedValue("stream-entry-id"),
      getClient: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
      }),
    } as unknown as RedisService;
    service = new SmartOrderService(db as any, redis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a TWAP smart order with correct slicesTotal", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(makeSmartOrder() as any);

      const result = await service.create("user-uuid-1", makeTwapDto() as any);

      expect(result.status).toBe("PENDING");
      expect(result.type).toBe("TWAP");
      expect(result.slicesTotal).toBe(5);
      expect(result.smartOrderId).toBe("smart-uuid-1");
    });

    it("creates a DCA smart order with correct slicesTotal", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "DCA" }) as any,
      );

      const result = await service.create(
        "user-uuid-1",
        makeTwapDto({ type: "DCA", slices: 10 }) as any,
      );

      expect(result.type).toBe("DCA");
      expect(result.slicesTotal).toBe(10);
    });

    it("throws NOT_CONNECTED when user is not connected", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.create("user-uuid-1", makeTwapDto() as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws NOT_CONNECTED when user is null", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create("user-uuid-1", makeTwapDto() as any),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });

    it("throws TOKEN_NOT_FOUND when token does not exist", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue(null);

      await expect(
        service.create("user-uuid-1", makeTwapDto() as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws MAX_SMART_ORDERS when the user already has 25 active smart orders", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.count.mockResolvedValue(25);

      await expect(
        service.create("user-uuid-1", makeTwapDto() as any),
      ).rejects.toMatchObject({
        response: {
          code: "MAX_SMART_ORDERS",
        },
      });
      expect(db.smartOrder.create).not.toHaveBeenCalled();
    });

    it("creates BRACKET order with slicesTotal = 3", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "BRACKET", slicesTotal: 3 }) as any,
      );
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      const result = await service.create(
        "user-uuid-1",
        makeBracketDto() as any,
      );

      expect(result.slicesTotal).toBe(3);
      // BRACKET publishes 3 legs to stream:orders
      expect(redis.xadd).toHaveBeenCalledTimes(3);
    });

    it("creates OCO order with slicesTotal = 2", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "OCO", slicesTotal: 2 }) as any,
      );
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      const result = await service.create("user-uuid-1", makeOcoDto() as any);

      expect(result.slicesTotal).toBe(2);
      // OCO publishes 2 legs to stream:orders
      expect(redis.xadd).toHaveBeenCalledTimes(2);
    });

    it("BRACKET publishes entry with same side and TP/SL with opposite side", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "BRACKET", slicesTotal: 3 }) as any,
      );
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.create("user-uuid-1", makeBracketDto() as any);

      const calls = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls;
      // First call: ENTRY leg with side BUY
      expect(calls[0][1]).toMatchObject({ side: "BUY", bracketLeg: "ENTRY" });
      // Second call: TAKE_PROFIT with opposite side SELL
      expect(calls[1][1]).toMatchObject({
        side: "SELL",
        bracketLeg: "TAKE_PROFIT",
      });
      // Third call: STOP_LOSS with opposite side SELL
      expect(calls[2][1]).toMatchObject({
        side: "SELL",
        bracketLeg: "STOP_LOSS",
      });
    });

    it("OCO publishes both legs with correct prices", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "OCO", slicesTotal: 2 }) as any,
      );
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.create("user-uuid-1", makeOcoDto() as any);

      const calls = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][1]).toMatchObject({ ocoLeg: "LEG_A" });
      expect(calls[1][1]).toMatchObject({ ocoLeg: "LEG_B" });
    });

    it("BRACKET publishes 3 intents to stream with orderId", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "BRACKET", slicesTotal: 3 }) as any,
      );
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.create("user-uuid-1", makeBracketDto() as any);

      expect(db.order.create).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledTimes(3);
      const calls = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls;
      for (const call of calls) {
        expect(call[1].orderId).toBeTypeOf("string");
        expect(call[1].intentId).toBeTypeOf("string");
      }
    });

    it("BRACKET sets smartOrder status to ACTIVE", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "BRACKET", slicesTotal: 3 }) as any,
      );
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.create("user-uuid-1", makeBracketDto() as any);

      expect(db.smartOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("cancels a PENDING smart order", async () => {
      db.smartOrder.findFirst.mockResolvedValue(
        makeSmartOrder({ status: "PENDING" }) as any,
      );
      db.order.findMany.mockResolvedValue([]);
      db.smartOrder.update.mockResolvedValue({} as any);

      const result = await service.cancel("user-uuid-1", "smart-uuid-1");

      expect(result).toEqual({ cancelled: true });
    });

    it("cancels an ACTIVE smart order", async () => {
      db.smartOrder.findFirst.mockResolvedValue(
        makeSmartOrder({ status: "ACTIVE" }) as any,
      );
      db.order.findMany.mockResolvedValue([]);
      db.smartOrder.update.mockResolvedValue({} as any);

      const result = await service.cancel("user-uuid-1", "smart-uuid-1");

      expect(result).toEqual({ cancelled: true });
    });

    it("throws NOT_FOUND when smart order does not exist", async () => {
      db.smartOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel("user-uuid-1", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NOT_CANCELLABLE for COMPLETED order", async () => {
      db.smartOrder.findFirst.mockResolvedValue(
        makeSmartOrder({ status: "COMPLETED" }) as any,
      );

      await expect(
        service.cancel("user-uuid-1", "smart-uuid-1"),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws NOT_CANCELLABLE for FAILED order", async () => {
      db.smartOrder.findFirst.mockResolvedValue(
        makeSmartOrder({ status: "FAILED" }) as any,
      );

      await expect(
        service.cancel("user-uuid-1", "smart-uuid-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_CANCELLABLE" },
      });
    });

    it("publishes cancellation for pending child orders", async () => {
      db.smartOrder.findFirst.mockResolvedValue(
        makeSmartOrder({ status: "ACTIVE" }) as any,
      );
      db.order.findMany.mockResolvedValue([
        { intentId: "intent-1", status: "PENDING" },
        { intentId: "intent-2", status: "SUBMITTED" },
      ] as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.cancel("user-uuid-1", "smart-uuid-1");

      expect(redis.xadd).toHaveBeenCalledTimes(2);
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:cancellations",
        expect.objectContaining({
          intentId: "intent-1",
          reason: "SMART_ORDER_CANCELLED",
        }),
      );
    });

    it("updates smart order status to CANCELLED with completedAt", async () => {
      db.smartOrder.findFirst.mockResolvedValue(
        makeSmartOrder({ status: "PENDING" }) as any,
      );
      db.order.findMany.mockResolvedValue([]);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.cancel("user-uuid-1", "smart-uuid-1");

      expect(db.smartOrder.update).toHaveBeenCalledWith({
        where: { id: "smart-uuid-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  // ── list ─────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns smart orders with child order details", async () => {
      db.smartOrder.findMany.mockResolvedValue([
        makeSmartOrder({
          orders: [
            {
              id: "order-1",
              status: "CONFIRMED",
              fillSize: "20",
              fillPrice: "0.50",
              createdAt: new Date(),
            },
          ],
        }),
      ] as any);

      const result = await service.list("user-uuid-1");

      expect(result).toHaveLength(1);
      expect(result[0].orders).toHaveLength(1);
    });

    it("scopes query to the requesting user", async () => {
      db.smartOrder.findMany.mockResolvedValue([]);

      await service.list("user-xyz");

      expect(db.smartOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-xyz" },
        }),
      );
    });

    it("returns at most 50 smart orders", async () => {
      db.smartOrder.findMany.mockResolvedValue([]);

      await service.list("user-uuid-1");

      expect(db.smartOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it("orders by createdAt desc", async () => {
      db.smartOrder.findMany.mockResolvedValue([]);

      await service.list("user-uuid-1");

      expect(db.smartOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });
  });

  // ── executeSlices ────────────────────────────────────────────────────────

  describe("executeSlices", () => {
    it("executes due TWAP slices and publishes to stream:orders", async () => {
      const smart = makeSmartOrder({
        slicesFilled: 0,
        slicesTotal: 5,
        config: { slices: 5, intervalMinutes: 10, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      expect(db.order.create).not.toHaveBeenCalled();
      const callArgs = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe("stream:orders");
      expect(callArgs[1]).toMatchObject({
        userId: "user-uuid-1",
        tokenId: "token-uuid-1",
        side: "BUY",
        orderType: "FOK", // no limitPrice => FOK
      });
      expect(callArgs[1].orderId).toBeTypeOf("string");
      expect(callArgs[1].intentId).toBeTypeOf("string");
    });

    it("marks smart order as COMPLETED when last slice is filled", async () => {
      const smart = makeSmartOrder({
        slicesFilled: 4,
        slicesTotal: 5,
        config: { slices: 5, intervalMinutes: 10, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      expect(db.smartOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "COMPLETED",
            slicesFilled: 5,
            completedAt: expect.any(Date),
            nextExecuteAt: null,
          }),
        }),
      );
    });

    it("sets status to ACTIVE and schedules next slice when not complete", async () => {
      const smart = makeSmartOrder({
        slicesFilled: 1,
        slicesTotal: 5,
        config: { slices: 5, intervalMinutes: 10, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      expect(db.smartOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ACTIVE",
            slicesFilled: 2,
            nextExecuteAt: expect.any(Date),
            completedAt: null,
          }),
        }),
      );
    });

    it("uses GTC orderType when limitPrice is set", async () => {
      const smart = makeSmartOrder({
        slicesFilled: 0,
        slicesTotal: 5,
        config: { slices: 5, intervalMinutes: 10, limitPrice: 0.65 },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({ orderType: "GTC" }),
      );
    });

    it("does nothing when no smart orders are due", async () => {
      db.smartOrder.findMany.mockResolvedValue([]);

      await service.executeSlices();

      expect(redis.xadd).not.toHaveBeenCalled();
      expect(db.order.create).not.toHaveBeenCalled();
    });

    it("publishes slice to stream:orders with orderId (no duplicate DB create)", async () => {
      const smart = makeSmartOrder({
        slicesFilled: 0,
        slicesTotal: 5,
        config: { slices: 5, intervalMinutes: 10, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      expect(db.order.create).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          orderType: "FOK",
        }),
      );
      const call = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].orderId).toBeTypeOf("string");
      expect(call[1].intentId).toBeTypeOf("string");
    });

    it("calculates correct slice size as totalSize / slicesTotal", async () => {
      const smart = makeSmartOrder({
        totalSize: 100,
        slicesFilled: 0,
        slicesTotal: 4,
        config: { slices: 4, intervalMinutes: 5, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.order.create.mockResolvedValue({} as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      // 100 / 4 = 25
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({ size: "25.000000" }),
      );
    });

    it("marks invalid zero-slice orders failed without emitting Infinity size", async () => {
      const smart = makeSmartOrder({
        totalSize: 100,
        slicesFilled: 0,
        slicesTotal: 0,
        config: { slices: 0, intervalMinutes: 5, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.smartOrder.update.mockResolvedValue({} as any);

      await service.executeSlices();

      expect(redis.xadd).not.toHaveBeenCalled();
      expect(db.order.create).not.toHaveBeenCalled();
      expect(db.smartOrder.update).toHaveBeenCalledWith({
        where: { id: "smart-uuid-1" },
        data: expect.objectContaining({ status: "FAILED" }),
      });
    });
  });

  // ── xadd failure handling ──────────────────────────────────────────────

  describe("xadd failure handling", () => {
    it("throws when BRACKET legs publish fails and marks smart order FAILED", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "BRACKET", slicesTotal: 3 }) as any,
      );
      db.smartOrder.update.mockResolvedValue({} as any);
      (redis.xadd as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Redis down"),
      );

      await expect(
        service.create("user-uuid-1", makeBracketDto() as any),
      ).rejects.toThrow(Error);

      // Smart order should be marked FAILED
      expect(db.smartOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("throws when OCO legs publish fails and marks smart order FAILED", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.token.findUnique.mockResolvedValue({
        id: "token-uuid-1",
        marketId: "market-uuid-1",
      } as any);
      db.smartOrder.create.mockResolvedValue(
        makeSmartOrder({ type: "OCO", slicesTotal: 2 }) as any,
      );
      db.smartOrder.update.mockResolvedValue({} as any);
      (redis.xadd as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Redis down"),
      );

      await expect(
        service.create("user-uuid-1", makeOcoDto() as any),
      ).rejects.toThrow(Error);

      expect(db.smartOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
    });

    it("throws when TWAP slice publish fails", async () => {
      const smart = makeSmartOrder({
        slicesFilled: 0,
        slicesTotal: 5,
        config: { slices: 5, intervalMinutes: 10, limitPrice: null },
      });
      db.smartOrder.findMany.mockResolvedValue([smart] as any);
      db.smartOrder.update.mockResolvedValue({} as any);
      (redis.xadd as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Redis OOM"),
      );

      // executeSlices catches errors internally per-slice
      await service.executeSlices();

      // Smart order should NOT be marked COMPLETED since xadd failed
      const completedCalls = (
        db.smartOrder.update as ReturnType<typeof vi.fn>
      ).mock.calls.filter(([args]: any[]) => args.data?.status === "COMPLETED");
      expect(completedCalls).toHaveLength(0);
    });
  });
});
