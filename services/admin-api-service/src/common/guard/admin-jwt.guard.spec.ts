import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

vi.mock("@polyforge/shared-redis", () => ({
  RedisService: vi.fn(),
}));

vi.mock("@polyforge/shared-types", () => ({
  AdminJwtPayload: {},
}));

const TEST_SECRET = "a]3Fk9$mP!xR7vQ2wL8nJ4cY6bT0uH5s";

function makeConfig(secret?: string): ConfigService {
  return {
    get: vi.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
}

function makeContext(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        cookies,
        ip: "127.0.0.1",
      }),
    }),
  } as any;
}

describe("AdminJwtGuard (admin-api-service)", () => {
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let redis: { get: ReturnType<typeof vi.fn> };

  const validPayload = {
    sub: "admin-1",
    email: "admin@test.com",
    role: "ADMIN",
    sessionId: "sess-123",
  };

  beforeEach(async () => {
    vi.resetModules();

    jwtService = { verify: vi.fn().mockReturnValue(validPayload) };
    redis = { get: vi.fn().mockResolvedValue("admin-1") };
  });

  describe("lazy secret validation (request-time)", () => {
    it("does not throw at construction when ADMIN_JWT_SECRET is missing (lazy validation)", async () => {
      const mod = await import("./admin-jwt.guard");
      const Guard = mod.AdminJwtGuard;
      const config = makeConfig(undefined);

      expect(
        () => new Guard(jwtService as any, redis as any, config),
      ).not.toThrow();
    });

    it("does not throw at construction when ADMIN_JWT_SECRET is too short (lazy validation)", async () => {
      const mod = await import("./admin-jwt.guard");
      const Guard = mod.AdminJwtGuard;
      const config = makeConfig("short");

      expect(
        () => new Guard(jwtService as any, redis as any, config),
      ).not.toThrow();
    });

    it("throws UnauthorizedException at request time when ADMIN_JWT_SECRET is missing", async () => {
      const mod = await import("./admin-jwt.guard");
      const Guard = mod.AdminJwtGuard;
      const config = makeConfig(undefined);
      const g = new Guard(jwtService as any, redis as any, config);
      const ctx = makeContext({ authorization: "Bearer admin-token" });

      await expect(g.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException at request time when ADMIN_JWT_SECRET is too short", async () => {
      const mod = await import("./admin-jwt.guard");
      const Guard = mod.AdminJwtGuard;
      const config = makeConfig("short");
      const g = new Guard(jwtService as any, redis as any, config);
      const ctx = makeContext({ authorization: "Bearer admin-token" });

      await expect(g.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("canActivate", () => {
    let guard: any;
    let config: ConfigService;

    beforeEach(async () => {
      const mod = await import("./admin-jwt.guard");
      const Guard = mod.AdminJwtGuard;
      config = makeConfig(TEST_SECRET);
      guard = new Guard(jwtService as any, redis as any, config);
    });

    it("throws UnauthorizedException when no token is provided", async () => {
      const ctx = makeContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("accepts token from Authorization header", async () => {
      const ctx = makeContext({ authorization: "Bearer admin-token" });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith("admin-token", {
        secret: TEST_SECRET,
        algorithms: ["HS256"],
      });
    });

    it("accepts token from pf_admin_token cookie", async () => {
      const ctx = makeContext({}, { pf_admin_token: "cookie-token" });
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith("cookie-token", {
        secret: TEST_SECRET,
        algorithms: ["HS256"],
      });
    });

    it("prefers cookie over header", async () => {
      const ctx = makeContext(
        { authorization: "Bearer header-token" },
        { pf_admin_token: "cookie-token" },
      );
      await guard.canActivate(ctx);

      expect(jwtService.verify).toHaveBeenCalledWith("cookie-token", {
        secret: TEST_SECRET,
        algorithms: ["HS256"],
      });
    });

    it("throws UnauthorizedException when JWT verification fails", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("invalid");
      });
      const ctx = makeContext({ authorization: "Bearer bad-token" });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when admin session is expired in Redis", async () => {
      redis.get.mockResolvedValue(null);
      const ctx = makeContext({ authorization: "Bearer valid-token" });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("sets request.admin with verified payload", async () => {
      const request = {
        headers: { authorization: "Bearer admin-token" },
        cookies: {},
        ip: "127.0.0.1",
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any;

      await guard.canActivate(ctx);

      expect(request).toHaveProperty("admin", validPayload);
    });

    it("checks Redis session key with correct format", async () => {
      const ctx = makeContext({ authorization: "Bearer admin-token" });
      await guard.canActivate(ctx);

      expect(redis.get).toHaveBeenCalledWith("admin:session:sess-123");
    });

    it("caches JWT verification (does not re-verify same token)", async () => {
      const ctx = makeContext({ authorization: "Bearer admin-token" });

      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      expect(jwtService.verify).toHaveBeenCalledTimes(1);
    });

    it("sets request.adminIp from x-forwarded-for header", async () => {
      const request = {
        headers: {
          authorization: "Bearer admin-token",
          "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        },
        cookies: {},
        ip: "127.0.0.1",
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any;

      await guard.canActivate(ctx);

      expect((request as any).adminIp).toBe("10.0.0.1");
    });

    it("uses request.ip when x-forwarded-for is absent", async () => {
      const request = {
        headers: { authorization: "Bearer admin-token" },
        cookies: {},
        ip: "192.168.1.1",
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any;

      await guard.canActivate(ctx);

      expect((request as any).adminIp).toBe("192.168.1.1");
    });

    it("invalidates JWT cache after key rotation on same guard instance", async () => {
      const ROTATED_SECRET = "b]4Gl0$nQ!yS8wR3xM9oK5dZ7cU1vI6t";
      const ctx = makeContext({ authorization: "Bearer admin-token" });

      await guard.canActivate(ctx);
      expect(jwtService.verify).toHaveBeenCalledTimes(1);

      (config.get as ReturnType<typeof vi.fn>).mockReturnValue(ROTATED_SECRET);

      jwtService.verify.mockReturnValue(validPayload);
      await guard.canActivate(ctx);

      expect(jwtService.verify).toHaveBeenCalledTimes(2);
    });
  });
});
