import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamConsumerService } from "./stream-consumer.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockRedis() {
  return {
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn().mockResolvedValue("OK"),
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

function createMockOrders() {
  return {
    processBatch: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockConfig() {
  return {
    get: vi.fn().mockReturnValue(undefined),
  } as any;
}

function createMockStreamMonitor() {
  return {
    register: vi.fn(),
  } as any;
}

function createMockPelReclaim() {
  return {
    register: vi.fn(),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("StreamConsumerService (order-service)", () => {
  let service: StreamConsumerService;
  let redis: ReturnType<typeof createMockRedis>;
  let orders: ReturnType<typeof createMockOrders>;

  beforeEach(() => {
    redis = createMockRedis();
    orders = createMockOrders();
    service = new StreamConsumerService(
      redis,
      orders,
      createMockConfig(),
      createMockStreamMonitor(),
      createMockPelReclaim(),
    );
  });

  // ── parseIntent ─────────────────────────────────────────────────────────

  describe("parseIntent", () => {
    const parseIntent = (svc: any, fields: string[]) =>
      svc["parseIntent"](fields);

    it("parses valid fields into an OrderIntent", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
        "strategyId",
        "strat-1",
        "marketId",
        "m1",
        "tokenId",
        "t1",
        "side",
        "BUY",
        "outcome",
        "YES",
        "size",
        "100",
        "price",
        "0.55",
        "orderType",
        "GTC",
      ]);

      expect(result).toMatchObject({
        intentId: "int-1",
        userId: "user-1",
        marketId: "m1",
        side: "BUY",
        size: "100",
      });
    });

    it("returns null when intentId is missing", () => {
      const result = parseIntent(service, [
        "userId",
        "user-1",
        "marketId",
        "m1",
      ]);

      expect(result).toBeNull();
    });

    it("returns null when userId is missing", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "marketId",
        "m1",
      ]);

      expect(result).toBeNull();
    });

    it("defaults orderType to GTC when not provided", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
      ]);

      expect(result?.orderType).toBe("GTC");
    });

    it("returns null when expiration is not numeric", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
        "expiration",
        "not-a-number",
      ]);

      expect(result).toBeNull();
    });

    it("returns null when expiration is negative", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
        "expiration",
        "-1",
      ]);

      expect(result).toBeNull();
    });

    it("parses expiration as a finite non-negative number", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
        "expiration",
        "1800000000",
      ]);

      expect(result?.expiration).toBe(1_800_000_000);
    });

    it("parses venue field from Redis stream", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
        "venue",
        "kalshi",
      ]);

      expect(result?.venue).toBe("kalshi");
    });

    it("parses kalshiSubaccount field from Redis stream", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
        "venue",
        "kalshi",
        "kalshiSubaccount",
        "3",
      ]);

      expect(result?.venue).toBe("kalshi");
      expect(result?.kalshiSubaccount).toBe(3);
    });

    it("omits venue and kalshiSubaccount when not in stream fields", () => {
      const result = parseIntent(service, [
        "intentId",
        "int-1",
        "userId",
        "user-1",
      ]);

      expect(result?.venue).toBeUndefined();
      expect(result?.kalshiSubaccount).toBeUndefined();
    });
  });

  // ── pollOnce ──────────────────────────────────────────────────────────

  describe("pollOnce", () => {
    it("processes messages and calls processBatch per user", async () => {
      const client = redis.getClient();
      client.xreadgroup.mockResolvedValueOnce([
        [
          "stream:orders",
          [
            [
              "msg-1",
              [
                "intentId",
                "i1",
                "userId",
                "u1",
                "marketId",
                "m1",
                "tokenId",
                "t1",
                "side",
                "BUY",
                "outcome",
                "YES",
                "size",
                "10",
                "price",
                "0.5",
                "orderType",
                "GTC",
              ],
            ],
          ],
        ],
      ]);

      await (service as any).pollOnce();

      expect(orders.processBatch).toHaveBeenCalledOnce();
      expect(client.xack).toHaveBeenCalled();
    });

    it("acks and skips messages with invalid intent", async () => {
      const client = redis.getClient();
      const warnSpy = vi
        .spyOn((service as any).logger, "warn")
        .mockImplementation(() => undefined);
      client.xreadgroup.mockResolvedValueOnce([
        [
          "stream:orders",
          [
            ["msg-1", ["badField", "badValue"]], // missing intentId/userId
          ],
        ],
      ]);

      await (service as any).pollOnce();

      expect(orders.processBatch).not.toHaveBeenCalled();
      expect(client.xack).toHaveBeenCalledWith(
        "stream:orders",
        "order-service",
        "msg-1",
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ORDER_INTENT_DROPPED",
          msgId: "msg-1",
          stream: "stream:orders",
          reason: "missing_required_fields",
          fields: { badField: "badValue" },
        }),
        "Dropped invalid order intent from Redis stream",
      );
    });

    it("logs parse exceptions with a structured err field", () => {
      const errorSpy = vi
        .spyOn((service as any).logger, "error")
        .mockImplementation(() => undefined);
      const err = new Error("bad parse");
      err.stack = "Error: bad parse\n    at parseIntent (stream.ts:42:7)";

      (service as any).logDroppedIntent("msg-parse", "parse_error", {}, err);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "ORDER_INTENT_PARSE_ERROR",
          stream: "stream:orders",
          msgId: "msg-parse",
          err,
        }),
        "Failed to parse order intent from Redis stream",
      );
    });
  });

  describe("onModuleDestroy", () => {
    it("waits for the active consume loop to stop", async () => {
      let resolved = false;
      const loopPromise = Promise.resolve().then(() => {
        resolved = true;
      });
      (service as any).running = true;
      (service as any).loopPromise = loopPromise;

      await service.onModuleDestroy();

      expect((service as any).running).toBe(false);
      expect(resolved).toBe(true);
    });
  });
});
