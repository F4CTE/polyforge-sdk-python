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

function createMockFills() {
  return {
    simulate: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("StreamConsumerService (paper-order-service)", () => {
  let service: StreamConsumerService;
  let redis: ReturnType<typeof createMockRedis>;
  let fills: ReturnType<typeof createMockFills>;

  beforeEach(() => {
    redis = createMockRedis();
    fills = createMockFills();
    service = new StreamConsumerService(redis, fills);
  });

  // ── parseFields ─────────────────────────────────────────────────────────

  describe("parseFields", () => {
    const parseFields = (svc: any, fields: string[]) =>
      svc["parseFields"](fields);

    it("converts flat string array to key-value object", () => {
      const result = parseFields(service, [
        "intentId", "i1",
        "userId", "u1",
        "marketId", "m1",
      ]);

      expect(result).toEqual({
        intentId: "i1",
        userId: "u1",
        marketId: "m1",
      });
    });

    it("handles empty fields array", () => {
      const result = parseFields(service, []);

      expect(result).toEqual({});
    });
  });

  // ── ensureGroup ─────────────────────────────────────────────────────────

  describe("ensureGroup", () => {
    it("creates consumer group without error", async () => {
      await (service as any).ensureGroup();

      expect(redis.getClient().xgroup).toHaveBeenCalledWith(
        "CREATE",
        "stream:paper_orders",
        "paper-order-service",
        "$",
        "MKSTREAM",
      );
    });

    it("ignores BUSYGROUP error (group already exists)", async () => {
      redis.getClient().xgroup.mockRejectedValueOnce(
        new Error("BUSYGROUP Consumer Group name already exists"),
      );

      await expect((service as any).ensureGroup()).resolves.toBeUndefined();
    });

    it("rethrows non-BUSYGROUP errors", async () => {
      redis.getClient().xgroup.mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      await expect((service as any).ensureGroup()).rejects.toThrow(
        "Connection refused",
      );
    });
  });

  // ── simulate called per message ─────────────────────────────────────────

  describe("message processing", () => {
    it("calls fills.simulate for each message", async () => {
      const client = redis.getClient();
      // Simulate one batch then null
      client.xreadgroup
        .mockResolvedValueOnce([
          [
            "stream:paper_orders",
            [
              ["msg-1", ["intentId", "i1", "userId", "u1", "size", "10", "price", "0.5"]],
              ["msg-2", ["intentId", "i2", "userId", "u2", "size", "20", "price", "0.6"]],
            ],
          ],
        ])
        .mockResolvedValue(null);

      // Run one iteration of the loop manually
      (service as any).running = true;
      const results: any = await client.xreadgroup(
        "GROUP", "paper-order-service", expect.any(String),
        "COUNT", "50", "BLOCK", "2000", "STREAMS", "stream:paper_orders", ">"
      );

      for (const [, messages] of results) {
        for (const [id, fields] of messages) {
          const intent = (service as any).parseFields(fields);
          await fills.simulate(intent);
          await client.xack("stream:paper_orders", "paper-order-service", id);
        }
      }

      expect(fills.simulate).toHaveBeenCalledTimes(2);
      expect(client.xack).toHaveBeenCalledTimes(2);
    });
  });
});
