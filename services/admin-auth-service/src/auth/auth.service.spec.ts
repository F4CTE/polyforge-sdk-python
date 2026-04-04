import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HttpStatus } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { faker } from "@faker-js/faker";

// ─── Factories ────────────────────────────────────────────────────────────────

interface AdminLike {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string;
  role: string;
  active: boolean;
  totpEnabled: boolean;
  totpSecret: string | null;
  createdAt: Date;
}

async function adminFactory(
  overrides: Partial<AdminLike> = {},
): Promise<AdminLike> {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    displayName: faker.person.fullName(),
    passwordHash: await bcrypt.hash("Passw0rd!", 10),
    role: "SUPER_ADMIN",
    active: true,
    totpEnabled: false,
    totpSecret: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Mock otplib ──────────────────────────────────────────────────────────────

vi.mock("otplib", () => ({
  authenticator: {
    generateSecret: vi.fn().mockReturnValue("JBSWY3DPEHPK3PXP"),
    keyuri: vi
      .fn()
      .mockReturnValue(
        "otpauth://totp/Polyforge%20Admin:admin@test.com?secret=JBSWY3DPEHPK3PXP&issuer=Polyforge%20Admin",
      ),
    check: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
  },
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
}));

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("AdminAuthService", () => {
  let service: AuthService;
  let adminDb: any;
  let redis: any;
  let jwtService: any;
  let config: any;

  beforeEach(() => {
    adminDb = {
      admin: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    redis = {
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
    };
    jwtService = {
      sign: vi.fn().mockReturnValue("signed-admin-jwt"),
      verify: vi.fn(),
    };
    config = {
      getOrThrow: vi.fn().mockReturnValue("0".repeat(64)),
    };
    service = new AuthService(adminDb, redis, jwtService, config);
    // Manually call onModuleInit to set up encryption key
    service.onModuleInit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns a JWT and admin profile on valid credentials", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      const result = await service.login({
        email: admin.email,
        password: "Passw0rd!",
      });

      expect(result.token).toBe("signed-admin-jwt");
      expect(result.admin.id).toBe(admin.id);
      expect(result.admin.email).toBe(admin.email);
      expect(result.admin.role).toBe(admin.role);
    });

    it("stores a Redis session with 1-hour TTL", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await service.login({ email: admin.email, password: "Passw0rd!" });

      const [key, , ttl] = redis.set.mock.calls[0];
      expect(key).toMatch(/^admin:session:/);
      expect(ttl).toBe(3600);
    });

    it("includes the sessionId in the JWT payload", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await service.login({ email: admin.email, password: "Passw0rd!" });

      const jwtPayload = jwtService.sign.mock.calls[0][0];
      expect(jwtPayload.sessionId).toBeTruthy();
      expect(jwtPayload.sub).toBe(admin.id);
      expect(jwtPayload.email).toBe(admin.email);
      expect(jwtPayload.role).toBe(admin.role);
    });

    it("throws INVALID_CREDENTIALS (400) when admin does not exist", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "ghost@admin.com", password: "Passw0rd!" }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_CREDENTIALS" },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("throws INVALID_CREDENTIALS (400) when admin is inactive", async () => {
      const admin = await adminFactory({ active: false });
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await expect(
        service.login({ email: admin.email, password: "Passw0rd!" }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_CREDENTIALS" },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("throws INVALID_CREDENTIALS (400) on wrong password", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await expect(
        service.login({ email: admin.email, password: "WrongPass1!" }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_CREDENTIALS" },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("throws TOTP_REQUIRED (403) when admin has TOTP enabled but no code provided", async () => {
      const admin = await adminFactory({
        totpEnabled: true,
        totpSecret: "encrypted:secret",
      });
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await expect(
        service.login({ email: admin.email, password: "Passw0rd!" }),
      ).rejects.toMatchObject({
        response: { code: "TOTP_REQUIRED" },
        status: HttpStatus.FORBIDDEN,
      });
    });

    it("throws TOTP_INVALID (400) when admin TOTP code is wrong", async () => {
      const otplib = await import("otplib");
      const authenticator = (otplib as any).authenticator;
      vi.mocked(authenticator.check).mockReturnValueOnce(false);

      const admin = await adminFactory({
        totpEnabled: true,
        totpSecret: "encrypted:secret",
      });
      adminDb.admin.findUnique.mockResolvedValue(admin);

      // Add getClient mock for the lockout counter
      const incrMock = vi.fn().mockResolvedValue(1);
      const expireMock = vi.fn().mockResolvedValue(1);
      redis.getClient = vi
        .fn()
        .mockReturnValue({ incr: incrMock, expire: expireMock });

      // Spy on decrypt to return a valid secret string
      vi.spyOn(service as any, "decrypt").mockReturnValue("JBSWY3DPEHPK3PXP");

      await expect(
        service.login({
          email: admin.email,
          password: "Passw0rd!",
          totpCode: "000000",
        }),
      ).rejects.toMatchObject({
        response: { code: "TOTP_INVALID" },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("never exposes passwordHash in the response", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      const result = await service.login({
        email: admin.email,
        password: "Passw0rd!",
      });
      expect(JSON.stringify(result)).not.toContain("passwordHash");
      expect(JSON.stringify(result)).not.toContain("$2b$");
    });

    it("uses a unique sessionId on every login", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await service.login({ email: admin.email, password: "Passw0rd!" });
      await service.login({ email: admin.email, password: "Passw0rd!" });

      const session1 = redis.set.mock.calls[0][0] as string;
      const session2 = redis.set.mock.calls[1][0] as string;
      expect(session1).not.toBe(session2);
    });
  });

  // ── TOTP Setup ─────────────────────────────────────────────────────────────

  describe("setupTotp", () => {
    it("returns secret, uri, and qrCode for an active admin", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      const result = await service.setupTotp(admin.id);

      expect(result).toHaveProperty("secret");
      expect(result).toHaveProperty("uri");
      expect(result).toHaveProperty("qrCode");
    });

    it("stores pending secret in Redis with 5-minute TTL", async () => {
      const admin = await adminFactory();
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await service.setupTotp(admin.id);

      expect(redis.set).toHaveBeenCalledWith(
        `totp:pending:admin:${admin.id}`,
        expect.any(String),
        300,
      );
    });

    it("throws ADMIN_NOT_FOUND (404) when admin does not exist", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);

      await expect(service.setupTotp("nonexistent")).rejects.toMatchObject({
        response: { code: "ADMIN_NOT_FOUND" },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("throws TOTP_ALREADY_ENABLED (409) when TOTP is already enabled", async () => {
      const admin = await adminFactory({ totpEnabled: true });
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await expect(service.setupTotp(admin.id)).rejects.toMatchObject({
        response: { code: "TOTP_ALREADY_ENABLED" },
        status: HttpStatus.CONFLICT,
      });
    });
  });

  // ── TOTP Confirm ───────────────────────────────────────────────────────────

  describe("confirmTotp", () => {
    it("enables TOTP and updates admin record on valid code", async () => {
      const adminId = faker.string.uuid();
      redis.get.mockResolvedValue("JBSWY3DPEHPK3PXP");

      const result = await service.confirmTotp(adminId, "123456");

      expect(result).toEqual({ enabled: true });
      expect(adminDb.admin.update).toHaveBeenCalledWith({
        where: { id: adminId },
        data: expect.objectContaining({
          totpEnabled: true,
          totpSecret: expect.any(String),
        }),
      });
      expect(redis.del).toHaveBeenCalledWith(`totp:pending:admin:${adminId}`);
    });

    it("throws TOTP_SETUP_EXPIRED (400) when no pending secret exists", async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.confirmTotp("admin-1", "123456"),
      ).rejects.toMatchObject({
        response: { code: "TOTP_SETUP_EXPIRED" },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("throws TOTP_INVALID (400) when code is wrong", async () => {
      redis.get.mockResolvedValue("JBSWY3DPEHPK3PXP");

      // Override mock to return false for this test
      const otplib = await import("otplib");
      const authenticator = (otplib as any).authenticator;
      vi.mocked(authenticator.check).mockReturnValueOnce(false);

      await expect(
        service.confirmTotp("admin-1", "000000"),
      ).rejects.toMatchObject({
        response: { code: "TOTP_INVALID" },
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  // ── TOTP Disable ───────────────────────────────────────────────────────────

  describe("disableTotp", () => {
    it("clears TOTP fields on admin record", async () => {
      const admin = await adminFactory({
        totpEnabled: true,
        totpSecret: "encrypted",
      });
      adminDb.admin.findUnique.mockResolvedValue(admin);
      redis.get.mockResolvedValue("1"); // session is live

      // Mock the private decrypt method to return a valid secret
      vi.spyOn(service as any, "decrypt").mockReturnValue("JBSWY3DPEHPK3PXP");

      await service.disableTotp(admin.id, "test-session-id", "Passw0rd!", "123456");

      expect(adminDb.admin.update).toHaveBeenCalledWith({
        where: { id: admin.id },
        data: expect.objectContaining({
          totpEnabled: false,
          totpSecret: null,
        }),
      });
    });

    it("throws ADMIN_NOT_FOUND (404) when admin does not exist", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);

      redis.get.mockResolvedValue("1"); // session is live
      await expect(
        service.disableTotp("nonexistent", "test-session-id", "password", "000000"),
      ).rejects.toMatchObject({
        response: { code: "ADMIN_NOT_FOUND" },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("throws TOTP_NOT_ENABLED (400) when TOTP is not enabled", async () => {
      const admin = await adminFactory({ totpEnabled: false });
      adminDb.admin.findUnique.mockResolvedValue(admin);

      redis.get.mockResolvedValue("1"); // session is live
      await expect(
        service.disableTotp(admin.id, "test-session-id", "password", "000000"),
      ).rejects.toMatchObject({
        response: { code: "TOTP_NOT_ENABLED" },
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  // ── getMe ─────────────────────────────────────────────────────────────────

  describe("getMe", () => {
    it("returns admin profile when token and session are valid", async () => {
      const admin = await adminFactory();
      const sessionId = faker.string.uuid();
      jwtService.verify.mockReturnValue({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        sessionId,
      });
      redis.get.mockResolvedValue(admin.id);
      adminDb.admin.findUnique.mockResolvedValue(admin);

      const result = await service.getMe("valid-token");

      expect(result.id).toBe(admin.id);
      expect(result.email).toBe(admin.email);
      expect(result.role).toBe(admin.role);
      expect(result.displayName).toBe(admin.displayName);
    });

    it("throws UNAUTHORIZED (401) when JWT is invalid", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("invalid");
      });

      await expect(service.getMe("bad-token")).rejects.toMatchObject({
        response: { code: "UNAUTHORIZED" },
        status: 401,
      });
    });

    it("throws UNAUTHORIZED (401) when Redis session does not exist", async () => {
      const sessionId = faker.string.uuid();
      jwtService.verify.mockReturnValue({ sub: "admin-id", sessionId });
      redis.get.mockResolvedValue(null);

      await expect(service.getMe("token")).rejects.toMatchObject({
        response: { code: "SESSION_EXPIRED" },
        status: 401,
      });
    });

    it("throws ACCOUNT_INACTIVE (403) when admin is inactive", async () => {
      const admin = await adminFactory({ active: false });
      const sessionId = faker.string.uuid();
      jwtService.verify.mockReturnValue({ sub: admin.id, sessionId });
      redis.get.mockResolvedValue(admin.id);
      adminDb.admin.findUnique.mockResolvedValue(admin);

      await expect(service.getMe("token")).rejects.toMatchObject({
        response: { code: "ACCOUNT_INACTIVE" },
        status: 403,
      });
    });

    it("throws ACCOUNT_INACTIVE (403) when admin is not found", async () => {
      const sessionId = faker.string.uuid();
      jwtService.verify.mockReturnValue({
        sub: faker.string.uuid(),
        sessionId,
      });
      redis.get.mockResolvedValue("some-admin-id");
      adminDb.admin.findUnique.mockResolvedValue(null);

      await expect(service.getMe("token")).rejects.toMatchObject({
        response: { code: "ACCOUNT_INACTIVE" },
        status: 403,
      });
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("deletes the Redis session for a valid Bearer token", async () => {
      const sessionId = faker.string.uuid();
      jwtService.verify.mockReturnValue({
        sessionId,
        sub: "admin-id",
        email: "a@b.com",
      });

      await service.logout(`Bearer valid-token`);

      expect(redis.del).toHaveBeenCalledWith(`admin:session:${sessionId}`);
    });

    it("does nothing when no Authorization header is provided", async () => {
      await service.logout(undefined);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("does nothing when the header is not a Bearer token", async () => {
      await service.logout("Basic abc123");
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("silently ignores an expired or invalid JWT (already revoked)", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("Token expired");
      });

      await expect(
        service.logout("Bearer expired-token"),
      ).resolves.toBeUndefined();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  // ── encryption helpers ───────────────────────────────────────────────────────

  describe("encrypt / decrypt round-trip", () => {
    it("decrypts a value that was encrypted with the same key", () => {
      const plaintext = "JBSWY3DPEHPK3PXP";
      const encrypted = (service as any).encrypt(plaintext);
      const decrypted = (service as any).decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
