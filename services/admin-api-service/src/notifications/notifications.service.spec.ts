import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotificationsAdminService } from "./notifications.service";

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

      await expect(service.broadcast(dto as any)).rejects.toThrow(
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
});
