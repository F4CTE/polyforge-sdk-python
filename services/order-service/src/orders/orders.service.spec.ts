import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CURRENT_US_RAIL_TERMS_VERSION } from "@polyforge/shared-types";
import { OrdersService, OrderIntent } from "./orders.service";

vi.mock("@polyforge/logger", () => ({
  logCloudWatchMetric: vi.fn(),
}));

// ─── Factories ────────────────────────────────────────────────────────────────

function makeIntent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId: "intent-1",
    userId: "user-1",
    strategyId: "strat-1",
    marketId: "market-1",
    tokenId: "token-1",
    side: "BUY",
    outcome: "YES",
    size: "10",
    price: "0.6",
    orderType: "GTC",
    ...overrides,
  };
}

const SIGNED_ORDER = {
  order: { tokenId: "token-1", signature: "0x1234" },
  builderHeaders: {
    POLY_BUILDER_API_KEY: "bk",
    POLY_BUILDER_TIMESTAMP: "1234567890",
    POLY_BUILDER_PASSPHRASE: "bp",
    POLY_BUILDER_SIGNATURE: "bs",
  },
};

const CLOB_LIVE = { orderID: "clob-123", status: "LIVE" };
const CLOB_MATCHED = { orderID: "clob-456", status: "MATCHED" };
const CLOB_FILLED = { orderID: "clob-789", status: "FILLED" };

