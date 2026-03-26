import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrdersService, OrderIntent } from "./orders.service";

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
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;

  const redis = {
    xadd: vi.fn().mockResolvedValue("1234567890-0"),
  } as any;

  const signer = {
    signOrder: vi.fn().mockResolvedValue(SIGNED_ORDER),
  } as any;

  const clob = {
    submitOrder: vi.fn().mockResolvedValue(CLOB_LIVE),
  } as any;

  const events = {
    emitOrderPlaced: vi.fn().mockResolvedValue(undefined),
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

    it("calls signer with correct parameters", async () => {
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.userId).toBe("user-1");
      expect(signerCall.tokenId).toBe("token-1");
      expect(signerCall.side).toBe("BUY");
      expect(signerCall.size).toBe(10); // parsed from string '10'
      expect(signerCall.price).toBe(0.6); // parsed from string '0.6'
      expect(signerCall.orderType).toBe("GTC");
    });

    it("passes expiration when provided in the intent", async () => {
      const p = svc.processIntent(
        makeIntent({ expiration: 1_700_000_000, orderType: "GTD" }),
      );
      await vi.runAllTimersAsync();
      await p;

      const signerCall = signer.signOrder.mock.calls[0][0];
      expect(signerCall.expiration).toBe(1_700_000_000);
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

  // ── processIntent — retry logic ───────────────────────────────────────────

  describe("processIntent() — retry / DLQ", () => {
    it("retries when signer fails on first attempt (succeeds on attempt 2)", async () => {
      signer.signOrder
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue(SIGNED_ORDER);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).toHaveBeenCalledTimes(2);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("retries up to 3 times when signer keeps failing", async () => {
      signer.signOrder
        .mockRejectedValueOnce(new Error("fail-1"))
        .mockRejectedValueOnce(new Error("fail-2"))
        .mockResolvedValue(SIGNED_ORDER);

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).toHaveBeenCalledTimes(3);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("sends to DLQ after 3 failed attempts", async () => {
      signer.signOrder.mockRejectedValue(new Error("permanent failure"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(signer.signOrder).toHaveBeenCalledTimes(3);
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders:dlq",
        expect.objectContaining({
          reason: expect.stringContaining("permanent failure"),
        }),
      );
    });

    it("emits ORDER_FAILED event after exhausting all retries", async () => {
      signer.signOrder.mockRejectedValue(new Error("sign error"));

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(events.emitOrderFailed).toHaveBeenCalledOnce();
      expect(events.emitOrderFailed).toHaveBeenCalledWith(
        "user-1",
        expect.any(String),
        expect.any(String),
      );
    });

    it("updates order status to FAILED after DLQ", async () => {
      clob.submitOrder.mockRejectedValue(new Error("clob down"));

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

      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await p;

      expect(clob.submitOrder).toHaveBeenCalledTimes(2);
      expect(events.emitOrderPlaced).toHaveBeenCalledOnce();
    });

    it("DLQ entry contains intent metadata", async () => {
      signer.signOrder.mockRejectedValue(new Error("fail"));

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
  });

  // ── DLQ redis failure ─────────────────────────────────────────────────────

  describe("moveToDlq() — redis.xadd failure (indirect)", () => {
    it("swallows DLQ write errors without throwing", async () => {
      signer.signOrder.mockRejectedValue(new Error("sign fail"));
      redis.xadd.mockRejectedValue(new Error("Redis down"));

      // Should not throw even when DLQ write fails
      const p = svc.processIntent(makeIntent());
      await vi.runAllTimersAsync();
      await expect(p).resolves.toBeUndefined();
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
      expect(signerCall.price).toBeLessThanOrEqual(0.1);
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
      expect(signerCall.size).toBe(7.5);
    });
  });
});
