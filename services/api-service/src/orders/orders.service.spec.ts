import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrdersService } from "./orders.service";
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
    service = new OrdersService(db as any, redis, config, {} as any);
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

      const result = await service.list("user-uuid-1", makeOrderQuery() as any);

      expect(result.data).toEqual(orders);
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
});
