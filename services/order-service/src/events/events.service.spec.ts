import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventsService } from "./events.service";

const STREAM = "stream:events";

function makeRedis() {
  return { xadd: vi.fn().mockResolvedValue("1234-0") } as any;
}

describe("EventsService", () => {
  let svc: EventsService;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    redis = makeRedis();
    svc = new EventsService(redis);
  });

  describe("emitOrderPlaced()", () => {
    it("publishes to stream:events", async () => {
      await svc.emitOrderPlaced("u1", "o1", "i1");
      expect(redis.xadd).toHaveBeenCalledWith(STREAM, expect.any(Object));
    });

    it("payload has type ORDER_PLACED", async () => {
      await svc.emitOrderPlaced("u1", "o1", "i1");
      const payload = redis.xadd.mock.calls[0][1];
      expect(payload.type).toBe("ORDER_PLACED");
    });

    it("payload contains userId, orderId, intentId", async () => {
      await svc.emitOrderPlaced("user-a", "order-b", "intent-c");
      const payload = redis.xadd.mock.calls[0][1];
      expect(payload.userId).toBe("user-a");
      expect(payload.orderId).toBe("order-b");
      expect(payload.intentId).toBe("intent-c");
    });

    it("payload contains a ts field", async () => {
      await svc.emitOrderPlaced("u", "o", "i");
      const { ts } = redis.xadd.mock.calls[0][1];
      expect(Number(ts)).toBeGreaterThan(0);
    });
  });

  describe("emitOrderFilled()", () => {
    it("publishes to stream:events", async () => {
      await svc.emitOrderFilled("u", "o", "0.65", "10", "1.5");
      expect(redis.xadd).toHaveBeenCalledWith(STREAM, expect.any(Object));
    });

    it("payload has type ORDER_FILLED", async () => {
      await svc.emitOrderFilled("u", "o", "0.65", "10", "1.5");
      expect(redis.xadd.mock.calls[0][1].type).toBe("ORDER_FILLED");
    });

    it("payload contains fillPrice, fillSize, pnl", async () => {
      await svc.emitOrderFilled("u", "o", "0.65", "10", "1.50");
      const payload = redis.xadd.mock.calls[0][1];
      expect(payload.fillPrice).toBe("0.65");
      expect(payload.fillSize).toBe("10");
      expect(payload.pnl).toBe("1.50");
    });
  });

  describe("emitOrderCancelled()", () => {
    it("publishes to stream:events", async () => {
      await svc.emitOrderCancelled("u", "o");
      expect(redis.xadd).toHaveBeenCalledWith(STREAM, expect.any(Object));
    });

    it("payload has type ORDER_CANCELLED with userId and orderId", async () => {
      await svc.emitOrderCancelled("user-x", "order-y");
      const payload = redis.xadd.mock.calls[0][1];
      expect(payload.type).toBe("ORDER_CANCELLED");
      expect(payload.userId).toBe("user-x");
      expect(payload.orderId).toBe("order-y");
    });
  });

  describe("emitOrderFailed()", () => {
    it("publishes to stream:events", async () => {
      await svc.emitOrderFailed("u", "o", "signer down");
      expect(redis.xadd).toHaveBeenCalledWith(STREAM, expect.any(Object));
    });

    it("payload has type ORDER_FAILED with reason", async () => {
      await svc.emitOrderFailed("user-1", "order-2", "timeout error");
      const payload = redis.xadd.mock.calls[0][1];
      expect(payload.type).toBe("ORDER_FAILED");
      expect(payload.userId).toBe("user-1");
      expect(payload.orderId).toBe("order-2");
      expect(payload.reason).toBe("timeout error");
    });
  });
});
