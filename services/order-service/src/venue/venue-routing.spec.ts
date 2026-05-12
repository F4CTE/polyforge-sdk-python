/**
 * Tests for the VenueRouter integration in OrdersService.
 * Verifies that intent.venue correctly routes to the right adapter,
 * and that venueOrderId is persisted to the DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VenueAdapter, VenueOrderResponse } from "@polyforge/shared-types";
import { OrdersService, type OrderIntent } from "../orders/orders.service";
import { VenueRouter } from "./venue-router";

vi.mock("@polyforge/logger", () => ({
  logCloudWatchMetric: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePolyAdapter(): VenueAdapter & {
  submitOrder: ReturnType<typeof vi.fn>;
} {
  return {
    venueId: "polymarket",
    getMarkets: vi.fn().mockResolvedValue([]),
    getOrderBook: vi
      .fn()
      .mockResolvedValue({ tokenId: "tok", bids: [], asks: [], updatedAt: 0 }),
    getPrice: vi.fn().mockResolvedValue("0.50"),
    getPriceHistory: vi.fn().mockResolvedValue([]),
    submitOrder: vi.fn().mockResolvedValue({
      venueOrderId: "poly-order-1",
      status: "LIVE",
    } satisfies VenueOrderResponse),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    cancelAllOrders: vi.fn().mockResolvedValue(undefined),
    getPositions: vi.fn().mockResolvedValue([]),
    getOrderHistory: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

function makeKalshiAdapter(): VenueAdapter & {
  submitOrder: ReturnType<typeof vi.fn>;
} {
  return {
    venueId: "kalshi",
    getMarkets: vi.fn().mockResolvedValue([]),
    getOrderBook: vi.fn().mockResolvedValue({
      tokenId: "tok",
      bids: [],
      asks: [{ price: "0.44", size: "100" }],
      updatedAt: 0,
    }),
    getPrice: vi.fn().mockResolvedValue("0.44"),
    getPriceHistory: vi.fn().mockResolvedValue([]),
    submitOrder: vi.fn().mockResolvedValue({
      venueOrderId: "kalshi-order-1",
      status: "resting",
    } satisfies VenueOrderResponse),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    cancelAllOrders: vi.fn().mockResolvedValue(undefined),
    getPositions: vi.fn().mockResolvedValue([]),
    getOrderHistory: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

const SIGNED_ORDER = {
  order: { tokenId: "token-1", signature: "0x1234" },
  builderHeaders: {
    POLY_BUILDER_API_KEY: "bk",
    POLY_BUILDER_TIMESTAMP: "ts",
    POLY_BUILDER_PASSPHRASE: "pp",
    POLY_BUILDER_SIGNATURE: "sig",
  },
};

function makeMocks(polyAdapter: VenueAdapter, kalshiAdapter?: VenueAdapter) {
  const prisma = {
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;

  const redis = {
    xadd: vi.fn().mockResolvedValue("0-0"),
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
  } as any;
  const signer = { signOrder: vi.fn().mockResolvedValue(SIGNED_ORDER) } as any;
  const clob = {
    submitOrder: vi
      .fn()
      .mockResolvedValue({ orderID: "clob-111", status: "LIVE" }),
  } as any;
  const events = {
    emitOrderPlaced: vi.fn().mockResolvedValue(undefined),
    emitOrderFailed: vi.fn().mockResolvedValue(undefined),
    emitOrderCancelled: vi.fn().mockResolvedValue(undefined),
  } as any;

  const adapters = kalshiAdapter ? [polyAdapter, kalshiAdapter] : [polyAdapter];
  const venueRouter = new VenueRouter(adapters);

  return { prisma, redis, signer, clob, events, venueRouter };
}

function makeIntent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId: "intent-route-1",
    userId: "user-1",
    strategyId: "strat-1",
    marketId: "market-1",
    tokenId: "token-1",
    side: "BUY",
    outcome: "YES",
    size: "10",
    price: "0.50",
    orderType: "GTC",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("OrdersService — venue routing", () => {
  let polyAdapter: ReturnType<typeof makePolyAdapter>;
  let kalshiAdapter: ReturnType<typeof makeKalshiAdapter>;

  beforeEach(() => {
    vi.useFakeTimers();
    polyAdapter = makePolyAdapter();
    kalshiAdapter = makeKalshiAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes to polymarket adapter when intent.venue is 'polymarket'", async () => {
    const { prisma, redis, signer, clob, events, venueRouter } = makeMocks(
      polyAdapter,
      kalshiAdapter,
    );
    const svc = new OrdersService(
      prisma,
      redis,
      signer,
      clob,
      events,
      venueRouter,
    );

    const p = svc.processIntent(makeIntent({ venue: "polymarket" }));
    await vi.runAllTimersAsync();
    await p;

    expect(polyAdapter.submitOrder).toHaveBeenCalledOnce();
    expect(kalshiAdapter.submitOrder).not.toHaveBeenCalled();
  });

  it("routes to kalshi adapter when intent.venue is 'kalshi'", async () => {
    const { prisma, redis, signer, clob, events, venueRouter } = makeMocks(
      polyAdapter,
      kalshiAdapter,
    );
    const svc = new OrdersService(
      prisma,
      redis,
      signer,
      clob,
      events,
      venueRouter,
    );

    const p = svc.processIntent(makeIntent({ venue: "kalshi" }));
    await vi.runAllTimersAsync();
    await p;

    expect(kalshiAdapter.submitOrder).toHaveBeenCalledOnce();
    expect(polyAdapter.submitOrder).not.toHaveBeenCalled();
  });

  it("routes to polymarket when intent.venue is undefined (backward compat)", async () => {
    const { prisma, redis, signer, clob, events, venueRouter } = makeMocks(
      polyAdapter,
      kalshiAdapter,
    );
    const svc = new OrdersService(
      prisma,
      redis,
      signer,
      clob,
      events,
      venueRouter,
    );

    const p = svc.processIntent(makeIntent({ venue: undefined }));
    await vi.runAllTimersAsync();
    await p;

    expect(polyAdapter.submitOrder).toHaveBeenCalledOnce();
  });

  it("persists venueOrderId from the adapter response to the DB", async () => {
    const { prisma, redis, signer, clob, events, venueRouter } = makeMocks(
      polyAdapter,
      kalshiAdapter,
    );
    const svc = new OrdersService(
      prisma,
      redis,
      signer,
      clob,
      events,
      venueRouter,
    );

    const p = svc.processIntent(makeIntent({ venue: "polymarket" }));
    await vi.runAllTimersAsync();
    await p;

    const updateData = prisma.order.update.mock.calls[0][0].data;
    expect(updateData.venueOrderId).toBe("poly-order-1");
  });

  it("persists venueOrderId from kalshi adapter to the DB", async () => {
    const { prisma, redis, signer, clob, events, venueRouter } = makeMocks(
      polyAdapter,
      kalshiAdapter,
    );
    const svc = new OrdersService(
      prisma,
      redis,
      signer,
      clob,
      events,
      venueRouter,
    );

    const p = svc.processIntent(makeIntent({ venue: "kalshi" }));
    await vi.runAllTimersAsync();
    await p;

    const updateData = prisma.order.update.mock.calls[0][0].data;
    expect(updateData.venueOrderId).toBe("kalshi-order-1");
  });

  it("still works without a VenueRouter (pure CLOB path preserved for backward compat)", async () => {
    const { prisma, redis, signer, clob, events } = makeMocks(polyAdapter);
    // No venueRouter passed
    const svc = new OrdersService(prisma, redis, signer, clob, events);

    const p = svc.processIntent(makeIntent({ venue: undefined }));
    await vi.runAllTimersAsync();
    await p;

    expect(clob.submitOrder).toHaveBeenCalledOnce();
    expect(polyAdapter.submitOrder).not.toHaveBeenCalled();
  });
});
