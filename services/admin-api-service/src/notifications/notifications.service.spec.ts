import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotificationsAdminService } from "./notifications.service";
import { BadRequestException } from "@nestjs/common";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationHistory: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

function makeRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("1-0"),
    getClient: vi.fn().mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      smembers: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      keys: vi.fn(),
      scan: vi.fn().mockResolvedValue(["0", []]),
      info: vi.fn(),
      xadd: vi.fn(),
      xrange: vi.fn().mockResolvedValue([]),
      xdel: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue("1-0"),
      zscore: vi.fn(),
      zadd: vi.fn(),
      zrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zrem: vi.fn(),
      expire: vi.fn(),
    }),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("NotificationsAdminService", () => {
  let service: NotificationsAdminService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    service = new NotificationsAdminService(prisma as any, redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── broadcast ─────────────────────────────────────────────────────────────

  describe("broadcast", () => {
    it("sends to specific userIds when provided", async () => {
      const dto = {
        userIds: ["user-1", "user-2"],
        channel: "EMAIL",
        templateId: "tpl-announce",
        subject: "Hello!",
      };

      const result = await service.broadcast(dto);

      expect(result.queued).toBe(2);
      expect(result.channel).toBe("EMAIL");
      expect(redis.xadd).toHaveBeenCalledTimes(2);
    });

    it("broadcasts to all active verified users when userIds is empty", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "u-1" },
        { id: "u-2" },
        { id: "u-3" },
      ] as any);

      const dto = {
        channel: "PUSH",
        templateId: "tpl-broadcast",
        subject: "Announcement",
      };
      const result = await service.broadcast(dto);

      expect(result.queued).toBe(3);
      expect(redis.xadd).toHaveBeenCalledTimes(3);
    });

    it("queries only non-deleted, non-suspended, email-verified users for broadcast all", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);

      await service.broadcast({
        channel: "EMAIL",
        templateId: "tpl-1",
        subject: "x",
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deleted: false, suspended: false, emailVerified: true },
        }),
      );
    });

    it("does NOT query the database when explicit userIds are provided", async () => {
      const dto = {
        userIds: ["user-x"],
        channel: "EMAIL",
        templateId: "tpl-1",
        subject: "Test",
      };

      await service.broadcast(dto);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("publishes each event to stream:events with correct fields", async () => {
      const dto = {
        userIds: ["user-1"],
        channel: "EMAIL",
        templateId: "tpl-x",
        subject: "Test Subject",
        metadata: { foo: "bar" },
      };

      await service.broadcast(dto);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "NOTIFICATION",
          userId: "user-1",
          channel: "EMAIL",
          templateId: "tpl-x",
          subject: "Test Subject",
          source: "admin-broadcast",
        }),
      );
    });

    it("serializes metadata as JSON string", async () => {
      const dto = {
        userIds: ["user-1"],
        channel: "EMAIL",
        templateId: "tpl-x",
        subject: "x",
        metadata: { key: "value" },
      };

      await service.broadcast(dto);

      const call = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(call.metadata).toBe(JSON.stringify({ key: "value" }));
    });

    it('serializes empty metadata as "{}" when not provided', async () => {
      const dto = {
        userIds: ["user-1"],
        channel: "EMAIL",
        templateId: "tpl-x",
        subject: "x",
      };

      await service.broadcast(dto);

      const call = (redis.xadd as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(call.metadata).toBe("{}");
    });

    it("returns queued: 0 when broadcast-all finds no eligible users", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);

      const result = await service.broadcast({
        channel: "PUSH",
        templateId: "x",
        subject: "y",
      });

      expect(result.queued).toBe(0);
    });

    it("rejects broadcast exceeding 5000 recipients", async () => {
      const bigList = Array.from({ length: 5001 }, (_, i) => `user-${i}`);
      const dto = {
        userIds: bigList,
        channel: "EMAIL",
        templateId: "tpl-1",
        subject: "Spam",
      };

      await expect(service.broadcast(dto)).rejects.toThrow(
        /5000-recipient cap/,
      );
      expect(redis.xadd).not.toHaveBeenCalled();
    });

    it("allows broadcast with exactly 5000 recipients", async () => {
      const exactList = Array.from({ length: 5000 }, (_, i) => `user-${i}`);
      const dto = {
        userIds: exactList,
        channel: "EMAIL",
        templateId: "tpl-1",
        subject: "Legit",
      };

      const result = await service.broadcast(dto);
      expect(result.queued).toBe(5000);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("returns total, last24h, and failed counts", async () => {
      prisma.notificationHistory.count
        .mockResolvedValueOnce(500) // total
        .mockResolvedValueOnce(80) // last24h
        .mockResolvedValueOnce(12); // failed

      const result = await service.getStats();

      expect(result.total).toBe(500);
      expect(result.last24h).toBe(80);
      expect(result.failed).toBe(12);
    });

    it("returns zeros when no notification history exists", async () => {
      prisma.notificationHistory.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.last24h).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("queries failed notifications with success: false filter", async () => {
      prisma.notificationHistory.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      await service.getStats();

      const failedCall = prisma.notificationHistory.count.mock.calls[2][0];
      expect(failedCall.where.success).toBe(false);
    });

    it("uses a 24h window for last24h query (gte filter)", async () => {
      prisma.notificationHistory.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(0);

      const before = Date.now();
      await service.getStats();
      const after = Date.now();

      const last24hCall = prisma.notificationHistory.count.mock.calls[1][0];
      const gte: Date = last24hCall.where.sentAt.gte;
      expect(gte.getTime()).toBeGreaterThanOrEqual(before - 86400_000 - 100);
      expect(gte.getTime()).toBeLessThanOrEqual(after - 86400_000 + 100);
    });
  });

  // ── DLQ (dead-letter queue) ────────────────────────────────────────────────

  describe("DLQ", () => {
    it("getDlqEntries returns entries from the DLQ stream", async () => {
      const client = redis.getClient();
      client.xrange.mockResolvedValue([
        [
          "1-0",
          [
            "originalId",
            "msg-1",
            "type",
            "ORDER_FILLED",
            "notifType",
            "ORDER_FILLED",
            "userId",
            "u1",
            "dlqReason",
            "Exceeded 3 retries",
            "dlqTs",
            "1700000000000",
          ],
        ],
      ]);

      const result = await service.getDlqEntries();

      expect(client.xrange).toHaveBeenCalledWith(
        "stream:events:dlq",
        "-",
        "+",
        "COUNT",
        50,
      );
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe("1-0");
      expect(result.entries[0].originalId).toBe("msg-1");
      expect(result.entries[0].notifType).toBe("ORDER_FILLED");
      expect(result.nextCursor).toBeNull(); // single entry < limit
    });

    it("getDlqEntries respects limit and returns cursor", async () => {
      const client = redis.getClient();
      const entries = Array.from({ length: 3 }, (_, i) => [
        `1-${i}`,
        ["originalId", `msg-${i}`, "type", "ORDER_FILLED"],
      ]);
      client.xrange.mockResolvedValue(entries);

      const result = await service.getDlqEntries(3);

      expect(client.xrange).toHaveBeenCalledWith(
        "stream:events:dlq",
        "-",
        "+",
        "COUNT",
        3,
      );
      expect(result.entries).toHaveLength(3);
      expect(result.nextCursor).toBe("1-2");
    });

    it("getDlqEntries supports cursor-based pagination", async () => {
      const client = redis.getClient();
      client.xrange.mockResolvedValue([["1-5", ["originalId", "msg-5"]]]);

      await service.getDlqEntries(10, "1-3");

      // Exclusive start: cursor is (1-3
      expect(client.xrange).toHaveBeenCalledWith(
        "stream:events:dlq",
        "(1-3",
        "+",
        "COUNT",
        10,
      );
    });

    it("getDlqEntries clamps limit to 100 max", async () => {
      const client = redis.getClient();
      client.xrange.mockResolvedValue([]);

      await service.getDlqEntries(500);

      expect(client.xrange).toHaveBeenCalledWith(
        "stream:events:dlq",
        "-",
        "+",
        "COUNT",
        100,
      );
    });

    it("getDlqEntries clamps limit to 1 min", async () => {
      const client = redis.getClient();
      client.xrange.mockResolvedValue([]);

      await service.getDlqEntries(0);

      expect(client.xrange).toHaveBeenCalledWith(
        "stream:events:dlq",
        "-",
        "+",
        "COUNT",
        1,
      );
    });

    it("replayDlqEntry uses atomic Lua script and returns replayed id", async () => {
      const client = redis.getClient();
      client.eval.mockResolvedValue("1-0");

      const result = await service.replayDlqEntry("1-0");

      expect(client.eval).toHaveBeenCalledWith(
        expect.stringContaining("XRANGE"),
        1,
        "stream:events:dlq",
        "1-0",
        "100000",
      );
      expect(result.replayed).toBe("1-0");
    });

    it("replayDlqEntry throws BadRequestException when entry not found", async () => {
      const client = redis.getClient();
      client.eval.mockResolvedValue(null); // Lua returns nil when XRANGE empty

      await expect(service.replayDlqEntry("nonexistent")).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.replayDlqEntry("nonexistent")).rejects.toMatchObject(
        {
          response: {
            code: "DLQ_ENTRY_NOT_FOUND",
            message: expect.stringContaining("nonexistent"),
          },
        },
      );
    });

    it("discardDlqEntry removes entry from DLQ stream", async () => {
      const client = redis.getClient();
      client.xdel.mockResolvedValue(1);

      const result = await service.discardDlqEntry("1-0");

      expect(client.xdel).toHaveBeenCalledWith("stream:events:dlq", "1-0");
      expect(result.discarded).toBe("1-0");
    });

    it("discardDlqEntry throws BadRequestException when entry not found", async () => {
      const client = redis.getClient();
      client.xdel.mockResolvedValue(0); // 0 deleted = not found

      await expect(service.discardDlqEntry("nonexistent")).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.discardDlqEntry("nonexistent"),
      ).rejects.toMatchObject({
        response: {
          code: "DLQ_ENTRY_NOT_FOUND",
          message: expect.stringContaining("nonexistent"),
        },
      });
    });
  });
});
