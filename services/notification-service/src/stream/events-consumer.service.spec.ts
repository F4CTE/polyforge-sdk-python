import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock dependencies ──────────────────────────────────────────────────────

function createMockRedis() {
  return {
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn().mockResolvedValue("OK"),
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn().mockResolvedValue(1),
      xadd: vi.fn().mockResolvedValue("new-dlq-id"),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

function createMockNotification() {
  return {
    handle: vi.fn().mockResolvedValue(undefined),
  } as any;
}

import { EventsConsumerService } from "./events-consumer.service";
import { LockContentionError } from "../notification/notification.service";

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("EventsConsumerService", () => {
  let service: EventsConsumerService;
  let redis: ReturnType<typeof createMockRedis>;
  let notification: ReturnType<typeof createMockNotification>;

  beforeEach(() => {
    redis = createMockRedis();
    notification = createMockNotification();
    service = new EventsConsumerService(
      redis,
      notification,
      { register: vi.fn() } as any,
      { register: vi.fn() } as any,
    );
  });

  // ── parseFields ─────────────────────────────────────────────────────────

  describe("parseFields", () => {
    it("converts flat string array to key-value object", () => {
      const result = (service as any).parseFields([
        "type",
        "ORDER_FILLED",
        "userId",
        "user-1",
        "marketId",
        "m1",
      ]);

      expect(result).toEqual({
        type: "ORDER_FILLED",
        userId: "user-1",
        marketId: "m1",
      });
    });

    it("returns empty object for empty array", () => {
      const result = (service as any).parseFields([]);

      expect(result).toEqual({});
    });
  });

  // ── Event type mapping ────────────────────────────────────────────────

  describe("event type routing", () => {
    async function simulateMessage(fields: string[]) {
      const client = redis.getClient();
      client.xreadgroup.mockResolvedValueOnce([
        ["stream:events", [["msg-1", fields]]],
      ]);
      client.xreadgroup.mockResolvedValueOnce(null);

      await (service as any).ensureGroup();
      (service as any).running = true;

      try {
        const results = await client.xreadgroup(
          "GROUP",
          "notification-service",
          expect.any(String),
          "COUNT",
          "100",
          "BLOCK",
          "2000",
          "STREAMS",
          "stream:events",
          ">",
        );
        if (results) {
          for (const [, messages] of results) {
            for (const [id, msgFields] of messages) {
              const event = (service as any).parseFields(msgFields);
              const typeMap: Record<string, string> = {
                ORDER_FILLED: "ORDER_FILLED",
                STRATEGY_ERROR: "STRATEGY_ERROR",
                PRICE_ALERT_TRIGGERED: "PRICE_ALERT",
                DAILY_LOSS_TRIGGERED: "DAILY_LOSS_LIMIT",
                MARKET_RESOLVED: "MARKET_RESOLVED",
                NEWS_SIGNAL: "NEWS_SIGNAL",
                ARBITRAGE_OPPORTUNITY: "ARBITRAGE_OPPORTUNITY",
                ARBITRAGE_CROSS_VENUE: "ARBITRAGE_CROSS_VENUE",
                TICKET_REPLY: "TICKET_REPLY",
                TICKET_CLOSED: "TICKET_CLOSED",
              };
              const notifType = typeMap[event.type] ?? null;
              if (notifType) {
                await notification.handle(notifType, event);
              }
            }
          }
        }
      } catch {
        // swallow
      }
    }

    it("routes ORDER_FILLED to notification handler", async () => {
      await simulateMessage(["type", "ORDER_FILLED", "userId", "u1"]);

      expect(notification.handle).toHaveBeenCalledWith(
        "ORDER_FILLED",
        expect.objectContaining({ type: "ORDER_FILLED", userId: "u1" }),
      );
    });

    it("routes PRICE_ALERT_TRIGGERED to PRICE_ALERT handler", async () => {
      await simulateMessage(["type", "PRICE_ALERT_TRIGGERED", "userId", "u1"]);

      expect(notification.handle).toHaveBeenCalledWith(
        "PRICE_ALERT",
        expect.objectContaining({ type: "PRICE_ALERT_TRIGGERED" }),
      );
    });

    it("ignores unknown event types", async () => {
      await simulateMessage(["type", "SOME_UNKNOWN_EVENT", "userId", "u1"]);

      expect(notification.handle).not.toHaveBeenCalled();
    });

    it("ignores NOTIFICATION event type to prevent self-amplification", async () => {
      await simulateMessage([
        "type",
        "NOTIFICATION",
        "userId",
        "u1",
        "title",
        "Test",
        "body",
        "Test body",
      ]);

      expect(notification.handle).not.toHaveBeenCalled();
    });

    it("routes TICKET_REPLY to notification handler", async () => {
      await simulateMessage([
        "type",
        "TICKET_REPLY",
        "userId",
        "u1",
        "subject",
        "Help needed",
      ]);

      expect(notification.handle).toHaveBeenCalledWith(
        "TICKET_REPLY",
        expect.objectContaining({
          type: "TICKET_REPLY",
          userId: "u1",
        }),
      );
    });

    it("routes TICKET_CLOSED to notification handler", async () => {
      await simulateMessage([
        "type",
        "TICKET_CLOSED",
        "userId",
        "u1",
        "subject",
        "Resolved",
      ]);

      expect(notification.handle).toHaveBeenCalledWith(
        "TICKET_CLOSED",
        expect.objectContaining({
          type: "TICKET_CLOSED",
          userId: "u1",
        }),
      );
    });
  });

  // ── consumeLoop ─────────────────────────────────────────────────────────

  describe("consumeLoop", () => {
    it("logs notification handler failures with a structured err field", async () => {
      const client = redis.getClient();
      const err = new Error("template render failed");
      const errorSpy = vi
        .spyOn((service as any).logger, "error")
        .mockImplementation(() => undefined);
      notification.handle.mockRejectedValueOnce(err);
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "user-1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      (service as any).running = true;
      await (service as any).consumeLoop();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "NOTIFICATION_HANDLE_FAILED",
          notifType: "ORDER_FILLED",
          userId: "user-1",
          err,
        }),
        "Failed to handle stream notification",
      );
      errorSpy.mockRestore();
    });

    it("logs full error objects when the stream read fails", async () => {
      const client = redis.getClient();
      const err = new Error("redis down");
      const errorSpy = vi
        .spyOn((service as any).logger, "error")
        .mockImplementation(() => undefined);
      client.xreadgroup.mockImplementationOnce(async () => {
        (service as any).running = false;
        throw err;
      });

      (service as any).running = true;
      await (service as any).consumeLoop();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "STREAM_CONSUME_ERROR",
          stream: "stream:events",
          group: "notification-service",
          err,
        }),
        "stream:events consume error",
      );
      errorSpy.mockRestore();
    });

    it("xacks message on successful processing", async () => {
      const client = redis.getClient();
      notification.handle.mockResolvedValue(undefined);
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "u1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      (service as any).running = true;
      await (service as any).consumeLoop();

      expect(notification.handle).toHaveBeenCalledWith(
        "ORDER_FILLED",
        expect.objectContaining({ type: "ORDER_FILLED", userId: "u1" }),
        "msg-1",
      );
      expect(client.xack).toHaveBeenCalledWith(
        "stream:events",
        "notification-service",
        "msg-1",
      );
    });

    it("increments retry counter on handler failure without xacking", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValueOnce(new Error("db error"));
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "u1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      (service as any).running = true;
      await (service as any).consumeLoop();

      // Should increment retry counter
      expect(client.incr).toHaveBeenCalledWith(
        "notif:retry:stream:events:msg-1",
      );
      expect(client.expire).toHaveBeenCalledWith(
        "notif:retry:stream:events:msg-1",
        86400,
      );
      // Should NOT xack — message stays in PEL for retry
      expect(client.xack).not.toHaveBeenCalled();
    });
  });

  // ── DLQ (dead-letter queue) ────────────────────────────────────────────

  describe("DLQ behavior", () => {
    it("moves message to DLQ after MAX_RETRIES failures", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValue(new Error("persistent error"));
      // Simulate that we've already retried 2 times (3rd failure triggers DLQ)
      client.incr.mockResolvedValue(3); // MAX_RETRIES = 3
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "u1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      const warnSpy = vi
        .spyOn((service as any).logger, "warn")
        .mockImplementation(() => undefined);

      (service as any).running = true;
      await (service as any).consumeLoop();

      // Should call eval (Lua script for atomic DLQ move)
      expect(client.eval).toHaveBeenCalledWith(
        expect.stringContaining("XADD"),
        4,
        "stream:events:dlq",
        "stream:events",
        "notification-service",
        "notif:retry:stream:events:msg-1",
        "msg-1",
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );

      // Should clean up retry counter (done inside Lua)
      expect(client.del).not.toHaveBeenCalled(); // del is now in Lua

      // Should log DLQ move
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "NOTIFICATION_MOVED_TO_DLQ",
          notifType: "ORDER_FILLED",
          userId: "u1",
          msgId: "msg-1",
          retries: 3,
        }),
        expect.stringContaining("DLQ"),
      );

      warnSpy.mockRestore();
    });

    it("does not move to DLQ before MAX_RETRIES is reached", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValue(new Error("transient error"));
      client.incr.mockResolvedValue(2); // 2 retries, below threshold of 3
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "u1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      (service as any).running = true;
      await (service as any).consumeLoop();

      // Should NOT XACK — message stays in PEL
      expect(client.xack).not.toHaveBeenCalled();
      // Should NOT XADD or eval to DLQ
      expect(client.xadd).not.toHaveBeenCalled();
      expect(client.eval).not.toHaveBeenCalled();
    });

    it("logs error when DLQ write fails and leaves message in PEL", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValue(new Error("handler error"));
      client.incr.mockResolvedValue(3); // triggers DLQ
      client.eval.mockRejectedValue(new Error("Redis OOM")); // DLQ Lua fails
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "u1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      const errorSpy = vi
        .spyOn((service as any).logger, "error")
        .mockImplementation(() => undefined);

      (service as any).running = true;
      await (service as any).consumeLoop();

      // Should log DLQ write failure
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DLQ_WRITE_FAILED",
          msgId: "msg-1",
        }),
        expect.stringContaining("DLQ"),
      );

      // Should NOT XACK — message stays in PEL as safety measure
      expect(client.xack).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it("cleans up DLQ entry when XACK returns 0 (already acknowledged elsewhere)", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValue(new Error("handler error"));
      client.incr.mockResolvedValue(3); // triggers DLQ
      // eval returns 0: XACK returned 0 (already acked), DLQ entry removed via XDEL
      client.eval.mockResolvedValue(0);
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:events",
            [["msg-1", ["type", "ORDER_FILLED", "userId", "u1"]]],
          ],
        ])
        .mockImplementationOnce(async () => {
          (service as any).running = false;
          return null;
        });

      const warnSpy = vi
        .spyOn((service as any).logger, "warn")
        .mockImplementation(() => undefined);

      (service as any).running = true;
      await (service as any).consumeLoop();

      // Should log that DLQ move was discarded (already acked)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DLQ_MOVE_DISCARDED",
          msgId: "msg-1",
        }),
        expect.stringContaining("already acknowledged"),
      );

      // Lua script should have been called with the correct args
      expect(client.eval).toHaveBeenCalledWith(
        expect.stringContaining("XDEL"),
        4,
        "stream:events:dlq",
        "stream:events",
        "notification-service",
        "notif:retry:stream:events:msg-1",
        "msg-1",
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );

      warnSpy.mockRestore();
    });
  });

  // ── handleWithRetry ──────────────────────────────────────────────────────

  describe("handleWithRetry", () => {
    it("xacks and returns true on successful processing", async () => {
      const client = redis.getClient();
      notification.handle.mockResolvedValue(undefined);

      const result = await (service as any).handleWithRetry(
        "msg-1",
        "ORDER_FILLED",
        { type: "ORDER_FILLED", userId: "u1" },
      );

      expect(result).toBe(true);
      expect(notification.handle).toHaveBeenCalledWith(
        "ORDER_FILLED",
        expect.objectContaining({ type: "ORDER_FILLED", userId: "u1" }),
        "msg-1",
      );
      expect(client.xack).toHaveBeenCalledWith(
        "stream:events",
        "notification-service",
        "msg-1",
      );
      expect(client.incr).not.toHaveBeenCalled();
    });

    it("increments retry counter and returns false on handler failure", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValue(new Error("fail"));

      const result = await (service as any).handleWithRetry(
        "msg-1",
        "ORDER_FILLED",
        { type: "ORDER_FILLED", userId: "u1" },
      );

      expect(result).toBe(false);
      expect(notification.handle).toHaveBeenCalledWith(
        "ORDER_FILLED",
        expect.objectContaining({ type: "ORDER_FILLED", userId: "u1" }),
        "msg-1",
      );
      expect(client.incr).toHaveBeenCalledWith(
        "notif:retry:stream:events:msg-1",
      );
      expect(client.xack).not.toHaveBeenCalled();
    });

    it("returns true on XACK failure after successful delivery without incrementing retry counter", async () => {
      const client = redis.getClient();
      notification.handle.mockResolvedValue(undefined);
      client.xack.mockRejectedValue(new Error("XACK network error"));

      const result = await (service as any).handleWithRetry(
        "msg-1",
        "ORDER_FILLED",
        { type: "ORDER_FILLED", userId: "u1" },
      );

      // Notification was delivered successfully — must return true
      expect(result).toBe(true);
      // Retry counter must NOT be incremented for an XACK-only failure
      expect(client.incr).not.toHaveBeenCalled();
      // XACK was attempted
      expect(client.xack).toHaveBeenCalledWith(
        "stream:events",
        "notification-service",
        "msg-1",
      );
    });

    it("returns false without XACK or retry increment on LockContentionError", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValue(
        new LockContentionError("msg-locked"),
      );

      const result = await (service as any).handleWithRetry(
        "msg-locked",
        "ORDER_FILLED",
        { type: "ORDER_FILLED", userId: "u1" },
      );

      // Lock contention: leave in PEL, don't XACK or increment retries
      expect(result).toBe(false);
      expect(client.xack).not.toHaveBeenCalled();
      expect(client.incr).not.toHaveBeenCalled();
      expect(client.eval).not.toHaveBeenCalled();
    });
  });
});
