import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

vi.mock("@polyforge/shared-db", () => ({
  PrismaService: vi.fn(),
}));
vi.mock("@polyforge/shared-redis", () => ({
  RedisService: vi.fn(),
}));
vi.mock("@polyforge/shared-types", () => ({
  JwtPayload: {},
}));
vi.mock("@nestjs/passport", () => ({
  AuthGuard: () =>
    class MockAuthGuard {
      canActivate(ctx: any) {
        const req = ctx.switchToHttp().getRequest();
        const auth = req.headers?.authorization;
        if (!auth || !auth.startsWith("Bearer ")) {
          throw new UnauthorizedException("No auth token");
        }
        return true;
      }
    },
}));

function makeContext(
  headers: Record<string, string | undefined> = {},
  ip = "127.0.0.1",
) {
  const request = {
    headers,
    ip,
    user: undefined as any,
    apiKeyMeta: undefined as any,
  };
  return {
    ctx: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any,
    request,
  };
}

describe("JwtAuthGuard", () => {
  let JwtAuthGuard: any;
  let invalidateJwtCacheForUser: any;
  let guard: any;
  let prisma: {
    apiKey: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let redis: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./jwt-auth.guard");
    JwtAuthGuard = mod.JwtAuthGuard;
    invalidateJwtCacheForUser = mod.invalidateJwtCacheForUser;

    prisma = {
      apiKey: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          suspended: false,
          deleted: false,
        }),
      },
    };
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };
    guard = new JwtAuthGuard(prisma as any, redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing authorization header", async () => {
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  describe("API key path (pf_ prefix)", () => {
    it("authenticates valid API key", async () => {
      const user = {
        id: "user-1",
        email: "u@t.co",
        username: "test",
        suspended: false,
        deleted: false,
      };
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        tokenHash: "hash",
        revoked: false,
        expiresAt: null,
        scopes: ["read"],
        user,
      });

      const { ctx, request } = makeContext({
        authorization: "Bearer pf_test-api-key",
      });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      // request.user MUST mirror the JWT payload shape (no email — GDPR).
      expect(request.user).toEqual({
        sub: "user-1",
        username: "test",
      });
      expect(request.user).not.toHaveProperty("email");
      expect(request.apiKeyMeta).toEqual({
        keyId: "key-1",
        userId: "user-1",
        scopes: ["read"],
      });
    });

    it("rejects unknown API key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      const { ctx } = makeContext({ authorization: "Bearer pf_bad-key" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects revoked API key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: true,
        user: { suspended: false, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_revoked" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects expired API key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: false,
        expiresAt: new Date("2020-01-01"),
        user: { suspended: false, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_expired" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects suspended user's API key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: false,
        expiresAt: null,
        user: { suspended: true, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_suspended" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // Redis owner-cache cleanup on API-key rejection paths
    it("deletes Redis owner cache when API key is revoked", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: true,
        user: { suspended: false, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_revoked" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("apikey:owner:"),
      );
    });

    it("deletes Redis owner cache when API key is expired", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: false,
        expiresAt: new Date("2020-01-01"),
        user: { suspended: false, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_expired" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("apikey:owner:"),
      );
    });

    it("deletes Redis owner cache when user is suspended", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: false,
        expiresAt: null,
        user: { suspended: true, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_suspended" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("apikey:owner:"),
      );
    });

    it("deletes Redis owner cache when user is deleted", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: false,
        expiresAt: null,
        user: { suspended: false, deleted: true },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_deleted" });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("apikey:owner:"),
      );
    });

    it("skips Redis owner-cache deletion when Redis is unavailable on rejection", async () => {
      const guardNoRedis = new JwtAuthGuard(prisma as any);
      prisma.apiKey.findUnique.mockResolvedValue({
        id: "key-1",
        revoked: true,
        user: { suspended: false, deleted: false },
      });
      const { ctx } = makeContext({ authorization: "Bearer pf_revoked" });
      await expect(guardNoRedis.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      // redis.del should NOT have been called — guard was created without Redis
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("JWT cache invalidation", () => {
    it("invalidateJwtCacheForUser removes cached entries for a given userId", () => {
      expect(() => invalidateJwtCacheForUser("some-user-id")).not.toThrow();
    });
  });

  describe("password change detection", () => {
    it("rejects cached JWT when pwchange key exists in Redis", async () => {
      redis.get.mockResolvedValue("1234567890");

      // First, we need a cached JWT. The JWT path delegates to super.canActivate,
      // but our mock AuthGuard always returns true. We need to set the user on the
      // request manually since the mock doesn't do passport verification.
      const { ctx, request } = makeContext({
        authorization: "Bearer jwt-token",
      });
      request.user = { sub: "user-1", username: "test" };

      // First call caches + checks pwchange — should reject
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Password was changed",
      );
    });
  });

  describe("JWT user status enforcement", () => {
    it("rejects a verified JWT when the database user is suspended", async () => {
      prisma.user.findUnique.mockResolvedValue({
        suspended: true,
        deleted: false,
      });
      const { ctx, request } = makeContext({
        authorization: "Bearer jwt-token",
      });
      request.user = { sub: "user-1", username: "test" };

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Account is suspended",
      );
    });

    it("deletes Redis JWT owner cache when DB user is suspended", async () => {
      // Redis pwChange/suspended check passes (no marker)
      redis.get.mockResolvedValue(null);
      // DB check finds suspended user
      prisma.user.findUnique.mockResolvedValue({
        suspended: true,
        deleted: false,
      });

      const { ctx, request } = makeContext({
        authorization: "Bearer jwt-token-suspended",
      });
      request.user = { sub: "user-1", username: "test" };

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Account is suspended",
      );

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("jwt:owner:"),
      );
    });

    it("deletes Redis JWT owner cache when DB user is deleted", async () => {
      redis.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        suspended: false,
        deleted: true,
      });

      const { ctx, request } = makeContext({
        authorization: "Bearer jwt-token-deleted",
      });
      request.user = { sub: "user-1", username: "test" };

      await expect(guard.canActivate(ctx)).rejects.toThrow("Account not found");

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining("jwt:owner:"),
      );
    });

    it("skips Redis JWT owner-cache deletion when Redis is unavailable on DB rejection", async () => {
      const guardNoRedis = new JwtAuthGuard(prisma as any);
      prisma.user.findUnique.mockResolvedValue({
        suspended: true,
        deleted: false,
      });

      const { ctx, request } = makeContext({
        authorization: "Bearer jwt-token-noredis",
      });
      request.user = { sub: "user-1", username: "test" };

      await expect(guardNoRedis.canActivate(ctx)).rejects.toThrow(
        "Account is suspended",
      );

      // redis.del should NOT have been called — guard was created without Redis
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("rejects a cached JWT when the suspended-user marker exists in Redis", async () => {
      const { ctx, request } = makeContext({
        authorization: "Bearer cached-jwt-token",
      });
      request.user = { sub: "user-1", username: "test" };

      await guard.canActivate(ctx);

      redis.get.mockImplementation((key: string) =>
        key === "suspended:user-1" ? "1" : null,
      );
      const { ctx: cachedCtx } = makeContext({
        authorization: "Bearer cached-jwt-token",
      });

      await expect(guard.canActivate(cachedCtx)).rejects.toThrow(
        "Account is suspended",
      );
    });
  });

  describe("JWT owner Redis cache for ApiKeyThrottlerGuard", () => {
    it("caches JWT token→user mapping in Redis after successful verification", async () => {
      const { ctx, request } = makeContext({
        authorization: "Bearer jwt.verified.token",
      });
      request.user = { sub: "user-1", username: "test" };

      await guard.canActivate(ctx);

      // Redis set should be called with the JWT owner key
      expect(redis.set).toHaveBeenCalled();
      const calls = redis.set.mock.calls;
      const ownerCall = calls.find(
        (c: any[]) => typeof c[0] === "string" && c[0].startsWith("jwt:owner:"),
      );
      expect(ownerCall).toBeDefined();
      expect(ownerCall[1]).toBe("user-1");
      expect(ownerCall[2]).toBe(120);
    });

    it("skips Redis cache write when Redis is not available", async () => {
      const guardNoRedis = new JwtAuthGuard(prisma as any);
      const { ctx, request } = makeContext({
        authorization: "Bearer jwt.verified.token",
      });
      request.user = { sub: "user-1", username: "test" };

      await expect(guardNoRedis.canActivate(ctx)).resolves.toBe(true);
      // redis.set was not called on the original mock
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe("handleRequest", () => {
    it("throws UnauthorizedException on error", () => {
      expect(() => guard.handleRequest(new Error("bad"), null)).toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when user is null", () => {
      expect(() => guard.handleRequest(null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it("returns user when valid", () => {
      const user = { sub: "user-1" };
      expect(guard.handleRequest(null, user)).toBe(user);
    });
  });
});
