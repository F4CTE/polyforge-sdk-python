import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    intentId: "intent-1",
    userId: "user-1",
    strategyId: "strat-1",
    marketId: "market-1",
    tokenId: "token-1",
    side: "BUY",
    size: 100,
    price: 0.65,
    status: "FILLED",
    errorMessage: null,
    createdAt: new Date("2024-05-01"),
    user: { username: "alice" },
    ...overrides,
  };
}

/** Build a flat Redis stream fields array from a plain object */
function fieldsFrom(obj: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    out.push(k, v);
  }
  return out;
}

function makePrisma() {
  return {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function makeRedisClient() {
  return {
    xrange: vi.fn(),
    xadd: vi.fn().mockResolvedValue("1234-0"),
    xdel: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue("OK"),
  };
}

function makeRedis(client = makeRedisClient()) {
  return {
    getClient: vi.fn().mockReturnValue(client),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof makePrisma>;
  let redisClient: ReturnType<typeof makeRedisClient>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    redisClient = makeRedisClient();
    redis = makeRedis(redisClient);
    service = new OrdersService(prisma as any, redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated order list with correct shape", async () => {
      const orders = [makeOrder(), makeOrder({ id: "order-2" })];
      prisma.order.findMany.mockResolvedValue(orders as any);
      prisma.order.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("calculates pages correctly for non-divisible total", async () => {
      prisma.order.findMany.mockResolvedValue([makeOrder()] as any);
      prisma.order.count.mockResolvedValue(23);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.pages).toBe(3);
    });

    it("applies correct skip for page 5 with limit 10", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 5, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.skip).toBe(40);
      expect(call.take).toBe(10);
    });

    it("filters by userId when provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, userId: "user-99" });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-99");
    });

    it("omits userId filter when not provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.userId).toBeUndefined();
    });

    it("filters by status when provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: "PENDING" });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.status).toBe("PENDING");
    });

    it("omits status filter when not provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.status).toBeUndefined();
    });

    it("sets createdAt.gte when from is provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, from: "2024-01-01" });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    });

    it("sets createdAt.lte when to is provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, to: "2024-12-31" });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    });

    it("sets both gte and lte when from and to are both provided", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        from: "2024-01-01",
        to: "2024-06-30",
      });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    });

    it("does not add createdAt filter when neither from nor to is given", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toBeUndefined();
    });

    it("orders results by createdAt descending", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: "desc" });
    });

    it("selects user username via nested select", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      expect(call.select.user.select.username).toBe(true);
    });

    it("selects all expected scalar fields", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.order.findMany.mock.calls[0][0];
      const s = call.select;
      expect(s.id).toBe(true);
      expect(s.intentId).toBe(true);
      expect(s.userId).toBe(true);
      expect(s.strategyId).toBe(true);
      expect(s.marketId).toBe(true);
      expect(s.tokenId).toBe(true);
      expect(s.side).toBe(true);
      expect(s.size).toBe(true);
      expect(s.price).toBe(true);
      expect(s.status).toBe(true);
      expect(s.errorMessage).toBe(true);
      expect(s.createdAt).toBe(true);
    });

    it("passes same where clause to both findMany and count", async () => {
      prisma.order.findMany.mockResolvedValue([] as any);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        userId: "user-4",
        status: "FAILED",
      });

      const findCall = prisma.order.findMany.mock.calls[0][0];
      const countCall = prisma.order.count.mock.calls[0][0];
      expect(findCall.where).toEqual(countCall.where);
    });
  });

  // ── getDlq ────────────────────────────────────────────────────────────────

  describe("getDlq", () => {
    it("returns an empty array when the stream has no entries", async () => {
      redisClient.xrange.mockResolvedValue([]);

      const result = await service.getDlq();

      expect(result).toEqual([]);
    });

    it("returns an empty array when xrange returns null/undefined", async () => {
      redisClient.xrange.mockResolvedValue(null);

      const result = await service.getDlq();

      expect(result).toEqual([]);
    });

    it("reads up to 100 entries with COUNT 100", async () => {
      redisClient.xrange.mockResolvedValue([]);

      await service.getDlq();

      expect(redisClient.xrange).toHaveBeenCalledWith(
        "stream:orders:dlq",
        "-",
        "+",
        "COUNT",
        100,
      );
    });

    it("parses a single stream entry into a flat object with streamId", async () => {
      const fields = fieldsFrom({
        intentId: "intent-abc",
        side: "BUY",
      });
      redisClient.xrange.mockResolvedValue([["1234-0", fields]]);

      const result = await service.getDlq();

      expect(result).toHaveLength(1);
      expect(result[0].streamId).toBe("1234-0");
      expect(result[0].intentId).toBe("intent-abc");
      expect(result[0].side).toBe("BUY");
    });

    it("JSON-parses field values that are valid JSON", async () => {
      const payload = JSON.stringify({ marketId: "mkt-1", size: 50 });
      const fields = fieldsFrom({ intent: payload });
      redisClient.xrange.mockResolvedValue([["9999-0", fields]]);

      const result = await service.getDlq();

      expect(result[0].intent).toEqual({ marketId: "mkt-1", size: 50 });
    });

    it("keeps field value as a string when it is not valid JSON", async () => {
      const fields = fieldsFrom({ errorMessage: "timeout error" });
      redisClient.xrange.mockResolvedValue([["1111-0", fields]]);

      const result = await service.getDlq();

      expect(result[0].errorMessage).toBe("timeout error");
    });

    it("parses multiple entries correctly", async () => {
      redisClient.xrange.mockResolvedValue([
        ["1000-0", fieldsFrom({ intentId: "intent-1" })],
        ["2000-0", fieldsFrom({ intentId: "intent-2" })],
        ["3000-0", fieldsFrom({ intentId: "intent-3" })],
      ]);

      const result = await service.getDlq();

      expect(result).toHaveLength(3);
      expect(result.map((r: any) => r.intentId)).toEqual([
        "intent-1",
        "intent-2",
        "intent-3",
      ]);
    });
  });

  // ── replayDlqEntry ────────────────────────────────────────────────────────

  describe("replayDlqEntry", () => {
    it("re-publishes fields to the orders stream and removes from DLQ", async () => {
      const fields = fieldsFrom({ intentId: "intent-42", side: "SELL" });
      redisClient.xrange.mockResolvedValue([["5000-0", fields]]);

      const result = await service.replayDlqEntry("intent-42");

      expect(result).toEqual({ replayed: true, intentId: "intent-42" });
      expect(redisClient.xadd).toHaveBeenCalledWith(
        "stream:orders",
        "*",
        ...fields,
      );
      expect(redisClient.xdel).toHaveBeenCalledWith(
        "stream:orders:dlq",
        "5000-0",
      );
    });

    it("matches by intentId stored directly as a top-level field", async () => {
      const fields = fieldsFrom({ intentId: "direct-intent", price: "0.5" });
      redisClient.xrange.mockResolvedValue([["1-0", fields]]);

      const result = await service.replayDlqEntry("direct-intent");

      expect(result.replayed).toBe(true);
    });

    it("matches by intentId nested inside a JSON intent field", async () => {
      const intent = JSON.stringify({ intentId: "nested-intent", size: 20 });
      const fields = fieldsFrom({ intent });
      redisClient.xrange.mockResolvedValue([["2-0", fields]]);

      const result = await service.replayDlqEntry("nested-intent");

      expect(result.replayed).toBe(true);
      expect(result.intentId).toBe("nested-intent");
    });

    it("skips non-matching entries and finds the correct one", async () => {
      const fields1 = fieldsFrom({ intentId: "intent-wrong" });
      const fields2 = fieldsFrom({ intentId: "intent-target" });
      redisClient.xrange.mockResolvedValue([
        ["1-0", fields1],
        ["2-0", fields2],
      ]);

      const result = await service.replayDlqEntry("intent-target");

      expect(result.replayed).toBe(true);
      expect(redisClient.xdel).toHaveBeenCalledWith("stream:orders:dlq", "2-0");
    });

    it("throws NotFoundException when entries is null", async () => {
      redisClient.xrange.mockResolvedValue(null);

      await expect(service.replayDlqEntry("intent-x")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NOT_FOUND when entries is null", async () => {
      redisClient.xrange.mockResolvedValue(null);

      await expect(service.replayDlqEntry("intent-x")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NotFoundException when intentId is not found in the stream", async () => {
      const fields = fieldsFrom({ intentId: "other-intent" });
      redisClient.xrange.mockResolvedValue([["1-0", fields]]);

      await expect(service.replayDlqEntry("ghost-intent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NOT_FOUND code when intentId is not found", async () => {
      const fields = fieldsFrom({ intentId: "some-other" });
      redisClient.xrange.mockResolvedValue([["1-0", fields]]);

      await expect(service.replayDlqEntry("missing")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("calls xrange on the DLQ stream key", async () => {
      redisClient.xrange.mockResolvedValue(null);

      await expect(service.replayDlqEntry("x")).rejects.toThrow();

      expect(redisClient.xrange).toHaveBeenCalledWith(
        "stream:orders:dlq",
        "-",
        "+",
      );
    });
  });

  // ── discardDlqEntry ───────────────────────────────────────────────────────

  describe("discardDlqEntry", () => {
    it("deletes the stream entry and marks it as discarded", async () => {
      const fields = fieldsFrom({ intentId: "intent-discard" });
      redisClient.xrange.mockResolvedValue([["7-0", fields]]);

      const result = await service.discardDlqEntry("intent-discard");

      expect(result).toEqual({ discarded: true });
      expect(redisClient.xdel).toHaveBeenCalledWith("stream:orders:dlq", "7-0");
      expect(redisClient.set).toHaveBeenCalledWith(
        "dlq:discarded:intent-discard",
        "1",
        "EX",
        86400 * 7,
      );
    });

    it("matches by intentId stored directly as a top-level field", async () => {
      const fields = fieldsFrom({ intentId: "direct-discard" });
      redisClient.xrange.mockResolvedValue([["10-0", fields]]);

      const result = await service.discardDlqEntry("direct-discard");

      expect(result.discarded).toBe(true);
    });

    it("matches by intentId nested inside a JSON intent field", async () => {
      const intent = JSON.stringify({ intentId: "nested-discard", size: 5 });
      const fields = fieldsFrom({ intent });
      redisClient.xrange.mockResolvedValue([["20-0", fields]]);

      const result = await service.discardDlqEntry("nested-discard");

      expect(result.discarded).toBe(true);
    });

    it("skips non-matching entries and discards the correct one", async () => {
      const fields1 = fieldsFrom({ intentId: "intent-a" });
      const fields2 = fieldsFrom({ intentId: "intent-b" });
      redisClient.xrange.mockResolvedValue([
        ["3-0", fields1],
        ["4-0", fields2],
      ]);

      await service.discardDlqEntry("intent-b");

      expect(redisClient.xdel).toHaveBeenCalledWith("stream:orders:dlq", "4-0");
      expect(redisClient.set).toHaveBeenCalledWith(
        "dlq:discarded:intent-b",
        "1",
        "EX",
        604800,
      );
    });

    it("uses a 7-day TTL (604800 seconds) for the discarded marker", async () => {
      const fields = fieldsFrom({ intentId: "intent-ttl" });
      redisClient.xrange.mockResolvedValue([["99-0", fields]]);

      await service.discardDlqEntry("intent-ttl");

      const setCall = redisClient.set.mock.calls[0];
      // setCall = [key, "1", "EX", 604800]
      expect(setCall[3]).toBe(604800);
    });

    it("throws NotFoundException when entries is null", async () => {
      redisClient.xrange.mockResolvedValue(null);

      await expect(service.discardDlqEntry("intent-x")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NOT_FOUND when entries is null", async () => {
      redisClient.xrange.mockResolvedValue(null);

      await expect(service.discardDlqEntry("intent-x")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NotFoundException when intentId is not in the stream", async () => {
      const fields = fieldsFrom({ intentId: "other-entry" });
      redisClient.xrange.mockResolvedValue([["1-0", fields]]);

      await expect(service.discardDlqEntry("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NOT_FOUND code when intentId is not found", async () => {
      const fields = fieldsFrom({ intentId: "wrong" });
      redisClient.xrange.mockResolvedValue([["1-0", fields]]);

      await expect(service.discardDlqEntry("missing")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("calls xrange on the DLQ stream key", async () => {
      redisClient.xrange.mockResolvedValue(null);

      await expect(service.discardDlqEntry("x")).rejects.toThrow();

      expect(redisClient.xrange).toHaveBeenCalledWith(
        "stream:orders:dlq",
        "-",
        "+",
      );
    });

    it("does not call xdel when intentId is not found", async () => {
      const fields = fieldsFrom({ intentId: "other" });
      redisClient.xrange.mockResolvedValue([["1-0", fields]]);

      await expect(service.discardDlqEntry("missing")).rejects.toThrow();

      expect(redisClient.xdel).not.toHaveBeenCalled();
    });
  });
});
