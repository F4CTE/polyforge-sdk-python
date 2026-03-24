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

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("StreamConsumerService (order-service)", () => {
  let service: StreamConsumerService;
  let redis: ReturnType<typeof createMockRedis>;
  let orders: ReturnType<typeof createMockOrders>;

  beforeEach(() => {
    redis = createMockRedis();
    orders = createMockOrders();
    service = new StreamConsumerService(redis, orders, createMockConfig());
  });

  // ── parseIntent ─────────────────────────────────────────────────────────

  describe("parseIntent", () => {
    const parseIntent = (svc: any, fields: string[]) =>
      svc["parseIntent"](fields);

    it("parses valid fields into an OrderIntent", () => {
      const result = parseIntent(service, [
        "intentId", "int-1",
        "userId", "user-1",
        "strategyId", "strat-1",
        "marketId", "m1",
        "tokenId", "t1",
        "side", "BUY",
        "outcome", "YES",
        "size", "100",
        "price", "0.55",
        "orderType", "GTC",
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
        "userId", "user-1",
        "marketId", "m1",
      ]);

      expect(result).toBeNull();
    });

    it("returns null when userId is missing", () => {
      const result = parseIntent(service, [
        "intentId", "int-1",
        "marketId", "m1",
      ]);

      expect(result).toBeNull();
    });

    it("defaults orderType to GTC when not provided", () => {
      const result = parseIntent(service, [
        "intentId", "int-1",
        "userId", "user-1",
      ]);

      expect(result?.orderType).toBe("GTC");
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
            ["msg-1", ["intentId", "i1", "userId", "u1", "marketId", "m1", "tokenId", "t1", "side", "BUY", "outcome", "YES", "size", "10", "price", "0.5", "orderType", "GTC"]],
          ],
        ],
      ]);

      await (service as any).pollOnce();

      expect(orders.processBatch).toHaveBeenCalledOnce();
      expect(client.xack).toHaveBeenCalled();
    });

    it("acks and skips messages with invalid intent", async () => {
      const client = redis.getClient();
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
      expect(client.xack).toHaveBeenCalledWith("stream:orders", "order-service", "msg-1");
    });
  });
});
