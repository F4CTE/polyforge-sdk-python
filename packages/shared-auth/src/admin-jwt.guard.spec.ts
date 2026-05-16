import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

vi.mock("@polyforge/shared-redis", () => ({
  RedisService: vi.fn(),
}));
vi.mock("@polyforge/shared-types", () => ({
  AdminJwtPayload: {},
}));

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

const TEST_SECRET = "a]3Fk9$mP!xR7vQ2wL8nJ4cY6bT0uH5s";

describe("AdminJwtGuard", () => {
  let AdminJwtGuard: any;
  let guard: any;
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let redis: { get: ReturnType<typeof vi.fn> };

  const validPayload = {
    sub: "admin-1",
    email: "admin@test.com",
    role: "ADMIN",
    sessionId: "sess-123",
  };

  beforeEach(async () => {
    process.env.ADMIN_JWT_SECRET = TEST_SECRET;
    vi.resetModules();
    const mod = await import("./admin-jwt.guard");
    AdminJwtGuard = mod.AdminJwtGuard;

    jwtService = { verify: vi.fn().mockReturnValue(validPayload) };
    redis = { get: vi.fn().mockResolvedValue("admin-1") };
    guard = new AdminJwtGuard(jwtService as any, redis as any);
  });

  afterEach(() => {
    process.env.ADMIN_JWT_SECRET = TEST_SECRET;
  });

  it("does not throw at construction when ADMIN_JWT_SECRET is missing (lazy validation)", () => {
    delete process.env.ADMIN_JWT_SECRET;
    vi.resetModules();
    // Construction succeeds — validation is deferred to request time
    expect(
      () => new AdminJwtGuard(jwtService as any, redis as any),
    ).not.toThrow();
  });

  it("throws UnauthorizedException at request time when ADMIN_JWT_SECRET is missing", async () => {
    delete process.env.ADMIN_JWT_SECRET;
    vi.resetModules();
    const mod = await import("./admin-jwt.guard");
    const Guard = mod.AdminJwtGuard;
    const g = new Guard(jwtService as any, redis as any);
    const ctx = makeContext({ authorization: "Bearer admin-token" });
    await expect(g.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException at request time when ADMIN_JWT_SECRET is too short", async () => {
    process.env.ADMIN_JWT_SECRET = "short";
    vi.resetModules();
    const mod = await import("./admin-jwt.guard");
    const Guard = mod.AdminJwtGuard;
    const g = new Guard(jwtService as any, redis as any);
    const ctx = makeContext({ authorization: "Bearer admin-token" });
    await expect(g.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when no token is provided", async () => {
    const ctx = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
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

  it("throws when JWT verification fails", async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error("invalid");
    });
    const ctx = makeContext({ authorization: "Bearer bad-token" });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when admin session is expired in Redis", async () => {
    redis.get.mockResolvedValue(null);
    const ctx = makeContext({ authorization: "Bearer valid-token" });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
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

  it("invalidates JWT cache after key rotation on same guard instance", async () => {
    const ROTATED_SECRET = "b]4Gl0$nQ!yS8wR3xM9oK5dZ7cU1vI6t";
    const ctx = makeContext({ authorization: "Bearer admin-token" });

    await guard.canActivate(ctx);
    expect(jwtService.verify).toHaveBeenCalledTimes(1);

    process.env.ADMIN_JWT_SECRET = ROTATED_SECRET;

    jwtService.verify.mockReturnValue(validPayload);
    await guard.canActivate(ctx);

    expect(jwtService.verify).toHaveBeenCalledTimes(2);
  });
});
