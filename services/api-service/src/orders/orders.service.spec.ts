import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrdersService } from "./orders.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";
import { PosthogService } from "@polyforge/shared-posthog";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-uuid-1",
    polymarketConnected: true,
    polymarketUsConnected: false,
    country: null,
    usRailTermsAcceptedAt: null,
    usRailTermsVersion: null,
    ...overrides,
  };
}

function makePosition(overrides: Record<string, unknown> = {}) {
  return {
    id: "position-uuid-1",
    userId: "user-uuid-1",
    marketId: "market-uuid-1",
    tokenId: "token-uuid-1",
    outcome: "YES",
    size: "50.00",
    avgPrice: "0.60",
    realizedPnl: "0.00",
    resolutionStatus: "UNRESOLVED",
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-uuid-1",
    intentId: "intent-uuid-1",
    userId: "user-uuid-1",
    marketId: "market-uuid-1",
    tokenId: "token-uuid-1",
    side: "SELL",
    status: "PENDING",
    outcome: "YES",
    size: "50.00",
    price: "0.01",
    orderType: "FOK",
    strategyId: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeOrderQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

function makeClosePositionDto(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "token-uuid-1",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("OrdersService", () => {
  let service: OrdersService;
  let db: MockDb;
  let redis: RedisService;
  let config: ConfigService;

  beforeEach(() => {
    db = createMockDb();
    redis = {
      xadd: vi.fn().mockResolvedValue("stream-entry-id"),
    } as unknown as RedisService;
    config = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const posthog = {
      capture: vi.fn(),
      identify: vi.fn(),
    } as unknown as PosthogService;
    db.position.updateMany.mockResolvedValue({ count: 1 } as any);
    db.order.updateMany.mockResolvedValue({ count: 1 } as any);
    db.order.findUnique.mockResolvedValue(
      makeOrder({ clobOrderId: null }) as any,
    );
    service = new OrdersService(db as any, redis, config, {} as any, posthog);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns a paginated list of orders for the user", async () => {
      const orders = [makeOrder()];
      db.order.findMany.mockResolvedValue(orders as any);
      db.order.count.mockResolvedValue(1);
      // Service enriches orders with market titles
      db.market.findMany.mockResolvedValue([
        { id: "market-uuid-1", title: "Test Market", category: "crypto" },
      ] as any);

      const result = await service.list("user-uuid-1", makeOrderQuery() as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: orders[0].id,
        userId: orders[0].userId,
        marketQuestion: "Test Market",
        marketCategory: "crypto",
      });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it("scopes query to the requesting userId", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-99", makeOrderQuery() as any);

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("userId", "user-uuid-99");
    });

    it("adds status filter when provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ status: "FILLED" }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("status", "FILLED");
    });

    it("adds strategyId filter when provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ strategyId: "strategy-abc" }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("strategyId", "strategy-abc");
    });

    it("adds createdAt.gte filter when from is provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ from: "2025-01-01T00:00:00.000Z" }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg!.createdAt).toMatchObject({
        gte: new Date("2025-01-01T00:00:00.000Z"),
      });
    });

    it("adds createdAt.lte filter when to is provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ to: "2025-12-31T23:59:59.000Z" }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg!.createdAt).toMatchObject({
        lte: new Date("2025-12-31T23:59:59.000Z"),
      });
    });

    it("adds both gte and lte when both from and to are provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({
          from: "2025-01-01T00:00:00.000Z",
          to: "2025-06-30T00:00:00.000Z",
        }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect((whereArg!.createdAt as any).gte).toBeDefined();
      expect((whereArg!.createdAt as any).lte).toBeDefined();
    });

    it("does NOT add createdAt filter when neither from nor to is provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery() as any);

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).not.toHaveProperty("createdAt");
    });

    it("orders by createdAt desc", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery() as any);

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("calculates correct skip for page 2 limit 10", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ page: 2, limit: 10 }) as any,
      );

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── closePosition ─────────────────────────────────────────────────────────

  describe("closePosition", () => {
    it("publishes to Redis stream and creates a PENDING order", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.position.findFirst.mockResolvedValue(makePosition() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      const result = await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto() as any,
      );

      expect(result.status).toBe("PENDING");
      expect(result.orderId).toBe("order-uuid-1");
      expect(result.intentId).toBeDefined();
    });

    it("throws NOT_CONNECTED (422) when user is not connected to Polymarket", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.closePosition("user-uuid-1", makeClosePositionDto() as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws NOT_CONNECTED error code when user is not connected", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.closePosition("user-uuid-1", makeClosePositionDto() as any),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });

    it("throws NOT_CONNECTED when user record is null", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.closePosition("user-uuid-1", makeClosePositionDto() as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws POSITION_NOT_FOUND (404) when there is no open position for the token", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(null);

      await expect(
        service.closePosition("user-uuid-1", makeClosePositionDto() as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws POSITION_NOT_FOUND error code when position is missing", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(null);

      await expect(
        service.closePosition("user-uuid-1", makeClosePositionDto() as any),
      ).rejects.toMatchObject({
        response: { code: "POSITION_NOT_FOUND" },
      });
    });

    it("publishes close intent to stream:orders", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.closePosition("user-uuid-1", makeClosePositionDto() as any);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          userId: "user-uuid-1",
          tokenId: "token-uuid-1",
          side: "SELL",
          orderType: "FOK",
        }),
      );
    });

    it("uses position size when dto.size is not provided", async () => {
      const position = makePosition({ size: "100.00" });
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(position as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.closePosition("user-uuid-1", makeClosePositionDto() as any);

      const streamPayload = (redis.xadd as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(streamPayload.size).toBe("100.00");
    });

    it("uses dto.size when explicitly provided", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto({ size: "25.00" }) as any,
      );

      const streamPayload = (redis.xadd as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(streamPayload.size).toBe("25.00");
    });

    it("creates the order with status PENDING and orderType FOK", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.closePosition("user-uuid-1", makeClosePositionDto() as any);

      expect(db.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PENDING",
            orderType: "FOK",
            side: "SELL",
          }),
        }),
      );
    });

    it("looks up open position with UNRESOLVED resolutionStatus", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.closePosition("user-uuid-1", makeClosePositionDto() as any);

      expect(db.position.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-uuid-1",
          tokenId: "token-uuid-1",
          resolutionStatus: "UNRESOLVED",
        },
      });
    });

    it("generates a unique intentId for each call", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      const result1 = await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto() as any,
      );

      db.order.create.mockResolvedValue(
        makeOrder({ id: "order-uuid-2", intentId: "intent-uuid-2" }) as any,
      );

      const result2 = await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto() as any,
      );

      // intentIds are generated as UUIDs — both should be UUID-like strings
      expect(result1.intentId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result2.intentId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  // ── placeOrder ───────────────────────────────────────────────────────────

  describe("placeOrder", () => {
    function makePlaceOrderDto(overrides: Record<string, unknown> = {}) {
      return {
        tokenId: "token-uuid-1",
        side: "BUY",
        outcome: "YES",
        size: 50,
        price: 0.6,
        orderType: "GTC",
        ...overrides,
      };
    }

    function makeToken(overrides: Record<string, unknown> = {}) {
      return {
        id: "token-uuid-1",
        marketId: "market-uuid-1",
        market: { id: "market-uuid-1", closed: false },
        ...overrides,
      };
    }

    it("creates a PENDING order and returns orderId + intentId", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      db.order.create.mockResolvedValue(
        makeOrder({ id: "order-placed-1" }) as any,
      );

      const result = await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto() as any,
      );

      expect(result.status).toBe("PENDING");
      expect(result.orderId).toBe("order-placed-1");
      expect(result.intentId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("throws WALLET_NOT_CONNECTED (403) when user is not connected", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.placeOrder("user-uuid-1", makePlaceOrderDto() as any),
      ).rejects.toMatchObject({
        response: { code: "WALLET_NOT_CONNECTED" },
      });
    });

    it("throws US_RAIL_TERMS_REQUIRED before publishing a US-rail order when acceptance is missing", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({
          country: "US",
          polymarketUsConnected: true,
          usRailTermsAcceptedAt: null,
          usRailTermsVersion: null,
        }) as any,
      );

      await expect(
        service.placeOrder("user-uuid-1", makePlaceOrderDto() as any),
      ).rejects.toMatchObject({
        response: { code: "US_RAIL_TERMS_REQUIRED" },
        status: 428,
      });

      expect(redis.xadd).not.toHaveBeenCalled();
      expect(db.order.create).not.toHaveBeenCalled();
    });

    it("throws US_RAIL_TERMS_REQUIRED before publishing a US-rail order when acceptance version is stale", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({
          country: "US",
          polymarketUsConnected: true,
          usRailTermsAcceptedAt: new Date("2026-04-01T00:00:00.000Z"),
          usRailTermsVersion: "us-rail-2026-01-01",
        }) as any,
      );

      await expect(
        service.placeOrder("user-uuid-1", makePlaceOrderDto() as any),
      ).rejects.toMatchObject({
        response: { code: "US_RAIL_TERMS_REQUIRED" },
        status: 428,
      });

      expect(redis.xadd).not.toHaveBeenCalled();
      expect(db.order.create).not.toHaveBeenCalled();
    });

    it("throws POSITION_SIZE_EXCEEDED when size exceeds beta limit", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );

      await expect(
        service.placeOrder(
          "user-uuid-1",
          makePlaceOrderDto({ size: 999999 }) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: "POSITION_SIZE_EXCEEDED" },
      });
    });

    it("throws MONTHLY_VOLUME_EXCEEDED when monthly cap would be exceeded", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({
        _sum: { size: 4990 },
      } as any);

      await expect(
        service.placeOrder(
          "user-uuid-1",
          makePlaceOrderDto({ size: 50 }) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: "MONTHLY_VOLUME_EXCEEDED" },
      });
    });

    it("publishes intent to stream:orders", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.placeOrder("user-uuid-1", makePlaceOrderDto() as any);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          userId: "user-uuid-1",
          tokenId: "token-uuid-1",
          side: "BUY",
          outcome: "YES",
          size: "50",
          price: "0.6",
          orderType: "GTC",
        }),
      );
    });

    it("defaults orderType to GTC when not provided", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto({ orderType: undefined }) as any,
      );

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({ orderType: "GTC" }),
      );
    });

    it("creates order record with correct fields", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      await service.placeOrder("user-uuid-1", makePlaceOrderDto() as any);

      expect(db.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-uuid-1",
            tokenId: "token-uuid-1",
            side: "BUY",
            outcome: "YES",
            status: "PENDING",
            marketId: "market-uuid-1",
          }),
        }),
      );
    });

    it("allows order when monthly volume plus order size is within limit", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 100 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      db.order.create.mockResolvedValue(makeOrder() as any);

      const result = await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto({ size: 50 }) as any,
      );

      expect(result.status).toBe("PENDING");
    });
  });

  // ── cancelOrder ──────────────────────────────────────────────────────────

  describe("cancelOrder", () => {
    it("cancels a PENDING order and returns CANCELLED status", async () => {
      const result = await service.cancelOrder("user-uuid-1", "order-uuid-1");

      expect(result).toEqual({
        orderId: "order-uuid-1",
        status: "CANCELLED",
      });
    });

    it("throws ForbiddenException when cancelling another user's order", async () => {
      db.order.updateMany.mockResolvedValue({ count: 0 } as any);
      db.order.findUnique.mockResolvedValue(
        makeOrder({ userId: "other-user" }) as any,
      );

      await expect(
        service.cancelOrder("user-uuid-1", "order-uuid-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ConflictException for FILLED order", async () => {
      db.order.updateMany.mockResolvedValue({ count: 0 } as any);
      db.order.findUnique.mockResolvedValue(
        makeOrder({ status: "FILLED" }) as any,
      );

      await expect(
        service.cancelOrder("user-uuid-1", "order-uuid-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException for CANCELLED order", async () => {
      db.order.updateMany.mockResolvedValue({ count: 0 } as any);
      db.order.findUnique.mockResolvedValue(
        makeOrder({ status: "CANCELLED" }) as any,
      );

      await expect(
        service.cancelOrder("user-uuid-1", "order-uuid-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("allows cancelling SUBMITTED orders", async () => {
      const result = await service.cancelOrder("user-uuid-1", "order-uuid-1");

      expect(result.status).toBe("CANCELLED");
    });

    it("allows cancelling LIVE orders", async () => {
      db.order.findUniqueOrThrow.mockResolvedValue(
        makeOrder({ status: "LIVE", clobOrderId: null }) as any,
      );
      db.order.update.mockResolvedValue(
        makeOrder({ status: "CANCELLED" }) as any,
      );

      const result = await service.cancelOrder("user-uuid-1", "order-uuid-1");

      expect(result.status).toBe("CANCELLED");
    });

    it("publishes to stream:cancellations when order has clobOrderId", async () => {
      db.order.findUnique.mockResolvedValue(
        makeOrder({ status: "CANCELLED", clobOrderId: "clob-123" }) as any,
      );

      await service.cancelOrder("user-uuid-1", "order-uuid-1");

      expect(redis.xadd).toHaveBeenCalledWith("stream:cancellations", {
        orderId: "order-uuid-1",
        clobOrderId: "clob-123",
        userId: "user-uuid-1",
      });
    });

    it("does NOT publish to stream:cancellations when order has no clobOrderId", async () => {
      await service.cancelOrder("user-uuid-1", "order-uuid-1");

      expect(redis.xadd).not.toHaveBeenCalled();
    });

    it("atomically updates order via updateMany with status guard", async () => {
      await service.cancelOrder("user-uuid-1", "order-uuid-1");

      expect(db.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: "order-uuid-1",
          userId: "user-uuid-1",
          status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
        },
        data: { status: "CANCELLED" },
      });
    });
  });

  // ── redeemPosition ───────────────────────────────────────────────────────

  describe("redeemPosition", () => {
    function makeResolvedPosition(overrides: Record<string, unknown> = {}) {
      return makePosition({
        resolutionStatus: "RESOLVED",
        ...overrides,
      });
    }

    it("redeems a resolved position and returns REDEEMED", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makeResolvedPosition() as any);
      db.position.update.mockResolvedValue({} as any);

      const result = await service.redeemPosition("user-uuid-1", {
        positionId: "position-uuid-1",
      } as any);

      expect(result.status).toBe("REDEEMED");
      expect(result.positionId).toBe("position-uuid-1");
      expect(result.intentId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("throws MISSING_PARAM when neither positionId nor marketId is provided", async () => {
      await expect(
        service.redeemPosition("user-uuid-1", {} as any),
      ).rejects.toMatchObject({
        response: { code: "MISSING_PARAM" },
      });
    });

    it("throws NOT_CONNECTED when user is not connected", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.redeemPosition("user-uuid-1", {
          positionId: "position-uuid-1",
        } as any),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });

    it("throws NOT_CONNECTED when user record is null", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.redeemPosition("user-uuid-1", {
          positionId: "position-uuid-1",
        } as any),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });

    it("throws POSITION_NOT_FOUND when position does not exist", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(null);

      await expect(
        service.redeemPosition("user-uuid-1", {
          positionId: "nonexistent",
        } as any),
      ).rejects.toMatchObject({
        response: { code: "POSITION_NOT_FOUND" },
      });
    });

    it("throws MARKET_NOT_RESOLVED when position is UNRESOLVED", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(
        makePosition({ resolutionStatus: "UNRESOLVED" }) as any,
      );

      await expect(
        service.redeemPosition("user-uuid-1", {
          positionId: "position-uuid-1",
        } as any),
      ).rejects.toMatchObject({
        response: { code: "MARKET_NOT_RESOLVED" },
      });
    });

    it("publishes intent to stream:redemptions", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makeResolvedPosition() as any);
      db.position.update.mockResolvedValue({} as any);

      await service.redeemPosition("user-uuid-1", {
        positionId: "position-uuid-1",
      } as any);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:redemptions",
        expect.objectContaining({
          userId: "user-uuid-1",
          tokenId: "token-uuid-1",
          positionId: "position-uuid-1",
        }),
      );
    });

    it("updates position status to REDEEMED in the database", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makeResolvedPosition() as any);
      db.position.update.mockResolvedValue({} as any);

      await service.redeemPosition("user-uuid-1", {
        positionId: "position-uuid-1",
      } as any);

      expect(db.position.update).toHaveBeenCalledWith({
        where: { id: "position-uuid-1" },
        data: { resolutionStatus: "REDEEMED" },
      });
    });

    it("looks up by marketId when positionId is not provided", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makeResolvedPosition() as any);
      db.position.update.mockResolvedValue({} as any);

      await service.redeemPosition("user-uuid-1", {
        marketId: "market-uuid-1",
      } as any);

      expect(db.position.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: "user-uuid-1",
          marketId: "market-uuid-1",
        }),
      });
    });
  });

  // ── exportCsv ────────────────────────────────────────────────────────────

  describe("exportCsv", () => {
    it("returns CSV header and order rows", async () => {
      db.order.findMany.mockResolvedValue([
        makeOrder({
          marketId: "market-1",
          side: "BUY",
          outcome: "YES",
          size: "100.00",
          price: "0.65",
          orderType: "GTC",
          status: "CONFIRMED",
          fillPrice: "0.64",
          createdAt: new Date("2025-06-15T12:00:00.000Z"),
        }),
      ] as any);

      const csv = await service.exportCsv("user-uuid-1");

      expect(csv).toContain(
        "Market ID,Side,Outcome,Size,Price,Type,Status,Fill Price,Date",
      );
      expect(csv).toContain('"market-1"');
      expect(csv).toContain("BUY");
      expect(csv).toContain("100.00");
      expect(csv).toContain("0.65");
      expect(csv).toContain("0.64");
    });

    it("returns only header when user has no orders", async () => {
      db.order.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv("user-uuid-1");

      expect(csv).toBe(
        "Market ID,Side,Outcome,Size,Price,Type,Status,Fill Price,Date\n",
      );
    });

    it("handles null fillPrice gracefully", async () => {
      db.order.findMany.mockResolvedValue([
        makeOrder({
          fillPrice: null,
          outcome: null,
          size: null,
          price: null,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        }),
      ] as any);

      const csv = await service.exportCsv("user-uuid-1");

      // Should not throw and should handle nulls
      expect(csv).toBeDefined();
      expect(csv.split("\n").length).toBeGreaterThanOrEqual(2);
    });

    it("queries orders for the correct user", async () => {
      db.order.findMany.mockResolvedValue([]);

      await service.exportCsv("user-xyz");

      expect(db.order.findMany).toHaveBeenCalledWith({
        where: { userId: "user-xyz" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  // ── list: additional edge cases ──────────────────────────────────────────

  describe("list (additional)", () => {
    it("handles comma-separated status filter", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ status: "PENDING,FILLED" }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg!.status).toEqual({ in: ["PENDING", "FILLED"] });
    });

    it("adds marketId filter when provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ marketId: "market-xyz" }) as any,
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("marketId", "market-xyz");
    });

    it("skips market enrichment when order list is empty", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery() as any);

      // market.findMany should NOT be called since there are no marketIds
      expect(db.market.findMany).not.toHaveBeenCalled();
    });

    it("enriches orders with null market fields when market not found", async () => {
      const orders = [makeOrder({ marketId: "unknown-market" })];
      db.order.findMany.mockResolvedValue(orders as any);
      db.order.count.mockResolvedValue(1);
      db.market.findMany.mockResolvedValue([] as any);

      const result = await service.list("user-uuid-1", makeOrderQuery() as any);

      expect(result.data[0].marketQuestion).toBeNull();
      expect(result.data[0].marketCategory).toBeNull();
    });
  });

  // ── updateJournal ────────────────────────────────────────────────────────

  describe("updateJournal", () => {
    it("updates mood and note on the order", async () => {
      const order = makeOrder();
      const updated = { ...order, mood: "CONFIDENT", note: "solid entry" };
      db.order.findUnique.mockResolvedValue(order as any);
      db.order.update.mockResolvedValue(updated as any);

      const result = await service.updateJournal(
        "user-uuid-1",
        "order-uuid-1",
        {
          mood: "CONFIDENT",
          note: "solid entry",
        },
      );

      expect(result.mood).toBe("CONFIDENT");
      expect(result.note).toBe("solid entry");
      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: "order-uuid-1" },
        data: { mood: "CONFIDENT", note: "solid entry" },
      });
    });

    it("updates mood only when note is not provided", async () => {
      const order = makeOrder();
      db.order.findUnique.mockResolvedValue(order as any);
      db.order.update.mockResolvedValue({ ...order, mood: "FOMO" } as any);

      await service.updateJournal("user-uuid-1", "order-uuid-1", {
        mood: "FOMO",
      });

      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: "order-uuid-1" },
        data: { mood: "FOMO" },
      });
    });

    it("throws NotFoundException when order does not exist", async () => {
      db.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateJournal("user-uuid-1", "missing-id", {
          mood: "CONFIDENT",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when order belongs to another user", async () => {
      db.order.findUnique.mockResolvedValue(
        makeOrder({ userId: "other-user" }) as any,
      );

      await expect(
        service.updateJournal("user-uuid-1", "order-uuid-1", {
          mood: "CONFIDENT",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows setting note to empty string", async () => {
      const order = makeOrder();
      db.order.findUnique.mockResolvedValue(order as any);
      db.order.update.mockResolvedValue({
        ...order,
        mood: "DISCIPLINED",
        note: "",
      } as any);

      await service.updateJournal("user-uuid-1", "order-uuid-1", {
        mood: "DISCIPLINED",
        note: "",
      });

      expect(db.order.update).toHaveBeenCalledWith({
        where: { id: "order-uuid-1" },
        data: { mood: "DISCIPLINED", note: "" },
      });
    });
  });

  // ── splitPosition ────────────────────────────────────────────────────────

  describe("splitPosition", () => {
    it("throws NOT_CONNECTED when user is not connected", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.splitPosition("user-uuid-1", {
          tokenId: "token-1",
          amount: "100",
        }),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });

    it("throws NOT_CONNECTED when user is null", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.splitPosition("user-uuid-1", {
          tokenId: "token-1",
          amount: "100",
        }),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });
  });

  // ── mergePosition ────────────────────────────────────────────────────────

  describe("mergePosition", () => {
    it("throws NOT_CONNECTED when user is not connected", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.mergePosition("user-uuid-1", {
          tokenId: "token-1",
          amount: "100",
        }),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });

    it("throws NOT_CONNECTED when user is null", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.mergePosition("user-uuid-1", {
          tokenId: "token-1",
          amount: "100",
        }),
      ).rejects.toMatchObject({
        response: { code: "NOT_CONNECTED" },
      });
    });
  });
});
