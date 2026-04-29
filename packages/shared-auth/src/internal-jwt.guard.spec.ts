import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

vi.mock("@polyforge/shared-redis", () => ({
  RedisService: vi.fn(),
}));
vi.mock("@polyforge/shared-types", () => ({
  InternalJwtPayload: {},
}));

const TEST_SECRET = "a]3Fk9$mP!xR7vQ2wL8nJ4cY6bT0uH5s";

function makeContext(headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as any;
}

describe("InternalJwtGuard", () => {
  let InternalJwtGuard: any;
  let guard: any;
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let redis: {
    exists: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  const validPayload = {
    sub: "api-service",
    iss: "api-service",
    aud: "api-service",
    service: "api-service",
    jti: "unique-token-id",
    iat: 1000,
    exp: 1030,
  };

  beforeEach(async () => {
    process.env.INTERNAL_JWT_SECRET = TEST_SECRET;
    process.env.INTERNAL_JWT_AUDIENCE = "api-service";
    process.env.INTERNAL_JWT_ISSUERS = "api-service,auth-service";
    vi.resetModules();
    const mod = await import("./internal-jwt.guard");
    InternalJwtGuard = mod.InternalJwtGuard;

    jwtService = { verify: vi.fn().mockReturnValue(validPayload) };
    redis = {
      exists: vi.fn().mockResolvedValue(0),
      set: vi.fn().mockResolvedValue("OK"),
    };
    guard = new InternalJwtGuard(jwtService as any, redis as any);
  });

  afterEach(() => {
    process.env.INTERNAL_JWT_SECRET = TEST_SECRET;
    delete process.env.INTERNAL_JWT_AUDIENCE;
    delete process.env.INTERNAL_JWT_ISSUERS;
  });

  it("throws at construction when INTERNAL_JWT_SECRET is missing", async () => {
    delete process.env.INTERNAL_JWT_SECRET;
    vi.resetModules();
    const mod = await import("./internal-jwt.guard");
    expect(
      () => new mod.InternalJwtGuard(jwtService as any, redis as any),
    ).toThrow("INTERNAL_JWT_SECRET environment variable is required");
  });

  it("throws at construction when secret is too short", async () => {
    process.env.INTERNAL_JWT_SECRET = "short";
    vi.resetModules();
    const mod = await import("./internal-jwt.guard");
    expect(
      () => new mod.InternalJwtGuard(jwtService as any, redis as any),
    ).toThrow("INTERNAL_JWT_SECRET must be at least 32 characters");
  });

  it("rejects requests without Authorization header", async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects requests with non-Bearer authorization", async () => {
    const ctx = makeContext({ authorization: "Basic abc123" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("verifies token with audience, issuer, and HS256", async () => {
    const ctx = makeContext({ authorization: "Bearer valid-token" });
    await guard.canActivate(ctx);

    expect(jwtService.verify).toHaveBeenCalledWith("valid-token", {
      secret: TEST_SECRET,
      audience: "api-service",
      issuer: ["api-service", "auth-service"],
      algorithms: ["HS256"],
    });
  });

  it("rejects a real internal token issued for a different audience", async () => {
    const realJwtService = new JwtService();
    const token = realJwtService.sign(
      { sub: "api-service", service: "api-service", jti: "wrong-audience" },
      {
        secret: TEST_SECRET,
        algorithm: "HS256",
        audience: "signer-service",
        issuer: "api-service",
        expiresIn: "30s",
      },
    );
    guard = new InternalJwtGuard(realJwtService as any, redis as any);

    const ctx = makeContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects tokens with missing iss claim", async () => {
    jwtService.verify.mockReturnValue({ ...validPayload, iss: undefined });
    const ctx = makeContext({ authorization: "Bearer no-iss-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects replayed jti (already seen)", async () => {
    redis.exists.mockResolvedValue(1);
    const ctx = makeContext({ authorization: "Bearer valid-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("marks jti as used in Redis with 60s TTL", async () => {
    const ctx = makeContext({ authorization: "Bearer valid-token" });
    await guard.canActivate(ctx);

    expect(redis.set).toHaveBeenCalledWith("jti:unique-token-id", "1", 60);
  });

  it("sets servicePayload on request", async () => {
    const request = { headers: { authorization: "Bearer valid-token" } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    await guard.canActivate(ctx);

    expect(request).toHaveProperty("servicePayload", validPayload);
  });

  it("rejects when JWT verification fails", async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error("expired");
    });
    const ctx = makeContext({ authorization: "Bearer bad-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
