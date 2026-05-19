import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HttpStatus, NotFoundException } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { UsersService } from "./users.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "alice@example.com",
    username: "alice",
    displayName: "Alice",
    emailVerified: true,
    polymarketConnected: false,
    suspended: false,
    suspendedReason: null,
    deleted: false,
    passwordHash: "$2b$12$hashed",
    totpSecret: null,
    totpBackupCodes: null,
    createdAt: new Date("2024-01-01"),
    lastSeen: new Date("2024-06-01"),
    limits: null,
    loginHistory: [],
    strategies: [],
    _count: { orders: 0, positions: 0, strategies: 0 },
    ...overrides,
  };
}

function makePrisma() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    userLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    apiKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    strategy: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("UsersService", () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: any;
  let redisClient: any;
  let redisPipeline: any;
  let refreshKeys: string[];
  let config: any;
  let jwt: any;

  beforeEach(() => {
    prisma = makePrisma();
    refreshKeys = [];
    redisPipeline = {
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    redisClient = {
      del: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn().mockReturnValue(redisPipeline),
      scanStream: vi.fn().mockImplementation(() => {
        const stream = new EventEmitter();
        queueMicrotask(() => {
          stream.emit("data", refreshKeys);
          stream.emit("end");
        });
        return stream;
      }),
    };
    redis = {
      getClient: vi.fn().mockReturnValue(redisClient),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(1),
      xadd: vi.fn().mockResolvedValue("1-0"),
    };
    config = {
      get: vi.fn().mockReturnValue("http://strategy-engine"),
      getOrThrow: vi.fn().mockReturnValue("internal-secret"),
    };
    jwt = { sign: vi.fn(() => `token-${jwt.sign.mock.calls.length}`) };
    service = new UsersService(prisma as any, {} as any, redis, config, jwt);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, text: vi.fn() }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated user list with correct shape", async () => {
      const users = [
        makeUser(),
        makeUser({ id: "user-2", email: "bob@example.com", username: "bob" }),
      ];
      prisma.user.findMany.mockResolvedValue(users as any);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("calculates pages correctly for partial last page", async () => {
      prisma.user.findMany.mockResolvedValue([makeUser()] as any);
      prisma.user.count.mockResolvedValue(11);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.pages).toBe(2);
    });

    it("passes search filter as OR on email and username", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, search: "ali" });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR[0].email.contains).toBe("ali");
      expect(call.where.OR[1].username.contains).toBe("ali");
    });

    it("includes suspended filter when provided", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, suspended: true });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.suspended).toBe(true);
    });

    it("omits suspended filter when not provided", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.suspended).toBeUndefined();
    });

    it("always filters deleted:false", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.deleted).toBe(false);
    });

    it("applies correct skip offset for page 3", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 5 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10);
      expect(call.take).toBe(5);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns user without sensitive fields", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findOne("user-1");

      expect(result.id).toBe("user-1");
      expect(result.email).toBe("alice@example.com");
      expect(result.passwordHash).toBeUndefined();
      expect(result.totpSecret).toBeUndefined();
      expect(result.totpBackupCodes).toBeUndefined();
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("includes code NOT_FOUND in the exception", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("calls findUnique with include on limits, loginHistory, strategies", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);

      await service.findOne("user-1");

      const call = prisma.user.findUnique.mock.calls[0][0];
      expect(call.include.limits).toBeDefined();
      expect(call.include.loginHistory).toBeDefined();
      expect(call.include.strategies).toBeDefined();
    });
  });

  // ── suspend ───────────────────────────────────────────────────────────────

  describe("suspend", () => {
    it("suspends an active user and returns suspension receipt", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "Violation",
      } as any);

      const result = await service.suspend("user-1", { reason: "Violation" });

      expect(result.suspended).toBe(true);
      expect(result.reason).toBe("Violation");
      expect(result.suspendedAt).toBeDefined();
    });

    it("passes reason to update call", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "TOS breach",
      } as any);

      await service.suspend("user-1", { reason: "TOS breach" });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suspended: true,
            suspendedReason: "TOS breach",
          }),
        }),
      );
    });

    it("replays suspend enforcement when user is already suspended", async () => {
      const user = makeUser({ suspended: true });
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.suspend("user-1", { reason: "again" });

      expect(result.suspended).toBe(true);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.apiKey.updateMany).toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({ type: "USER_SUSPENDED", userId: "user-1" }),
      );
    });

    it("sets a suspended-user marker so existing access JWTs are rejected immediately", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "Violation",
      } as any);

      await service.suspend("user-1", { reason: "Violation" });

      expect(redis.set).toHaveBeenCalledWith(
        "suspended:user-1",
        expect.any(String),
      );
    });

    it("revokes token-specific refresh keys and their reverse lookup keys", async () => {
      refreshKeys = ["refresh:user-1:hash-a", "refresh:user-1:hash-b"];
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "Violation",
      } as any);

      await service.suspend("user-1", { reason: "Violation" });

      expect(redisClient.scanStream).toHaveBeenCalledWith({
        match: "refresh:user-1:*",
        count: 100,
      });
      expect(redisPipeline.del).toHaveBeenCalledWith("refresh:user-1:hash-a");
      expect(redisPipeline.del).toHaveBeenCalledWith("refresh_lookup:hash-a");
      expect(redisPipeline.del).toHaveBeenCalledWith("refresh:user-1:hash-b");
      expect(redisPipeline.del).toHaveBeenCalledWith("refresh_lookup:hash-b");
      expect(redisPipeline.exec).toHaveBeenCalledOnce();
      expect(redisClient.del).not.toHaveBeenCalledWith("refresh:user-1");
    });

    it("mints a fresh internal JWT for each active strategy runner stop", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "Violation",
      } as any);
      prisma.strategy.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

      await service.suspend("user-1", { reason: "Violation" });

      expect(jwt.sign).toHaveBeenCalledTimes(2);
      const fetchCalls = vi.mocked(fetch).mock.calls;
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0][1]?.headers).not.toEqual(fetchCalls[1][1]?.headers);
      expect(prisma.strategy.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["s1", "s2"] } },
        data: { status: "IDLE" },
      });
    });

    it("publishes cancellable orders without marking them cancelled in admin-api", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "Violation",
      } as any);
      prisma.order.findMany.mockResolvedValue([
        { id: "o1", clobOrderId: "c1", venueOrderId: null },
      ]);

      await service.suspend("user-1", { reason: "Violation" });

      expect(redis.xadd).toHaveBeenCalledWith("stream:cancellations", {
        orderId: "o1",
        userId: "user-1",
        clobOrderId: "c1",
      });
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspend("ghost", { reason: "test" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NOT_FOUND when user is soft-deleted", async () => {
      const user = makeUser({ deleted: true });
      prisma.user.findUnique.mockResolvedValue(user as any);

      await expect(
        service.suspend("user-1", { reason: "test" }),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("rolls back the suspended marker when a side-effect fails", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.strategy.findMany.mockResolvedValue([{ id: "s1" }]);
      (fetch as any).mockRejectedValueOnce(new Error("strategy engine down"));

      await expect(
        service.suspend("user-1", { reason: "test" }),
      ).rejects.toThrow("strategy engine down");

      // The suspended marker must be deleted so the user is not
      // permanently blocked by a failed suspend request.
      expect(redis.del).toHaveBeenCalledWith("suspended:user-1");
      // The DB row must NOT be updated to suspended: true
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── unsuspend ─────────────────────────────────────────────────────────────

  describe("unsuspend", () => {
    it("unsuspends a user and returns { suspended: false }", async () => {
      const user = makeUser({ suspended: true });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: false,
        suspendedReason: null,
      } as any);

      const result = await service.unsuspend("user-1");

      expect(result).toEqual({ suspended: false });
    });

    it("clears suspendedReason on unsuspend", async () => {
      const user = makeUser({ suspended: true, suspendedReason: "Was bad" });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: false,
        suspendedReason: null,
      } as any);

      await service.unsuspend("user-1");

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { suspended: false, suspendedReason: null },
        }),
      );
    });

    it("clears the suspended-user marker on unsuspend", async () => {
      const user = makeUser({ suspended: true });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: false,
        suspendedReason: null,
      } as any);

      await service.unsuspend("user-1");

      expect(redis.del).toHaveBeenCalledWith("suspended:user-1");
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.unsuspend("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateLimits ──────────────────────────────────────────────────────────

  describe("updateLimits", () => {
    it("upserts and returns limits for a valid user", async () => {
      const user = makeUser();
      const limits = {
        userId: "user-1",
        maxRunningStrategies: 5,
        maxOrdersPerDay: 100,
      };
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.userLimit.upsert.mockResolvedValue(limits as any);

      const dto = { maxRunningStrategies: 5, maxOrdersPerDay: 100 };
      const result = await service.updateLimits("user-1", dto);

      expect(result).toEqual(limits);
    });

    it("passes userId as create key in upsert", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.userLimit.upsert.mockResolvedValue({} as any);

      const dto = { maxRunningStrategies: 3 };
      await service.updateLimits("user-1", dto);

      const call = prisma.userLimit.upsert.mock.calls[0][0];
      expect(call.where.userId).toBe("user-1");
      expect(call.create.userId).toBe("user-1");
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateLimits("ghost", {})).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── getRiskSettings ────────────────────────────────────────────────────────

  describe("getRiskSettings", () => {
    it("returns mapped risk settings when limits exist", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.userLimit.findUnique.mockResolvedValue({
        userId: "user-1",
        maxRunningStrategies: 3,
        maxOrdersPerDay: 200,
        maxOrderSizeUsdc: "500.000000",
        maxBacktestRunsPerDay: 5,
        circuitBreakerErrors: 10,
        drawdownEnabled: true,
        drawdownLookbackHours: 12,
        drawdownThresholdPct: "0.0500",
        circuitBreakerTripped: false,
        circuitBreakerTrippedAt: null,
        updatedAt: new Date(),
      } as any);

      const result = await service.getRiskSettings("user-1");

      expect(result.enabled).toBe(true);
      expect(result.maxPositionSize).toBe(500);
      expect(result.maxOpenPositions).toBe(3);
      expect(result.maxOrdersPerDay).toBe(200);
      expect(result.drawdownThresholdPct).toBe(0.05);
      expect(result.circuitBreakerTripped).toBe(false);
    });

    it("returns defaults when no limits record exists", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.userLimit.findUnique.mockResolvedValue(null);

      const result = await service.getRiskSettings("user-1");

      expect(result.enabled).toBe(false);
      expect(result.maxPositionSize).toBe(1000);
      expect(result.maxOpenPositions).toBe(5);
      expect(result.maxOrdersPerDay).toBe(500);
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getRiskSettings("ghost")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── findUserOrFail (via public methods) ───────────────────────────────────

  describe("findUserOrFail (via public API)", () => {
    it("throws NOT_FOUND for nonexistent user id via suspend", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspend("nonexistent", { reason: "x" }),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NOT_FOUND for soft-deleted user via updateLimits", async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ deleted: true }) as any,
      );

      await expect(service.updateLimits("user-1", {})).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── listApiKeys ─────────────────────────────────────────────────────────────

  describe("listApiKeys", () => {
    it("returns keys for specified user", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);

      const keys = [
        {
          id: "key-1",
          name: "Bot Key",
          prefix: "pf_abcd",
          scopes: ["READ"],
          expiresAt: null,
          lastUsedAt: null,
          lastUsedIp: null,
          revoked: false,
          revokedAt: null,
          createdAt: new Date(),
        },
      ];
      prisma.apiKey.findMany.mockResolvedValue(keys as any);

      const result = await service.listApiKeys("user-1");

      expect(result).toEqual(keys);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("does not expose tokenHash in the select", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.apiKey.findMany.mockResolvedValue([] as any);

      await service.listApiKeys("user-1");

      const call = prisma.apiKey.findMany.mock.calls[0][0];
      expect(call.select.tokenHash).toBeUndefined();
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.listApiKeys("ghost")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NOT_FOUND for soft-deleted user", async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ deleted: true }) as any,
      );

      await expect(service.listApiKeys("user-1")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── revokeApiKey ────────────────────────────────────────────────────────────

  describe("revokeApiKey", () => {
    it("sets revoked=true and returns { revoked: true }", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        userId: "user-1",
        revoked: false,
      } as any);
      prisma.apiKey.update.mockResolvedValue({ revoked: true } as any);

      const result = await service.revokeApiKey("user-1", "key-1");

      expect(result).toEqual({ revoked: true });
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-1" },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });

    it("throws NOT_FOUND for unknown key id", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeApiKey("user-1", "nonexistent"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NOT_FOUND when key belongs to a different user", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        userId: "other-user",
        revoked: false,
      } as any);

      await expect(
        service.revokeApiKey("user-1", "key-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it("throws ALREADY_REVOKED (409) when key is already revoked", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        userId: "user-1",
        revoked: true,
      } as any);

      await expect(
        service.revokeApiKey("user-1", "key-1"),
      ).rejects.toMatchObject({
        response: { code: "ALREADY_REVOKED" },
        status: HttpStatus.CONFLICT,
      });

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeApiKey("ghost", "key-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });
});
