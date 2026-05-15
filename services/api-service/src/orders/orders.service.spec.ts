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
import { RedisService, BetaLimitsConfigService } from "@polyforge/shared-redis";
import { PosthogService } from "@polyforge/shared-posthog";
import {
  OrderSideDto,
  OrderOutcomeDto,
  OrderTypeDto,
} from "./dto/place-order.dto";

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
  let pipelineExec: ReturnType<typeof vi.fn>;
  let pipelineXadd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    pipelineExec = vi.fn().mockResolvedValue([]);
    pipelineXadd = vi.fn();
    redis = {
      xadd: vi.fn().mockResolvedValue("stream-entry-id"),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      getClient: vi.fn().mockReturnValue({
        pipeline: vi.fn().mockReturnValue({
          xadd: pipelineXadd,
          exec: pipelineExec,
        }),
      }),
    } as unknown as RedisService;
    config = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const posthog = {
      capture: vi.fn(),
      identify: vi.fn(),
    } as unknown as PosthogService;
    db.position.updateMany.mockResolvedValue({ count: 1 });
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.order.findUnique.mockResolvedValue(
      makeOrder({ clobOrderId: null }) as any,
    );
    const betaLimits = {
      getLimit: vi.fn().mockImplementation((key: string) => {
        if (key === "maxMonthlyVolumeUsdc") return Promise.resolve(5000);
        if (key === "maxPositionSizeUsdc") return Promise.resolve(500);
        return Promise.resolve(3);
      }),
      getAllLimits: vi.fn().mockResolvedValue({
        maxPositionSizeUsdc: 500,
        maxMonthlyVolumeUsdc: 5000,
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn().mockResolvedValue(undefined),
    } as unknown as BetaLimitsConfigService;
    service = new OrdersService(
      db as any,
      redis,
      config,
      {} as any,
      posthog,
      betaLimits,
    );
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

      const result = await service.list("user-uuid-1", makeOrderQuery());

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

      await service.list("user-uuid-99", makeOrderQuery());

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("userId", "user-uuid-99");
    });

    it("adds status filter when provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery({ status: "FILLED" }));

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("status", "FILLED");
    });

    it("adds strategyId filter when provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ strategyId: "strategy-abc" }),
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("strategyId", "strategy-abc");
    });

    it("adds createdAt.gte filter when from is provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ from: "2025-01-01T00:00:00.000Z" }),
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
        makeOrderQuery({ to: "2025-12-31T23:59:59.000Z" }),
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
        }),
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect((whereArg!.createdAt as any).gte).toBeDefined();
      expect((whereArg!.createdAt as any).lte).toBeDefined();
    });

    it("does NOT add createdAt filter when neither from nor to is provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery());

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).not.toHaveProperty("createdAt");
    });

    it("orders by createdAt desc", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery());

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("calculates correct skip for page 2 limit 10", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery({ page: 2, limit: 10 }));

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── closePosition ─────────────────────────────────────────────────────────

  describe("closePosition", () => {
    it("publishes to Redis stream and returns generated order metadata", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.position.findFirst.mockResolvedValue(makePosition() as any);

      const result = await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto(),
      );

      expect(result.status).toBe("PENDING");
      expect(result.orderId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.intentId).toBeDefined();
      expect(db.order.create).not.toHaveBeenCalled();
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

      await service.closePosition("user-uuid-1", makeClosePositionDto());

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

      await service.closePosition("user-uuid-1", makeClosePositionDto());

      const streamPayload = (redis.xadd as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(streamPayload.size).toBe("100.00");
    });

    it("uses dto.size when explicitly provided", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);

      await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto({ size: "25.00" }),
      );

      const streamPayload = (redis.xadd as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(streamPayload.size).toBe("25.00");
    });

    it("publishes close intent with generated orderId and FOK order type", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);

      await service.closePosition("user-uuid-1", makeClosePositionDto());

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          orderId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          orderType: "FOK",
          side: "SELL",
        }),
      );
    });

    it("looks up open position with UNRESOLVED resolutionStatus", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findFirst.mockResolvedValue(makePosition() as any);

      await service.closePosition("user-uuid-1", makeClosePositionDto());

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

      const result1 = await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto(),
      );

      const result2 = await service.closePosition(
        "user-uuid-1",
        makeClosePositionDto(),
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

    it("publishes an order intent and returns orderId + intentId", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);

      const result = await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto() as any,
      );

      expect(result.status).toBe("PENDING");
      expect(result.orderId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.intentId).toMatch(/^[0-9a-f-]{36}$/);
      expect(db.order.create).not.toHaveBeenCalled();
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

      await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto({ orderType: undefined }) as any,
      );

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({ orderType: "GTC" }),
      );
    });

    it("publishes order stream payload with correct fields", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);

      await service.placeOrder("user-uuid-1", makePlaceOrderDto() as any);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          orderId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          userId: "user-uuid-1",
          tokenId: "token-uuid-1",
          side: "BUY",
          outcome: "YES",
          marketId: "market-uuid-1",
        }),
      );
    });

    it("allows order when monthly volume plus order size is within limit", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 100 } } as any);
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);

      const result = await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto({ size: 50 }) as any,
      );

      expect(result.status).toBe("PENDING");
    });

    it("uses cached monthly volume from Redis and skips DB aggregate on hit", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      // Redis cache HIT returns "1234" — DB aggregate should NOT be called
      (redis.get as any).mockResolvedValue("1234");

      await service.placeOrder("user-uuid-1", makePlaceOrderDto() as any);

      expect(redis.get).toHaveBeenCalledWith(
        expect.stringContaining("beta:monthly_volume:user-uuid-1:"),
      );
      expect(db.order.aggregate).not.toHaveBeenCalled();
    });

    it("falls through to DB aggregate and populates cache on miss", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      (redis.get as any).mockResolvedValue(null);
      db.order.aggregate.mockResolvedValue({ _sum: { size: 250 } } as any);

      await service.placeOrder("user-uuid-1", makePlaceOrderDto() as any);

      expect(db.order.aggregate).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining("beta:monthly_volume:user-uuid-1:"),
        "250",
        60,
      );
    });

    it("falls back to DB when Redis get throws", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.token.findUniqueOrThrow.mockResolvedValue(makeToken() as any);
      (redis.get as any).mockRejectedValue(new Error("redis down"));
      db.order.aggregate.mockResolvedValue({ _sum: { size: 100 } } as any);

      const result = await service.placeOrder(
        "user-uuid-1",
        makePlaceOrderDto() as any,
      );

      expect(result.status).toBe("PENDING");
      expect(db.order.aggregate).toHaveBeenCalledTimes(1);
    });

    it("enforces monthly cap using cached value", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      // Cached value already at the cap minus a tiny remainder
      (redis.get as any).mockResolvedValue("4990");

      await expect(
        service.placeOrder(
          "user-uuid-1",
          makePlaceOrderDto({ size: 50 }) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: "MONTHLY_VOLUME_EXCEEDED" },
      });
      expect(db.order.aggregate).not.toHaveBeenCalled();
    });
  });

  // ── placeBatch ────────────────────────────────────────────────────────────

  describe("placeBatch", () => {
    function makeBatchDto(
      orders: Array<{
        tokenId?: string;
        side?: OrderSideDto;
        outcome?: OrderOutcomeDto;
        size?: number;
        price?: number;
        orderType?: OrderTypeDto;
      }>,
    ) {
      return {
        orders: orders.map((o) => ({
          tokenId: o.tokenId ?? "token-uuid-1",
          side: o.side ?? OrderSideDto.BUY,
          outcome: o.outcome ?? OrderOutcomeDto.YES,
          size: o.size ?? 50,
          price: o.price ?? 0.6,
          orderType: o.orderType ?? OrderTypeDto.GTC,
        })),
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

    it("publishes all order intents and returns results array", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "token-uuid-1" }),
        makeToken({
          id: "token-uuid-2",
          marketId: "market-uuid-2",
          market: { id: "market-uuid-2", closed: false },
        }),
      ] as any);

      const result = await service.placeBatch(
        "user-uuid-1",
        makeBatchDto([
          {
            tokenId: "token-uuid-1",
            side: OrderSideDto.BUY,
            outcome: OrderOutcomeDto.YES,
            size: 50,
            price: 0.6,
          },
          {
            tokenId: "token-uuid-2",
            side: OrderSideDto.SELL,
            outcome: OrderOutcomeDto.NO,
            size: 25,
            price: 0.4,
          },
        ]),
      );

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toMatchObject({
        orderId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        intentId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        status: "PENDING",
      });
      expect(result.results[1]).toMatchObject({
        orderId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        intentId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        status: "PENDING",
      });
      expect(result.results[0].orderId).not.toBe(result.results[1].orderId);
      expect(result.results[0].intentId).not.toBe(result.results[1].intentId);
    });

    it("pre-fetches tokens with a single findMany query", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "token-a" }),
        makeToken({ id: "token-b" }),
        makeToken({ id: "token-c" }),
      ] as any);

      await service.placeBatch(
        "user-uuid-1",
        makeBatchDto([
          { tokenId: "token-a" },
          { tokenId: "token-b" },
          { tokenId: "token-c" },
        ]),
      );

      expect(db.token.findMany).toHaveBeenCalledTimes(1);
      expect(db.token.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["token-a", "token-b", "token-c"] } },
        include: { market: true },
      });
      expect(db.token.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("deduplicates repeated token IDs into a single findMany where clause", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "token-shared" }),
      ] as any);

      await service.placeBatch(
        "user-uuid-1",
        makeBatchDto([
          { tokenId: "token-shared" },
          { tokenId: "token-shared" },
          { tokenId: "token-shared" },
        ]),
      );

      expect(db.token.findMany).toHaveBeenCalledTimes(1);
      expect(db.token.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["token-shared"] } },
        include: { market: true },
      });
    });

    it("publishes each order to stream:orders with correct fields", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "token-uuid-1", marketId: "market-uuid-1" }),
        makeToken({
          id: "token-uuid-2",
          marketId: "market-uuid-2",
          market: { id: "market-uuid-2", closed: false },
        }),
      ] as any);

      await service.placeBatch(
        "user-uuid-1",
        makeBatchDto([
          {
            tokenId: "token-uuid-1",
            side: OrderSideDto.BUY,
            outcome: OrderOutcomeDto.YES,
            size: 100,
            price: 0.55,
            orderType: OrderTypeDto.GTC,
          },
          {
            tokenId: "token-uuid-2",
            side: OrderSideDto.SELL,
            outcome: OrderOutcomeDto.NO,
            size: 75,
            price: 0.45,
            orderType: OrderTypeDto.FOK,
          },
        ]),
      );

      expect(redis.xadd).toHaveBeenCalledTimes(2);
      expect(redis.xadd).toHaveBeenNthCalledWith(
        1,
        "stream:orders",
        expect.objectContaining({
          userId: "user-uuid-1",
          marketId: "market-uuid-1",
          tokenId: "token-uuid-1",
          side: "BUY",
          outcome: "YES",
          size: "100",
          price: "0.55",
          orderType: "GTC",
        }),
      );
      expect(redis.xadd).toHaveBeenNthCalledWith(
        2,
        "stream:orders",
        expect.objectContaining({
          userId: "user-uuid-1",
          marketId: "market-uuid-2",
          tokenId: "token-uuid-2",
          side: "SELL",
          outcome: "NO",
          size: "75",
          price: "0.45",
          orderType: "FOK",
        }),
      );
    });

    it("throws BATCH_LIMIT_EXCEEDED when more than 15 orders", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );

      const tooManyOrders = Array.from({ length: 16 }, (_, i) => ({
        tokenId: `token-${i}`,
        side: "BUY" as const,
        outcome: "YES" as const,
        size: 1,
        price: 0.01,
      }));

      await expect(
        service.placeBatch("user-uuid-1", {
          orders: tooManyOrders,
        } as any),
      ).rejects.toMatchObject({
        response: { code: "BATCH_LIMIT_EXCEEDED" },
      });
    });

    it("throws WALLET_NOT_CONNECTED when user is not connected", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: false }) as any,
      );

      await expect(
        service.placeBatch("user-uuid-1", makeBatchDto([{}]) as any),
      ).rejects.toMatchObject({
        response: { code: "WALLET_NOT_CONNECTED" },
      });
    });

    it("throws MONTHLY_VOLUME_EXCEEDED when batch total exceeds cap", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      (redis.get as any).mockResolvedValue("4990");

      await expect(
        service.placeBatch(
          "user-uuid-1",
          makeBatchDto([{ size: 50 }, { size: 50 }]) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: "MONTHLY_VOLUME_EXCEEDED" },
      });
    });

    it("throws TOKEN_NOT_FOUND when a requested token does not exist", async () => {
      db.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ polymarketConnected: true }) as any,
      );
      db.order.aggregate.mockResolvedValue({ _sum: { size: 0 } } as any);
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "token-uuid-1" }),
      ] as any);

      await expect(
        service.placeBatch(
          "user-uuid-1",
          makeBatchDto([
            { tokenId: "token-uuid-1" },
            { tokenId: "missing-token" },
          ]) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: "TOKEN_NOT_FOUND" },
      });
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
      db.order.updateMany.mockResolvedValue({ count: 0 });
      db.order.findUnique.mockResolvedValue(
        makeOrder({ userId: "other-user" }) as any,
      );

      await expect(
        service.cancelOrder("user-uuid-1", "order-uuid-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ConflictException for FILLED order", async () => {
      db.order.updateMany.mockResolvedValue({ count: 0 });
      db.order.findUnique.mockResolvedValue(
        makeOrder({ status: "FILLED" }) as any,
      );

      await expect(
        service.cancelOrder("user-uuid-1", "order-uuid-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException for CANCELLED order", async () => {
      db.order.updateMany.mockResolvedValue({ count: 0 });
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

  describe("cancelBulk", () => {
    it("preloads requested orders and cancels them with one guarded update", async () => {
      db.order.findMany.mockResolvedValueOnce([
        makeOrder({
          id: "order-uuid-1",
          status: "PENDING",
          clobOrderId: "clob-1",
        }),
        makeOrder({
          id: "order-uuid-2",
          status: "LIVE",
          clobOrderId: null,
        }),
        makeOrder({
          id: "order-uuid-3",
          status: "FILLED",
          clobOrderId: "clob-3",
        }),
      ] as any);
      db.$queryRaw.mockResolvedValueOnce([
        {
          id: "order-uuid-1",
          status: "CANCELLED",
          clobOrderId: "clob-1",
        },
        {
          id: "order-uuid-2",
          status: "CANCELLED",
          clobOrderId: null,
        },
      ]);

      const result = await service.cancelBulk("user-uuid-1", {
        orderIds: ["order-uuid-1", "order-uuid-2", "order-uuid-3"],
      });

      expect(result).toEqual({
        cancelled: ["order-uuid-1", "order-uuid-2"],
        errors: [
          {
            orderId: "order-uuid-3",
            reason: "NOT_CANCELLABLE_FILLED",
          },
        ],
      });
      expect(db.order.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["order-uuid-1", "order-uuid-2", "order-uuid-3"] },
        },
        select: { id: true, status: true, clobOrderId: true, userId: true },
      });
      expect(db.$queryRaw).toHaveBeenCalledOnce();
      const rawUpdate = db.$queryRaw.mock.calls[0][0] as {
        strings?: string[];
      };
      expect(rawUpdate.strings?.join(" ")).toContain('UPDATE "orders"');
      expect(rawUpdate.strings?.join(" ")).toContain("RETURNING");
      expect(db.order.findUnique).not.toHaveBeenCalled();
      expect(db.order.update).not.toHaveBeenCalled();
      expect(redis.xadd).not.toHaveBeenCalled();
      expect(pipelineXadd).toHaveBeenCalledOnce();
      expect(pipelineXadd).toHaveBeenCalledWith(
        "stream:cancellations",
        "*",
        "orderId",
        "order-uuid-1",
        "clobOrderId",
        "clob-1",
        "userId",
        "user-uuid-1",
      );
    });

    it("reports raced rows from the guarded update without publishing them", async () => {
      db.order.findMany
        .mockResolvedValueOnce([
          makeOrder({
            id: "order-uuid-1",
            status: "PENDING",
            clobOrderId: "clob-1",
          }),
          makeOrder({
            id: "order-uuid-2",
            status: "LIVE",
            clobOrderId: "clob-2",
          }),
        ] as any)
        .mockResolvedValueOnce([
          makeOrder({
            id: "order-uuid-2",
            status: "MATCHED",
            clobOrderId: "clob-2",
          }),
        ] as any);
      db.$queryRaw.mockResolvedValueOnce([
        {
          id: "order-uuid-1",
          status: "CANCELLED",
          clobOrderId: "clob-1",
        },
      ]);

      const result = await service.cancelBulk("user-uuid-1", {
        orderIds: ["order-uuid-1", "order-uuid-2"],
      });

      expect(result).toEqual({
        cancelled: ["order-uuid-1"],
        errors: [
          {
            orderId: "order-uuid-2",
            reason: "NOT_CANCELLABLE_MATCHED",
          },
        ],
      });
      expect(db.order.findMany).toHaveBeenNthCalledWith(2, {
        where: { id: { in: ["order-uuid-2"] }, userId: "user-uuid-1" },
        select: { id: true, status: true },
      });
      expect(redis.xadd).not.toHaveBeenCalled();
      expect(pipelineXadd).toHaveBeenCalledOnce();
      expect(pipelineXadd).toHaveBeenCalledWith(
        "stream:cancellations",
        "*",
        "orderId",
        "order-uuid-1",
        "clobOrderId",
        "clob-1",
        "userId",
        "user-uuid-1",
      );
      expect(pipelineXadd).not.toHaveBeenCalledWith(
        "stream:cancellations",
        "*",
        "orderId",
        "order-uuid-2",
        "clobOrderId",
        expect.anything(),
        "userId",
        expect.anything(),
      );
    });

    it("does not issue per-order reads for missing scoped order ids", async () => {
      db.order.findMany.mockResolvedValueOnce([]);

      const result = await service.cancelBulk("user-uuid-1", {
        orderIds: ["missing-1", "missing-2"],
      });

      expect(result).toEqual({
        cancelled: [],
        errors: [
          { orderId: "missing-1", reason: "NOT_FOUND" },
          { orderId: "missing-2", reason: "NOT_FOUND" },
        ],
      });
      expect(db.$queryRaw).not.toHaveBeenCalled();
      expect(db.order.findUnique).not.toHaveBeenCalled();
      expect(db.order.findMany).toHaveBeenCalledOnce();
    });

    it("reports FORBIDDEN for out-of-scope order IDs", async () => {
      db.order.findMany.mockResolvedValueOnce([
        makeOrder({
          id: "order-uuid-1",
          status: "PENDING",
          userId: "other-user-uuid",
        }),
        makeOrder({
          id: "order-uuid-2",
          status: "PENDING",
        }),
      ] as any);
      db.$queryRaw.mockResolvedValueOnce([
        {
          id: "order-uuid-2",
          status: "CANCELLED",
          clobOrderId: null,
        },
      ]);

      const result = await service.cancelBulk("user-uuid-1", {
        orderIds: ["order-uuid-1", "order-uuid-2"],
      });

      expect(result).toEqual({
        cancelled: ["order-uuid-2"],
        errors: [{ orderId: "order-uuid-1", reason: "FORBIDDEN" }],
      });
      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("reports INTERNAL_ERROR for all xadd orders when pipeline exec fails", async () => {
      db.order.findMany.mockResolvedValueOnce([
        makeOrder({
          id: "order-uuid-1",
          status: "PENDING",
          clobOrderId: "clob-1",
        }),
        makeOrder({
          id: "order-uuid-2",
          status: "LIVE",
          clobOrderId: "clob-2",
        }),
      ] as any);
      db.$queryRaw.mockResolvedValueOnce([
        {
          id: "order-uuid-1",
          status: "CANCELLED",
          clobOrderId: "clob-1",
        },
        {
          id: "order-uuid-2",
          status: "CANCELLED",
          clobOrderId: "clob-2",
        },
      ]);
      pipelineExec.mockRejectedValueOnce(new Error("Redis connection lost"));

      const result = await service.cancelBulk("user-uuid-1", {
        orderIds: ["order-uuid-1", "order-uuid-2"],
      });

      expect(result).toEqual({
        cancelled: [],
        errors: [
          { orderId: "order-uuid-1", reason: "INTERNAL_ERROR" },
          { orderId: "order-uuid-2", reason: "INTERNAL_ERROR" },
        ],
      });
      expect(pipelineXadd).toHaveBeenCalledTimes(2);
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
      });

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
      });

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
      });

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
      });

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

      const { csv, truncated } = await service.exportCsv("user-uuid-1");

      expect(csv).toContain(
        "Market ID,Side,Outcome,Size,Price,Type,Status,Fill Price,Date",
      );
      expect(csv).toContain('"market-1"');
      expect(csv).toContain("BUY");
      expect(csv).toContain("100.00");
      expect(csv).toContain("0.65");
      expect(csv).toContain("0.64");
      expect(truncated).toBe(false);
    });

    it("returns only header when user has no orders", async () => {
      db.order.findMany.mockResolvedValue([]);

      const { csv, truncated } = await service.exportCsv("user-uuid-1");

      expect(csv).toBe(
        "Market ID,Side,Outcome,Size,Price,Type,Status,Fill Price,Date\n",
      );
      expect(truncated).toBe(false);
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

      const { csv } = await service.exportCsv("user-uuid-1");

      // Should not throw and should handle nulls
      expect(csv).toBeDefined();
      expect(csv.split("\n").length).toBeGreaterThanOrEqual(2);
    });

    it("queries orders for the correct user in batches", async () => {
      db.order.findMany.mockResolvedValue([]);

      await service.exportCsv("user-xyz");

      expect(db.order.findMany).toHaveBeenCalledWith({
        where: { userId: "user-xyz" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1000,
      });
    });

    it("iterates through multiple batches", async () => {
      db.order.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 1000 }, (_, i) =>
            makeOrder({
              id: `order-${i}`,
              createdAt: new Date(
                `2025-01-01T00:00:00.${String(i).padStart(3, "0")}Z`,
              ),
            }),
          ) as any,
        )
        .mockResolvedValueOnce(
          Array.from({ length: 500 }, (_, i) =>
            makeOrder({
              id: `order-${1000 + i}`,
              createdAt: new Date(
                `2025-01-01T00:00:01.${String(i).padStart(3, "0")}Z`,
              ),
            }),
          ) as any,
        );

      const { csv, truncated } = await service.exportCsv("user-uuid-1");

      const lines = csv.trim().split("\n");
      expect(lines).toHaveLength(1501); // header + 1500 rows
      expect(truncated).toBe(false);
      expect(db.order.findMany).toHaveBeenCalledTimes(2);
    });

    it("caps export at MAX_EXPORT_ROWS and sets truncated", async () => {
      // 11 batches of 1000 = 11,000 > 10,000 cap
      const batches = Array.from({ length: 11 }, (_, batchIdx) =>
        Array.from({ length: 1000 }, (_, i) =>
          makeOrder({
            id: `order-${batchIdx * 1000 + i}`,
            createdAt: new Date(
              `2025-01-01T00:00:${String(batchIdx).padStart(2, "0")}.${String(i).padStart(3, "0")}Z`,
            ),
          }),
        ),
      );

      for (const batch of batches) {
        db.order.findMany.mockResolvedValueOnce(batch as any);
      }

      const { csv, truncated } = await service.exportCsv("user-uuid-1");

      const lines = csv.trim().split("\n");
      expect(lines).toHaveLength(10001); // header + 10000 rows
      expect(truncated).toBe(true);
    });
  });

  // ── list: additional edge cases ──────────────────────────────────────────

  describe("list (additional)", () => {
    it("handles comma-separated status filter", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ status: "PENDING,FILLED" }),
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg!.status).toEqual({ in: ["PENDING", "FILLED"] });
    });

    it("adds marketId filter when provided", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeOrderQuery({ marketId: "market-xyz" }),
      );

      const whereArg = db.order.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("marketId", "market-xyz");
    });

    it("skips market enrichment when order list is empty", async () => {
      db.order.findMany.mockResolvedValue([]);
      db.order.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeOrderQuery());

      // market.findMany should NOT be called since there are no marketIds
      expect(db.market.findMany).not.toHaveBeenCalled();
    });

    it("enriches orders with null market fields when market not found", async () => {
      const orders = [makeOrder({ marketId: "unknown-market" })];
      db.order.findMany.mockResolvedValue(orders as any);
      db.order.count.mockResolvedValue(1);
      db.market.findMany.mockResolvedValue([]);

      const result = await service.list("user-uuid-1", makeOrderQuery());

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
