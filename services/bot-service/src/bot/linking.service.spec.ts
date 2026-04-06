import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Set required env vars before importing the module (top-level checks)
process.env.BOT_JWT_SECRET = "test-bot-jwt-secret-for-linking-service";

import { LinkingService } from "./linking.service";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    botConnection: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function makeRedisMock() {
  return {
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  } as any;
}

function makeJwtMock() {
  return {
    sign: vi.fn().mockReturnValue("mock-bot-jwt-token"),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LinkingService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let jwt: ReturnType<typeof makeJwtMock>;
  let svc: LinkingService;

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    jwt = makeJwtMock();
    const config = { getOrThrow: vi.fn((key: string) => `test-${key}`) } as any;
    svc = new LinkingService(prisma, redis, jwt, config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getUserId ──────────────────────────────────────────────────────────

  describe("getUserId", () => {
    it("returns userId when an active connection exists", async () => {
      prisma.botConnection.findFirst.mockResolvedValue({
        userId: "user-123",
      });

      const result = await svc.getUserId("TELEGRAM", "chat-456");
      expect(result).toBe("user-123");
      expect(prisma.botConnection.findFirst).toHaveBeenCalledWith({
        where: { channel: "TELEGRAM", chatId: "chat-456", active: true },
        select: { userId: true },
      });
    });

    it("returns null when no active connection exists", async () => {
      prisma.botConnection.findFirst.mockResolvedValue(null);
      const result = await svc.getUserId("DISCORD", "ch-789");
      expect(result).toBeNull();
    });

    it("returns null when connection exists but userId is undefined", async () => {
      prisma.botConnection.findFirst.mockResolvedValue({});
      const result = await svc.getUserId("TELEGRAM", "chat-1");
      expect(result).toBeNull();
    });
  });

  // ─── connect ──────────────────────────────────────────────────────────────

  describe("connect", () => {
    it("returns already-linked message when active connection exists", async () => {
      prisma.botConnection.findFirst.mockResolvedValue({
        userId: "user-old",
        active: true,
      });

      const result = await svc.connect("TELEGRAM", "chat-1", "123456");
      expect(result).toContain("already linked");
      // Should not consume the code
      expect(redis.get).not.toHaveBeenCalled();
    });

    it("returns invalid code message when Redis has no matching code", async () => {
      prisma.botConnection.findFirst.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);

      const result = await svc.connect("TELEGRAM", "chat-1", "999999");
      expect(result).toContain("Invalid or expired code");
    });

    it("successfully links account when valid code exists", async () => {
      prisma.botConnection.findFirst.mockResolvedValue(null);
      redis.get.mockResolvedValue("user-new");

      const result = await svc.connect("TELEGRAM", "chat-1", "123456");

      expect(result).toContain("Account linked successfully");

      // Should consume the code
      expect(redis.del).toHaveBeenCalledWith("bot:link:123456");

      // Should deactivate previous connections for this user+channel
      expect(prisma.botConnection.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-new", channel: "TELEGRAM" },
        data: { active: false },
      });

      // Should create a new connection
      expect(prisma.botConnection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-new",
          channel: "TELEGRAM",
          chatId: "chat-1",
          active: true,
          tokenHash: expect.any(String),
        }),
      });
    });

    it("signs a JWT with correct payload structure", async () => {
      prisma.botConnection.findFirst.mockResolvedValue(null);
      redis.get.mockResolvedValue("user-new");

      await svc.connect("DISCORD", "ch-1", "654321");

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: "user-new",
          jti: expect.any(String),
          role: "bot",
          channel: "discord",
          scopes: ["read:strategies", "read:pnl", "write:strategy:stop"],
        }),
        expect.objectContaining({
          expiresIn: "30d",
        }),
      );
    });

    it("stores SHA-256 hash of the JWT token", async () => {
      prisma.botConnection.findFirst.mockResolvedValue(null);
      redis.get.mockResolvedValue("user-new");
      jwt.sign.mockReturnValue("test-jwt-token");

      await svc.connect("TELEGRAM", "chat-1", "123456");

      const createCall = prisma.botConnection.create.mock.calls[0][0];
      // tokenHash should be a 64-char hex string (SHA-256)
      expect(createCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ─── disconnect ───────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("returns success message when connection is deactivated", async () => {
      prisma.botConnection.updateMany.mockResolvedValue({ count: 1 });

      const result = await svc.disconnect("TELEGRAM", "chat-1");
      expect(result).toContain("Account unlinked");
      expect(prisma.botConnection.updateMany).toHaveBeenCalledWith({
        where: { channel: "TELEGRAM", chatId: "chat-1", active: true },
        data: { active: false },
      });
    });

    it("returns no linked account message when nothing to deactivate", async () => {
      prisma.botConnection.updateMany.mockResolvedValue({ count: 0 });

      const result = await svc.disconnect("DISCORD", "ch-1");
      expect(result).toContain("No linked account found");
    });
  });
});