function makeMocks() {
  const prisma = {
    order: {
      findFirst: vi.fn().mockResolvedValue(null), // idempotency check — no existing order
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }), // claim/release
    },
    copyTrade: {
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        usRailTermsAcceptedAt: new Date("2026-04-29T00:00:00.000Z"),
        usRailTermsVersion: CURRENT_US_RAIL_TERMS_VERSION,
      }),
    },
  } as any;

  const redis = {
    xadd: vi.fn().mockResolvedValue("1234567890-0"),
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    getClient: vi.fn().mockReturnValue({
      xlen: vi.fn().mockResolvedValue(1),
    }),
  } as any;

  const signer = {
    signOrder: vi.fn().mockResolvedValue(SIGNED_ORDER),
    cancelPolymarketOrder: vi.fn().mockResolvedValue(undefined),
    getPolymarketUsCredentials: vi.fn().mockResolvedValue({
      keyId: "us-key",
      secretKey: "us-secret",
    }),
  } as any;

  const clob = {
    submitOrder: vi.fn().mockResolvedValue(CLOB_LIVE),
  } as any;

  const events = {
    emitOrderPlaced: vi.fn().mockResolvedValue(undefined),
    emitOrderFilled: vi.fn().mockResolvedValue(undefined),
    emitOrderFailed: vi.fn().mockResolvedValue(undefined),
    emitOrderCancelled: vi.fn().mockResolvedValue(undefined),
  } as any;

  return { prisma, redis, signer, clob, events };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("OrdersService", () => {
  let svc: OrdersService;
  let prisma: ReturnType<typeof makeMocks>["prisma"];
  let redis: ReturnType<typeof makeMocks>["redis"];
  let signer: ReturnType<typeof makeMocks>["signer"];
  let clob: ReturnType<typeof makeMocks>["clob"];
  let events: ReturnType<typeof makeMocks>["events"];

  beforeEach(() => {
    vi.useFakeTimers();
    const m = makeMocks();
    ({ prisma, redis, signer, clob, events } = m);
    svc = new OrdersService(prisma, redis, signer, clob, events);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── processIntent — happy path ─────────────────────────────────────────────

  describe("processIntent() — happy path", () => {
    it("creates a DB record in PENDING state as the first action", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const createCall = prisma.order.create.mock.calls[0][0];
      expect(createCall.data.status).toBe("PENDING");
    });

    it("DB record includes intentId, userId, tokenId, side, outcome", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const { data } = prisma.order.create.mock.calls[0][0];
      expect(data.intentId).toBe("intent-1");
      expect(data.userId).toBe("user-1");
      expect(data.tokenId).toBe("token-1");
      expect(data.side).toBe("BUY");
      expect(data.outcome).toBe("YES");
    });

    it("updates directly to final status with placedAt in a single consolidated DB call", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Consolidated update: PENDING -> final status (no intermediate SUBMITTED step)
      const updateCall = prisma.order.update.mock.calls[0]?.[0];
      expect(updateCall?.data?.placedAt).toBeDefined();
      expect(updateCall?.data?.clobOrderId).toBeDefined();
    });

    it("updates to LIVE when CLOB returns status LIVE", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_LIVE);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const liveCall = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "LIVE",
      );
      expect(liveCall).toBeDefined();
    });

    it("updates to MATCHED when CLOB returns status MATCHED", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_MATCHED);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const matchedCall = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "MATCHED",
      );
      expect(matchedCall).toBeDefined();
    });

    it("updates to CONFIRMED when CLOB returns status FILLED", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_FILLED);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const confirmedCall = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "CONFIRMED",
      );
      expect(confirmedCall).toBeDefined();
    });

    it("stores clobOrderId and clobStatus on final update", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const finalUpdate = prisma.order.update.mock.calls.at(-1)![0];
      expect(finalUpdate.data.clobOrderId).toBe("clob-123");
      expect(finalUpdate.data.clobStatus).toBe("LIVE");
    });

    it("uses caller-provided orderId when intent carries one", async () => {
      const p = svc.processIntent(makeIntent({ orderId: "order-from-api" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create.mock.calls[0][0].data.id).toBe(
        "order-from-api",
      );
    });

    it("normalizes empty strategyId to null", async () => {
      const p = svc.processIntent(makeIntent({ strategyId: "" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create.mock.calls[0][0].data.strategyId).toBeNull();
    });

    it("emits ORDER_PLACED event after successful submission", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
      expect(events.emitOrderPlaced).toHaveBeenCalledWith(
        "user-1",
        expect.any(String),
        "intent-1",
      );
    });

    it("emits ORDER_FILLED when venue returns a filled status", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_FILLED);

      const p = svc.processIntent(makeIntent({ copyTradeId: "copy-1" }));
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderFilled).toHaveBeenCalledWith(
        "user-1",
        expect.any(String),
        "0.6",
        "10",
        "0",
        "copy-1",
      );
    });

    it("persists fill metadata when CLOB immediately returns FILLED", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_FILLED);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const confirmedCall = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "CONFIRMED",
      )![0];
      expect(confirmedCall.data).toEqual(
        expect.objectContaining({
          fillPrice: "0.6",
          fillSize: "10",
          fee: "0",
          filledAt: expect.any(Date),
        }),
      );
    });

    it("persists fill metadata when CLOB immediately returns MATCHED", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_MATCHED);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const matchedCall = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "MATCHED",
      )![0];
      expect(matchedCall.data).toEqual(
        expect.objectContaining({
          fillPrice: "0.6",
          fillSize: "10",
          fee: "0",
          filledAt: expect.any(Date),
        }),
      );
    });

    it("passes order size and price to signer as decimal strings", async () => {
      const p = svc.processIntent(
        makeIntent({
          size: "12345678901234.123456",
          price: "0.123456",
        }),
      );
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.userId).toBe("user-1");
      expect(signerCall.tokenId).toBe("token-1");
      expect(signerCall.side).toBe("BUY");
      expect(signerCall.size).toBe("12345678901234.123456");
      expect(signerCall.price).toBe("0.123456");
      expect(signerCall.orderType).toBe("GTC");
    });

    it("passes expiration when provided in the intent", async () => {
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      const p = svc.processIntent(makeIntent({ expiration, orderType: "GTD" }));
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.expiration).toBe(expiration);
    });

    it("does not write to DLQ on success", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const dlqCalls = redis.xadd.mock.calls.filter(
        ([stream]: any[]) => stream === "stream:orders:dlq",
      );
      expect(dlqCalls).toHaveLength(0);
    });

    it("rejects non-finite order size before signing", async () => {
      const p = svc.processIntent(makeIntent({ size: "Infinity" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({
          reason: "INVALID_ORDER_NUMERIC",
        }),
        10_000,
      );
    });

    it("rejects non-finite order price before signing", async () => {
      const p = svc.processIntent(makeIntent({ price: "NaN" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({
          reason: "INVALID_ORDER_NUMERIC",
        }),
        10_000,
      );
    });
  });

  // ── processIntent — DB create failure → immediate DLQ ─────────────────────

  describe("processIntent() — DB create failure", () => {
    it("goes to DLQ immediately without calling signer", async () => {
      prisma.order.create.mockRejectedValue(new Error("DB connection lost"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "DB_CREATE_FAILED" }),
        10_000,
      );
    });

    it("does not emit ORDER_FAILED event on DB create failure (DLQ only)", async () => {
      prisma.order.create.mockRejectedValue(new Error("PG error"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderFailed).not.toHaveBeenCalled();
    });
  });

  // ── processIntent — idempotency guard ────────────────────────────────────

  describe("processIntent() — idempotency guard", () => {
    it("retries CLOB submission when an existing PENDING order is found", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "existing-order-id",
        status: "PENDING",
        clobOrderId: null,
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Must reuse existing order ID
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).toHaveBeenCalled();
      expect(clob.submitOrder).toHaveBeenCalled();
      // Must update the existing order after CLOB submission
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "existing-order-id" },
        }),
      );
    });

    it("skips processing when existing order is in terminal state SUBMITTED", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "already-submitted",
        status: "SUBMITTED",
        clobOrderId: "clob-xyz",
        venueOrderId: "clob-xyz",
        updatedAt: new Date(),
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("skips processing when existing order is in terminal state LIVE", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "already-live",
        status: "LIVE",
        clobOrderId: "clob-live",
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("proceeds normally when no existing order is found (first attempt)", async () => {
      // Default mock already returns null for findFirst
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).toHaveBeenCalled();
      expect(signer.signOrder).toHaveBeenCalled();
      expect(clob.submitOrder).toHaveBeenCalled();
    });
  });

  describe("processIntent() — numeric validation", () => {
    it("moves invalid numeric intents to the DLQ before signing", async () => {
      const p = svc.processIntent(makeIntent({ size: "", price: "0.6" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "INVALID_NUMERIC_ORDER_INTENT" }),
        10_000,
      );
    });
  });

  // ── processIntent — retry logic ───────────────────────────────────────────

  describe("processIntent() — retry / DLQ", () => {
    it("retries when signer fails on first attempt (succeeds on attempt 2)", async () => {
      const warnSpy = vi
        .spyOn((svc as any).logger, "warn")
        .mockImplementation(() => undefined);
      const err = new Error("timeout");
      err.stack = "Error: timeout\n    at processIntent (orders.ts:42:7)";
      signer.signOrder
        .mockRejectedValueOnce(err)
        .mockResolvedValue(SIGNED_ORDER);

      // On retry, findFirst must return the PENDING order that was created
      // on the first attempt (after claim release puts it back to PENDING)
      prisma.order.findFirst
        .mockResolvedValueOnce(null) // first call: no existing order
        .mockResolvedValueOnce({
          id: expect.any(String),
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        }); // retry: find existing PENDING

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).toHaveBeenCalledTimes(2);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ORDER_ATTEMPT_FAILED",
          attempt: 1,
          intentId: "intent-1",
          err,
        }),
        "Order attempt failed (phase 1: sign/venue)",
      );
    });

    it("retries up to 3 times when signer keeps failing", async () => {
      signer.signOrder
        .mockRejectedValueOnce(new Error("fail-1"))
        .mockRejectedValueOnce(new Error("fail-2"))
        .mockResolvedValue(SIGNED_ORDER);

      // On retries, findFirst must return the PENDING order
      prisma.order.findFirst
        .mockResolvedValueOnce(null) // first attempt
        .mockResolvedValueOnce({
          id: "order-retry",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        }) // retry 1
        .mockResolvedValueOnce({
          id: "order-retry",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        }); // retry 2

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).toHaveBeenCalledTimes(3);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("sends to DLQ after 3 failed attempts", async () => {
      signer.signOrder.mockRejectedValue(new Error("permanent failure"));

      // On each retry, findFirst returns PENDING order
      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "order-dlq",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "order-dlq",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).toHaveBeenCalledTimes(3);
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({
          reason: expect.stringContaining("permanent failure"),
        }),
        10_000,
      );
    });

    it("emits ORDER_FAILED event after exhausting all retries", async () => {
      signer.signOrder.mockRejectedValue(new Error("sign error"));

      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "order-fail",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "order-fail",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderFailed).toHaveBeenCalledOnce();
      expect(events.emitOrderFailed).toHaveBeenCalledWith(
        "user-1",
        "order-fail",
        "sign error",
        undefined,
        undefined,
        "FAILED",
      );
    });

    it("updates order status to FAILED after DLQ", async () => {
      clob.submitOrder.mockRejectedValue(new Error("clob down"));

      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "order-clob-fail",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "order-clob-fail",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const failedUpdate = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "FAILED",
      );
      expect(failedUpdate).toBeDefined();
    });

    it("retries when CLOB fails on first attempt", async () => {
      clob.submitOrder
        .mockRejectedValueOnce(new Error("clob overloaded"))
        .mockResolvedValue(CLOB_LIVE);

      // On retry, findFirst returns existing PENDING order
      prisma.order.findFirst
        .mockResolvedValueOnce(null) // first attempt
        .mockResolvedValueOnce({
          id: "order-retry",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        }); // retry

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(clob.submitOrder).toHaveBeenCalledTimes(2);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("DLQ entry contains intent metadata", async () => {
      signer.signOrder.mockRejectedValue(new Error("fail"));

      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "order-dlq-meta",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "order-dlq-meta",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });

      const p = svc.processIntent(makeIntent({ intentId: "intent-dlq" }));
      await vi.runAllTimersAsync();
      await p;

      const dlqCall = redis.xadd.mock.calls.find(
        ([s]: any[]) => s === "stream:orders:dlq",
      )!;
      const payload = dlqCall[1];
      expect(payload.intentId).toBe("intent-dlq");
      expect(payload.userId).toBe("user-1");
    });

    it("moves GTD orders to DLQ when they expire before the submission window", async () => {
      await svc.processIntent(
        makeIntent({
          orderType: "GTD",
          expiration: Math.floor(Date.now() / 1000) + 4,
        }),
      );

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({
          reason: "GTD_EXPIRED_BEFORE_SUBMISSION",
        }),
        10_000,
      );
    });
  });

  // ── processIntent — US-rail terms gate ───────────────────────────────────

  describe("processIntent() — US-rail terms gate", () => {
    it("blocks polymarket_us intents with missing terms before signer credentials or venue routing", async () => {
      prisma.user.findUnique.mockResolvedValue({
        usRailTermsAcceptedAt: null,
        usRailTermsVersion: null,
      });
      const venueRouter = { route: vi.fn() } as any;
      svc = new OrdersService(prisma, redis, signer, clob, events, venueRouter);

      const p = svc.processIntent(makeIntent({ venue: "polymarket_us" }));
      await vi.runAllTimersAsync();
      await p;

      expect(signer.getPolymarketUsCredentials).not.toHaveBeenCalled();
      expect(venueRouter.route).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "US_RAIL_TERMS_REQUIRED" }),
        10_000,
      );
    });

    it("blocks polymarket_us intents with stale terms before signer credentials or venue routing", async () => {
      prisma.user.findUnique.mockResolvedValue({
        usRailTermsAcceptedAt: new Date("2026-04-01T00:00:00.000Z"),
        usRailTermsVersion: "us-rail-2026-01-01",
      });
      const venueRouter = { route: vi.fn() } as any;
      svc = new OrdersService(prisma, redis, signer, clob, events, venueRouter);

      const p = svc.processIntent(makeIntent({ venue: "polymarket_us" }));
      await vi.runAllTimersAsync();
      await p;

      expect(signer.getPolymarketUsCredentials).not.toHaveBeenCalled();
      expect(venueRouter.route).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "US_RAIL_TERMS_REQUIRED" }),
        10_000,
      );
    });

    it("does not leave a pending order when retry idempotency sees a stale terms rejection", async () => {
      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "order-created-before-gate" });
      prisma.user.findUnique.mockResolvedValue({
        usRailTermsAcceptedAt: null,
        usRailTermsVersion: null,
      });
      const venueRouter = { route: vi.fn() } as any;
      svc = new OrdersService(prisma, redis, signer, clob, events, venueRouter);

      const p = svc.processIntent(makeIntent({ venue: "polymarket_us" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order-created-before-gate" },
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(signer.getPolymarketUsCredentials).not.toHaveBeenCalled();
      expect(venueRouter.route).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "US_RAIL_TERMS_REQUIRED" }),
        10_000,
      );
    });

    it("blocks default polymarket intents when the router resolves them to the US rail", async () => {
      prisma.user.findUnique.mockResolvedValue({
        usRailTermsAcceptedAt: null,
        usRailTermsVersion: null,
      });
      const venueRouter = {
        resolve: vi.fn().mockReturnValue({ venueId: "polymarket_us" }),
        route: vi.fn(),
      } as any;
      svc = new OrdersService(prisma, redis, signer, clob, events, venueRouter);

      const p = svc.processIntent(makeIntent({ venue: "polymarket" }));
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(signer.getPolymarketUsCredentials).not.toHaveBeenCalled();
      expect(venueRouter.route).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "US_RAIL_TERMS_REQUIRED" }),
        10_000,
      );
    });

    it("uses US credentials when an accepted default polymarket intent resolves to the US rail", async () => {
      const venueRouter = {
        resolve: vi.fn().mockReturnValue({ venueId: "polymarket_us" }),
        route: vi.fn().mockResolvedValue({
          venueOrderId: "us-order-1",
          status: "LIVE",
        }),
      } as any;
      svc = new OrdersService(prisma, redis, signer, clob, events, venueRouter);

      const p = svc.processIntent(makeIntent({ venue: "polymarket" }));
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(signer.getPolymarketUsCredentials).toHaveBeenCalledWith("user-1");
      expect(venueRouter.route).toHaveBeenCalledWith(
        "polymarket_us",
        expect.objectContaining({
          authContext: expect.objectContaining({ venue: "polymarket_us" }),
        }),
      );
    });
  });

  // ── processBatch ──────────────────────────────────────────────────────────

  describe("processBatch()", () => {
    it("processes a single-intent batch", async () => {
      const p = svc.processBatch([makeIntent()]);
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderPlaced).toHaveBeenCalledTimes(1);
    });

    it("processes all 3 intents in a small batch", async () => {
      const intents = [0, 1, 2].map((i) => makeIntent({ intentId: `i-${i}` }));

      const p = svc.processBatch(intents);
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderPlaced).toHaveBeenCalledTimes(3);
    });

    it("processes exactly 15 intents (one full batch)", async () => {
      const intents = Array.from({ length: 15 }, (_, i) =>
        makeIntent({ intentId: `i-${i}` }),
      );

      const p = svc.processBatch(intents);
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).toHaveBeenCalledTimes(15);
    });

    it("processes 20 intents in two chunks (15 + 5)", async () => {
      const intents = Array.from({ length: 20 }, (_, i) =>
        makeIntent({ intentId: `i-${i}` }),
      );

      const p = svc.processBatch(intents);
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).toHaveBeenCalledTimes(20);
    });

    it("continues processing other intents when one fails", async () => {
      // Differentiate intents by tokenId in the signer mock
      signer.signOrder.mockImplementation(async (req: any) => {
        if (req.tokenId === "token-fail") throw new Error("always fail");
        return SIGNED_ORDER;
      });
      // On retries of the failing intent, findFirst returns PENDING order
      prisma.order.findFirst.mockImplementation(async (args: any) => {
        if (args.where?.intentId === "intent-0") {
          // First call is null, subsequent are PENDING (after retries)
          return {
            id: "order-fail-0",
            status: "PENDING",
            clobOrderId: null,
            venueOrderId: null,
            updatedAt: new Date(),
          };
        }
        return null;
      });

      const intents = [
        makeIntent({ intentId: "intent-0", tokenId: "token-fail" }),
        makeIntent({ intentId: "intent-1", tokenId: "token-ok" }),
      ];

      const p = svc.processBatch(intents);
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderFailed).toHaveBeenCalledTimes(1);
      expect(events.emitOrderPlaced).toHaveBeenCalledTimes(1);
    });

    it("reports intents whose DLQ write failed after retries are exhausted", async () => {
      signer.signOrder.mockImplementation(async (req: any) => {
        if (req.tokenId === "token-fail") throw new Error("always fail");
        return SIGNED_ORDER;
      });
      redis.xadd.mockRejectedValue(new Error("Redis DLQ down"));
      // On retries of the failing intent, findFirst returns PENDING order
      prisma.order.findFirst.mockImplementation(async (args: any) => {
        if (args.where?.intentId === "intent-fail") {
          return {
            id: "order-fail-x",
            status: "PENDING",
            clobOrderId: null,
            venueOrderId: null,
            updatedAt: new Date(),
          };
        }
        return null;
      });

      const intents = [
        makeIntent({ intentId: "intent-fail", tokenId: "token-fail" }),
        makeIntent({ intentId: "intent-ok", tokenId: "token-ok" }),
      ];

      const p = svc.processBatch(intents);
      await vi.runAllTimersAsync();
      const result = await p;

      expect(result.processed).toEqual([intents[1]]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({ intent: intents[0] });
      expect(result.failed[0].error).toBeInstanceOf(Error);
      expect(events.emitOrderPlaced).toHaveBeenCalledTimes(1);
    });

    it("returns fresh SUBMITTED claim intent in failed[] so reclaim handler does not ACK", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "fresh-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });
      redis.get.mockResolvedValue(null);

      const p = svc.processBatch([makeIntent()], { reclaimed: true });
      await vi.runAllTimersAsync();
      const result = await p;

      expect(result.processed).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBeInstanceOf(Error);
      expect((result.failed[0].error as Error).message).toContain(
        "refusing to ACK reclaimed entry",
      );
    });
  });

  // ── closePosition ─────────────────────────────────────────────────────────

  // ── mapClobStatus edge cases ──────────────────────────────────────────────

  describe("mapClobStatus() — via processIntent (indirect)", () => {
    it("maps CANCELLED status correctly", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-c",
        status: "CANCELLED",
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const cancelledUpdate = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "CANCELLED",
      );
      expect(cancelledUpdate).toBeDefined();
    });

    it("maps unknown CLOB status to SUBMITTED", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-u",
        status: "UNKNOWN_STATUS",
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const submittedUpdate = prisma.order.update.mock.calls.find(
        ([args]: any[]) => args.data?.status === "SUBMITTED",
      );
      expect(submittedUpdate).toBeDefined();
    });

    it("maps DELAYED to DELAYED", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-d",
        status: "DELAYED",
      });
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;
      expect(
        prisma.order.update.mock.calls.find(
          ([a]: any[]) => a.data?.status === "DELAYED",
        ),
      ).toBeDefined();
    });

    it("maps MINED to MINED", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-m",
        status: "MINED",
      });
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;
      expect(
        prisma.order.update.mock.calls.find(
          ([a]: any[]) => a.data?.status === "MINED",
        ),
      ).toBeDefined();
    });

    it("maps RETRYING to SUBMITTED", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-r",
        status: "RETRYING",
      });
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;
      expect(
        prisma.order.update.mock.calls.find(
          ([a]: any[]) => a.data?.status === "SUBMITTED",
        ),
      ).toBeDefined();
    });

    it("maps UNMATCHED to LIVE", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-um",
        status: "UNMATCHED",
      });
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;
      expect(
        prisma.order.update.mock.calls.find(
          ([a]: any[]) => a.data?.status === "LIVE",
        ),
      ).toBeDefined();
    });

    it("maps FAILED to FAILED", async () => {
      clob.submitOrder.mockResolvedValue({
        orderID: "clob-f",
        status: "FAILED",
      });
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;
      expect(
        prisma.order.update.mock.calls.find(
          ([a]: any[]) => a.data?.status === "FAILED",
        ),
      ).toBeDefined();
    });
  });

  // ── DLQ redis failure ─────────────────────────────────────────────────────

  describe("moveToDlq() — redis.xadd failure (indirect)", () => {
    it("surfaces DLQ write errors so Redis OOM is not silent", async () => {
      signer.signOrder.mockRejectedValue(new Error("sign fail"));
      redis.xadd.mockRejectedValue(new Error("Redis down"));

      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "order-oom",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "order-oom",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });

      const p = svc.processIntent(makeIntent());
      const rejection = expect(p).rejects.toThrow("Redis down");
      await vi.runAllTimersAsync();
      await rejection;
    });

    it("logs DLQ write errors with a structured err field", async () => {
      const errorSpy = vi
        .spyOn((svc as any).logger, "error")
        .mockImplementation(() => undefined);
      const err = new Error("Redis down");
      err.stack = "Error: Redis down\n    at moveToDlq (orders.ts:42:7)";
      signer.signOrder.mockRejectedValue(new Error("sign fail"));
      redis.xadd.mockRejectedValue(err);

      prisma.order.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "order-log",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "order-log",
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });

      const p = svc.processIntent(makeIntent());
      const rejection = expect(p).rejects.toThrow("Redis down");
      await vi.runAllTimersAsync();
      await rejection;

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ORDER_DLQ_WRITE_FAILED",
          stream: "stream:orders:dlq",
          intentId: "intent-1",
          err,
        }),
        "Failed to write order intent to DLQ",
      );
    });
  });

  describe("closePosition()", () => {
    it("creates a SELL intent", async () => {
      const p = svc.closePosition("user-1", "token-1", "market-1", "5");
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.side).toBe("SELL");
    });

    it("uses FOK order type", async () => {
      const p = svc.closePosition("user-1", "token-1", "market-1", "5");
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.orderType).toBe("FOK");
    });

    it("uses a very low price for FOK fill (market order equivalent)", async () => {
      const p = svc.closePosition("user-1", "token-1", "market-1", "5");
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.price).toBe("0.01");
    });

    it('uses "manual-close" as strategyId when not provided', async () => {
      const p = svc.closePosition("user-1", "token-1", "market-1", "5");
      await vi.runAllTimersAsync();
      await p;

      const createCall = prisma.order.create.mock.calls[0][0];
      expect(createCall.data.strategyId).toBe("manual-close");
    });

    it("uses provided strategyId when given", async () => {
      const p = svc.closePosition(
        "user-1",
        "token-1",
        "market-1",
        "5",
        "strat-99",
      );
      await vi.runAllTimersAsync();
      await p;

      const createCall = prisma.order.create.mock.calls[0][0];
      expect(createCall.data.strategyId).toBe("strat-99");
    });

    it("submits the correct size", async () => {
      const p = svc.closePosition("user-1", "token-1", "market-1", "7.5");
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.size).toBe("7.5");
    });
  });

  describe("processCancellation()", () => {
    it("routes Kalshi cancellations through the stored venue adapter", async () => {
      const venueRouter = {
        resolve: vi.fn().mockReturnValue({
          cancelOrder: vi.fn().mockResolvedValue(undefined),
        }),
      } as any;
      svc = new OrdersService(prisma, redis, signer, clob, events, venueRouter);
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        venue: "KALSHI",
        venueOrderId: "kalshi-order-1",
        clobOrderId: null,
        marketId: "market-1",
      });

      await svc.processCancellation({ orderId: "order-1", userId: "user-1" });

      expect(venueRouter.resolve).toHaveBeenCalledWith("kalshi");
      expect(venueRouter.resolve().cancelOrder).toHaveBeenCalledWith(
        "kalshi-order-1",
        { userId: "user-1" },
      );
      expect(signer.cancelPolymarketOrder).not.toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CANCELLED" }),
        }),
      );
    });
  });

  // ── Atomic claim / release ─────────────────────────────────────────────

  describe("processIntent() — atomic claim", () => {
    it("claims the order (PENDING → SUBMITTED) before calling signer", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: expect.any(String),
          status: "PENDING",
          clobOrderId: null,
          venueOrderId: null,
        },
        data: { status: "SUBMITTED" },
      });
      expect(signer.signOrder).toHaveBeenCalled();
    });

    it("skips submission when claim fails (another processor already claimed)", async () => {
      prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("releases claim on signer failure and retries", async () => {
      const err = new Error("signer timeout");
      err.stack =
        "Error: signer timeout\n    at processIntent (orders.ts:42:7)";
      signer.signOrder
        .mockRejectedValueOnce(err)
        .mockResolvedValue(SIGNED_ORDER);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Claim was released after first failure
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: expect.any(String),
          status: "SUBMITTED",
          clobOrderId: null,
          venueOrderId: null,
        },
        data: { status: "PENDING" },
      });
      // Order was re-claimed on retry
      expect(prisma.order.updateMany).toHaveBeenCalledTimes(3); // claim, release, re-claim
      expect(signer.signOrder).toHaveBeenCalledTimes(2);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("releases claim on CLOB failure and retries", async () => {
      clob.submitOrder
        .mockRejectedValueOnce(new Error("clob timeout"))
        .mockResolvedValue(CLOB_LIVE);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.updateMany).toHaveBeenCalledTimes(3); // claim, release, re-claim
      expect(clob.submitOrder).toHaveBeenCalledTimes(2);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });
  });

  // ── Post-venue failure (DO NOT re-submit) ──────────────────────────────

  describe("processIntent() — post-venue failure", () => {
    it("retries DB persistence only after venue accepts (no re-submit to CLOB)", async () => {
      // First attempt: CLOB succeeds, DB update fails
      clob.submitOrder.mockResolvedValueOnce(CLOB_LIVE);
      prisma.order.update.mockRejectedValueOnce(new Error("DB write timeout"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // CLOB was called only once (no re-submit)
      expect(clob.submitOrder).toHaveBeenCalledTimes(1);
      // order.update was called twice (failed first, succeeded on retry)
      expect(prisma.order.update).toHaveBeenCalledTimes(2);
      // Events were emitted after successful persistence retry
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("retries DB persistence after venue accepts (max attempts, then best-effort)", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_LIVE);
      prisma.order.update.mockRejectedValue(new Error("DB permanently down"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // CLOB called only once
      expect(clob.submitOrder).toHaveBeenCalledTimes(1);
      // Final best-effort update was attempted
      const finalUpdateCalls = prisma.order.update.mock.calls.filter(
        ([args]: any[]) => args.data?.clobOrderId === "clob-123",
      );
      expect(finalUpdateCalls.length).toBeGreaterThanOrEqual(1);
      // emitOrderFailed was called after persistence exhausted
      expect(events.emitOrderFailed).toHaveBeenCalledOnce();
    });

    it("does NOT release claim after venue accepts (venue ids are preserved)", async () => {
      clob.submitOrder.mockResolvedValue(CLOB_LIVE);
      prisma.order.update.mockRejectedValue(new Error("transient DB fail"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // No release call after venue acceptance (claim release only in pre-venue path)
      // UpdateMany calls with SUBMITTED→PENDING would indicate a claim release
      const releaseCalls = prisma.order.updateMany.mock.calls.filter(
        ([args]: any[]) => args.data?.status === "PENDING",
      );
      // Only the claim call, no release after venue success
      expect(releaseCalls.length).toBe(0);
    });
  });

  // ── SUBMITTED duplicate / recovery handling ────────────────────────────

  describe("processIntent() — SUBMITTED order duplicate handling", () => {
    it("skips a fresh SUBMITTED order without venue ids (assumes in-flight)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "submitted-no-venue",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Did NOT release claim or proceed to CLOB submission
      expect(prisma.order.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PENDING" },
        }),
      );
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("skips a newly SUBMITTED order without venue ids (still fresh)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "fresh-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 5_000),
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Did NOT release claim
      expect(prisma.order.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fresh-order" },
          data: { status: "PENDING" },
        }),
      );
      // Did NOT proceed to CLOB submission
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("skips a SUBMITTED order with venue ids (already submitted)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "submitted-order",
        status: "SUBMITTED",
        clobOrderId: "clob-xyz",
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });
  });

  // ── SUBMITTED sentinel-based recovery ──────────────────────────────────

  describe("processIntent() — sentinel-based recovery for SUBMITTED orders", () => {
    it("backfills venue IDs from sentinel for SUBMITTED order without venue ids", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deleted: false,
        deletedAt: null,
      });
      prisma.order.findFirst.mockResolvedValue({
        id: "submitted-no-venue",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });
      redis.get.mockImplementation((key: string) => {
        if (key === "clob:accepted:intent-1") return Promise.resolve("clob-sentinel-123");
        return Promise.resolve(null);
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Did NOT release claim or re-submit to CLOB
      expect(prisma.order.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "PENDING" } }),
      );
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();

      // DID persist venue order id from sentinel
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "submitted-no-venue" },
        data: {
          clobOrderId: "clob-sentinel-123",
          venueOrderId: "clob-sentinel-123",
        },
      });

      // Cleaned up the sentinel
      expect(redis.del).toHaveBeenCalledWith("clob:accepted:intent-1");
    });

    it("throws when sentinel backfill DB update fails (prevents stream ACK on non-reclaimed path)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deleted: false,
        deletedAt: null,
      });
      prisma.order.findFirst.mockResolvedValue({
        id: "submitted-no-venue",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });
      redis.get.mockImplementation((key: string) => {
        if (key === "clob:accepted:intent-1") return Promise.resolve("clob-sentinel-123");
        return Promise.resolve(null);
      });
      prisma.order.update.mockRejectedValue(new Error("DB transient error"));

      const p = svc.processIntent(makeIntent());
      const rejects = expect(p).rejects.toThrow("DB transient error");
      await vi.runAllTimersAsync();
      await rejects;

      // Did NOT delete the sentinel (preserved for retry)
      expect(redis.del).not.toHaveBeenCalled();
      // Did NOT attempt CLOB submission
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });
  });

  // ── SUBMITTED stale claim recovery ─────────────────────────────────────

  describe("processIntent() — stale SUBMITTED claim recovery", () => {
    it("reclaims a stale SUBMITTED claim without venue ids when no sentinel exists", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Released the stale claim back to PENDING
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: "stale-order",
          status: "SUBMITTED",
          clobOrderId: null,
          venueOrderId: null,
        },
        data: { status: "PENDING" },
      });
      // Proceeded to CLOB submission
      expect(signer.signOrder).toHaveBeenCalled();
      expect(clob.submitOrder).toHaveBeenCalled();
    });

    it("throws for a fresh SUBMITTED claim without venue ids (refuses to ACK reclaimed entry)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "fresh-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });
      redis.get.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      const rejects = expect(p).rejects.toThrow(
        /refusing to ACK reclaimed entry/,
      );
      await vi.runAllTimersAsync();
      await rejects;

      // Did NOT release claim or proceed to CLOB submission
      expect(prisma.order.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PENDING" },
        }),
      );
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("throws for a fresh SUBMITTED claim when reclaimed flag is set (refuses to ACK reclaimed entry)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "fresh-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });
      redis.get.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      const rejects = expect(p).rejects.toThrow(
        /refusing to ACK reclaimed entry/,
      );
      await vi.runAllTimersAsync();
      await rejects;

      // Did NOT release claim or proceed to CLOB submission
      expect(prisma.order.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PENDING" },
        }),
      );
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("releases stale reclaimed SUBMITTED claim to PENDING for re-submission", async () => {
      const now = Date.now();
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(now - 150_000),
      });
      redis.get.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      await vi.runAllTimersAsync();
      await p;

      // Released the stale reclaimed claim back to PENDING
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PENDING" },
        }),
      );
      // Proceeded to CLOB re-submission
      expect(signer.signOrder).toHaveBeenCalled();
      expect(clob.submitOrder).toHaveBeenCalled();
    });

    it("processBatch succeeds when stale reclaimed claim releases and re-submits", async () => {
      const now = Date.now();
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(now - 150_000),
      });
      redis.get.mockResolvedValue(null);

      const result = await svc.processBatch([makeIntent()], {
        reclaimed: true,
      });
      await vi.runAllTimersAsync();

      // Entry was processed (release + re-submit) — not failed
      expect(result.processed.length).toBe(1);
      expect(result.failed.length).toBe(0);
      // Released the stale reclaimed claim back to PENDING
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PENDING" },
        }),
      );
      // Proceeded to CLOB re-submission
      expect(signer.signOrder).toHaveBeenCalled();
      expect(clob.submitOrder).toHaveBeenCalled();
    });

    it("reports failure via processBatch when reclaimed fresh claim throws", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "fresh-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 60_000),
      });
      redis.get.mockResolvedValue(null);

      const result = await svc.processBatch([makeIntent()], {
        reclaimed: true,
      });
      await vi.runAllTimersAsync();

      expect(result.processed.length).toBe(0);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].error).toBeInstanceOf(Error);
      expect((result.failed[0].error as Error).message).toContain(
        "refusing to ACK reclaimed entry",
      );
    });

    it("moves reclaimed SUBMITTED claim to DLQ after MAX_RECLAIM_ATTEMPTS", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null); // no sentinel
      redis.incr.mockResolvedValue(11); // > MAX_RECLAIM_ATTEMPTS
      redis.expire.mockResolvedValue(1);

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      await vi.runAllTimersAsync();
      await p;

      // Order marked as FAILED
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: "stale-order",
          status: "SUBMITTED",
          clobOrderId: null,
          venueOrderId: null,
        },
        data: { status: "FAILED" },
      });
      // Intent moved to DLQ
      expect(redis.xadd).toHaveBeenCalled();
      // Failure event emitted
      expect(events.emitOrderFailed).toHaveBeenCalledWith(
        "user-1",
        "stale-order",
        "RECLAIMED_SUBMITTED_NO_SENTINEL:stale-order",
        undefined,
        undefined,
        "FAILED",
      );
      // Did NOT re-submit to CLOB
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("processBatch succeeds when reclaimed claim hits DLQ fallback", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null);
      redis.incr.mockResolvedValue(11);

      const result = await svc.processBatch([makeIntent()], {
        reclaimed: true,
      });
      await vi.runAllTimersAsync();

      // Entry was processed (DLQ'd) — not failed
      expect(result.processed.length).toBe(1);
      expect(result.failed.length).toBe(0);
      expect(redis.xadd).toHaveBeenCalled();
      expect(events.emitOrderFailed).toHaveBeenCalledWith(
        "user-1",
        "stale-order",
        "RECLAIMED_SUBMITTED_NO_SENTINEL:stale-order",
        undefined,
        undefined,
        "FAILED",
      );
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("releases stale reclaimed claim to PENDING when at MAX_RECLAIM_ATTEMPTS boundary", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null);
      redis.incr.mockResolvedValue(10); // exactly MAX_RECLAIM_ATTEMPTS

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      await vi.runAllTimersAsync();
      await p;

      // Stale + attempts === MAX (not > MAX) → release to PENDING and re-submit
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PENDING" },
        }),
      );
      expect(signer.signOrder).toHaveBeenCalled();
      expect(clob.submitOrder).toHaveBeenCalled();
    });

    it("throws when reclaim counter INCR fails (avoids bypassing MAX_RECLAIM_ATTEMPTS guard)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null);
      redis.incr.mockRejectedValue(new Error("Redis INCR failed"));

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      const rejects = expect(p).rejects.toThrow("Redis INCR failed");
      await vi.runAllTimersAsync();
      await rejects;

      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("throws when updateMany fails in max-reclaim fallback (does not swallow DB error)", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null);
      redis.incr.mockResolvedValue(11); // > MAX_RECLAIM_ATTEMPTS
      prisma.order.updateMany.mockRejectedValueOnce(new Error("DB transient error"));

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      const rejects = expect(p).rejects.toThrow("DB transient error");
      await vi.runAllTimersAsync();
      await rejects;

      // Did NOT attempt DLQ after DB failure
      expect(redis.xadd).not.toHaveBeenCalled();
      expect(events.emitOrderFailed).not.toHaveBeenCalled();
    });

    it("throws when FAILED update races (count=0) to prevent premature ACK", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "stale-order",
        status: "SUBMITTED",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(Date.now() - 150_000),
      });
      redis.get.mockResolvedValue(null);
      redis.incr.mockResolvedValue(11); // > MAX_RECLAIM_ATTEMPTS
      prisma.order.updateMany.mockResolvedValueOnce({ count: 0 }); // row was already updated

      const p = svc.processIntent(makeIntent(), { reclaimed: true });
      const rejects = expect(p).rejects.toThrow(
        /FAILED transition raced/,
      );
      await vi.runAllTimersAsync();
      await rejects;

      // Did NOT move to DLQ (row was no longer eligible)
      expect(redis.xadd).not.toHaveBeenCalled();
      expect(events.emitOrderFailed).not.toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });
  });

  // ── CLOB-accepted sentinel (PENDING path) ──────────────────────────────

  describe("processIntent() — CLOB-accepted sentinel for PENDING orders", () => {
    it("skips re-submission for PENDING order when sentinel exists", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deleted: false,
        deletedAt: null,
      });
      prisma.order.findFirst.mockResolvedValue({
        id: "pending-order",
        status: "PENDING",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(),
      });
      redis.get.mockImplementation((key: string) => {
        if (key === "clob:accepted:intent-1") return Promise.resolve("clob-sentinel-456");
        return Promise.resolve(null);
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();

      // Persisted venue order id + set status to SUBMITTED
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "pending-order" },
        data: {
          clobOrderId: "clob-sentinel-456",
          venueOrderId: "clob-sentinel-456",
          status: "SUBMITTED",
        },
      });

      expect(redis.del).toHaveBeenCalledWith("clob:accepted:intent-1");
    });

    it("throws when PENDING sentinel backfill DB update fails (prevents stream ACK on non-reclaimed path)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deleted: false,
        deletedAt: null,
      });
      prisma.order.findFirst.mockResolvedValue({
        id: "pending-order",
        status: "PENDING",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(),
      });
      redis.get.mockImplementation((key: string) => {
        if (key === "clob:accepted:intent-1") return Promise.resolve("clob-sentinel-456");
        return Promise.resolve(null);
      });
      prisma.order.update.mockRejectedValue(new Error("DB transient error"));

      const p = svc.processIntent(makeIntent());
      const rejects = expect(p).rejects.toThrow("DB transient error");
      await vi.runAllTimersAsync();
      await rejects;

      // Did NOT delete the sentinel (preserved for retry)
      expect(redis.del).not.toHaveBeenCalled();
      // Did NOT attempt CLOB submission
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("writes CLOB-accepted sentinel after successful venue submission", async () => {
      // Normal happy path — no existing order
      prisma.order.findFirst.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(redis.set).toHaveBeenCalledWith(
        "clob:accepted:intent-1",
        "clob-123", // from CLOB_LIVE mock
        86400,
      );
    });
  });

  // ── Concurrent duplicate processing (claim prevents double-submit) ─────

  describe("processIntent() — concurrent duplicate protection", () => {
    it("second concurrent processor skips when claim already taken", async () => {
      // Simulate first processor winning the claim
      let claimAttempted = false;
      prisma.order.updateMany.mockImplementation((_args: any) => {
        if (!claimAttempted) {
          claimAttempted = true;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });

      // Second processor's findFirst sees the PENDING order from first
      let findFirstCallCount = 0;
      prisma.order.findFirst.mockImplementation(() => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return Promise.resolve(null);
        // Second call: processor 2 sees the PENDING order (first hasn't claimed yet)
        return Promise.resolve({
          id: "order-claimed",
          status: "SUBMITTED",
          clobOrderId: null,
          venueOrderId: null,
          updatedAt: new Date(),
        });
      });

      const intents = [
        makeIntent({ intentId: "same-intent" }),
        makeIntent({ intentId: "same-intent" }),
      ];

      // Run two intents with the same intentId concurrently
      const results = await Promise.allSettled([
        svc.processIntent(intents[0]),
        svc.processIntent(intents[1]),
      ]);

      // Both should resolve (second skips after fresh claim detected)
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      // Only one submission to CLOB
      expect(clob.submitOrder).toHaveBeenCalledTimes(1);
    });
  });

  // ── processIntent — execution blocking ───────────────────────────────────

  describe("processIntent() — execution blocking", () => {
    it("blocks before DB create when user is suspended in DB", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: true,
        deletedAt: null,
        usRailTermsAcceptedAt: new Date("2026-04-29T00:00:00.000Z"),
        usRailTermsVersion: CURRENT_US_RAIL_TERMS_VERSION,
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "USER_BLOCKED" }),
        10_000,
      );
    });

    it("blocks before DB create when user is deleted in DB", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deletedAt: new Date(),
        usRailTermsAcceptedAt: new Date("2026-04-29T00:00:00.000Z"),
        usRailTermsVersion: CURRENT_US_RAIL_TERMS_VERSION,
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "USER_BLOCKED" }),
        10_000,
      );
    });

    it("blocks before DB create when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "USER_BLOCKED" }),
        10_000,
      );
    });

    it("blocks before DB create when Redis suspended marker exists", async () => {
      redis.get.mockResolvedValue("1");

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "USER_BLOCKED" }),
        10_000,
      );
    });

    it("writes DLQ then cancels existing PENDING order when user is blocked on retry/redelivery", async () => {
      // Simulate skipDbCreate path: an existing PENDING order with no
      // CLOB-accepted sentinel.  User becomes blocked before retry.
      prisma.order.findFirst.mockResolvedValue({
        id: "existing-order-1",
        status: "PENDING",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(),
      });
      // CLOB-accepted sentinel → null (no prior submission)
      redis.get
        .mockResolvedValueOnce(null) // clob:accepted:intent-1 → null
        .mockResolvedValueOnce("1")  // suspended:user-1 → blocked
        .mockResolvedValue(null);    // fallback
      prisma.user.findUnique.mockResolvedValue({
        suspended: true,
        deletedAt: null,
      });

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      // Must write DLQ entry first so that a retry on transient Redis failure
      // does not find the order already CANCELLED with no DLQ record.
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "USER_BLOCKED" }),
        10_000,
      );
      // Must cancel the existing order after the DLQ write is durable
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "existing-order-1" },
          data: expect.objectContaining({
            status: "CANCELLED",
            clobStatus: "CANCELLED",
          }),
        }),
      );
      expect(events.emitOrderCancelled).toHaveBeenCalled();
      // Must NOT create a new row
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it("does not cancel existing order when DLQ write fails, preserving retry", async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: "existing-order-2",
        status: "PENDING",
        clobOrderId: null,
        venueOrderId: null,
        updatedAt: new Date(),
      });
      redis.get
        .mockResolvedValueOnce(null) // clob:accepted:intent-1 → null
        .mockResolvedValueOnce("1")  // suspended:user-1 → blocked
        .mockResolvedValue(null);    // fallback
      prisma.user.findUnique.mockResolvedValue({
        suspended: true,
        deletedAt: null,
      });
      redis.xadd.mockRejectedValue(new Error("Redis down"));

      const p = svc.processIntent(makeIntent());
      const rejection = expect(p).rejects.toThrow("Redis down");
      await vi.runAllTimersAsync();
      await rejection;

      // Order must NOT be cancelled — the DLQ write failed, so we keep the
      // order retryable so the next attempt can retry the DLQ write.
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it("cancels order before submission when user becomes blocked after claim", async () => {
      // First check (before DB create) — user is not blocked.
      // Second check (after claim) — user has been suspended.
      prisma.user.findUnique
        .mockResolvedValueOnce({
          suspended: false,
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          suspended: true,
          deletedAt: null,
        });
      redis.get.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CANCELLED",
            clobStatus: "CANCELLED",
          }),
        }),
      );
      expect(events.emitOrderCancelled).toHaveBeenCalled();
      expect(signer.signOrder).not.toHaveBeenCalled();
      expect(clob.submitOrder).not.toHaveBeenCalled();
    });

    it("allows happy-path execution when user is not blocked", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deletedAt: null,
        usRailTermsAcceptedAt: new Date("2026-04-29T00:00:00.000Z"),
        usRailTermsVersion: CURRENT_US_RAIL_TERMS_VERSION,
      });
      redis.get.mockResolvedValue(null);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(prisma.order.create).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "LIVE" }),
        }),
      );
      expect(redis.xadd).not.toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({ reason: "USER_BLOCKED" }),
        10_000,
      );
    });
  });
});
