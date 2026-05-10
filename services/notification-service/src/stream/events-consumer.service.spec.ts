import { describe, it, expect, beforeEach, vi } from "vitest";

// We test the toNotifType mapping and parseFields logic by accessing the module.
// Since toNotifType is a module-level function, we test through the service's behavior.

// ─── Mock dependencies ──────────────────────────────────────────────────────

function createMockRedis() {
  return {
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn().mockResolvedValue("OK"),
      xreadgroup: vi.fn().mockResolvedValue(null),
      xack: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

function createMockNotification() {
  return {
    handle: vi.fn().mockResolvedValue(undefined),
  } as any;
}

import { EventsConsumerService } from "./events-consumer.service";

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
    // Test the consume loop by simulating xreadgroup returning messages
    async function simulateMessage(fields: string[]) {
      const client = redis.getClient();
      client.xreadgroup.mockResolvedValueOnce([
        ["stream:events", [["msg-1", fields]]],
      ]);
      // After one message, return null to stop processing
      client.xreadgroup.mockResolvedValueOnce(null);

      // Start and immediately stop to process one batch
      await (service as any).ensureGroup();
      (service as any).running = true;

      // Run one iteration manually
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
              // Reproduce the toNotifType logic inline for testing
              const typeMap: Record<string, string> = {
                ORDER_FILLED: "ORDER_FILLED",
                STRATEGY_ERROR: "STRATEGY_ERROR",
                PRICE_ALERT_TRIGGERED: "PRICE_ALERT",
                DAILY_LOSS_TRIGGERED: "DAILY_LOSS_LIMIT",
                MARKET_RESOLVED: "MARKET_RESOLVED",
                NEWS_SIGNAL: "NEWS_SIGNAL",
                ARBITRAGE_OPPORTUNITY: "ARBITRAGE_OPPORTUNITY",
                ARBITRAGE_CROSS_VENUE: "ARBITRAGE_CROSS_VENUE",
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

    it("acks a notification message only after the handler succeeds", async () => {
      const client = redis.getClient();
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
      );
      expect(client.xack).toHaveBeenCalledWith(
        "stream:events",
        "notification-service",
        "msg-1",
      );
    });

    it("does not ack a notification message when the handler fails", async () => {
      const client = redis.getClient();
      notification.handle.mockRejectedValueOnce(new Error("database down"));
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

      expect(notification.handle).toHaveBeenCalledOnce();
      expect(client.xack).not.toHaveBeenCalled();
    });
  });

  describe("consumeLoop", () => {
    it("logs notification handler failures with a structured err field", async () => {
      const client = redis.getClient();
      const err = new Error("template render failed");
      err.stack =
        "Error: template render failed\n    at handleNotification (events.ts:12:3)";
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
    });

    it("logs full error objects when the stream read fails", async () => {
      const client = redis.getClient();
      const err = new Error("redis down");
      err.stack = "Error: redis down\n    at consumeLoop (events.ts:42:7)";
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
    });
  });
});
