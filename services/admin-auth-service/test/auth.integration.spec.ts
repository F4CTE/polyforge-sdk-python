import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Global, Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import fastifyCookie from "@fastify/cookie";
import * as bcrypt from "bcrypt";
import { generateSecret, generateSync } from "otplib";
import { AuthModule } from "../src/auth/auth.module";
import { PrismaAdminService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import * as crypto from "crypto";

// ─── Fake implementations for infrastructure ──────────────────────────────────

interface AdminRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  role: string;
  active: boolean;
  totpEnabled: boolean;
  totpSecret: string | null;
  totpEnabledAt: Date | null;
  totpBackupCodes: string[];
  createdAt: Date;
}

class FakeRedisService {
  store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttl?: number): Promise<string> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  getClient() {
    const store = this.store;
    return {
      get: async (key: string) => store.get(key) ?? null,
      set: async (
        key: string,
        value: string,
        ...args: string[]
      ): Promise<string | null> => {
        const nxIdx = args.indexOf("NX");
        if (nxIdx >= 0 && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      },
      del: async (key: string) => {
        return store.delete(key) ? 1 : 0;
      },
      incr: async (key: string): Promise<number> => {
        const raw = store.get(key);
        const current = parseInt(raw ?? "0", 10);
        const next = current + 1;
        store.set(key, String(next));
        return next;
      },
      expire: async (_key: string, _seconds: number): Promise<number> => {
        return 1;
      },
    };
  }
}

class FakePrismaAdminService {
  admins = new Map<string, AdminRecord>();

  admin = {
    findUnique: async (args: {
      where: { id?: string; email?: string };
    }): Promise<AdminRecord | null> => {
      if (args.where.id) {
        return this.admins.get(args.where.id) ?? null;
      }
      if (args.where.email) {
        for (const admin of this.admins.values()) {
          if (admin.email === args.where.email) return admin;
        }
        return null;
      }
      return null;
    },

    update: async (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<AdminRecord> => {
      const admin = this.admins.get(args.where.id);
      if (!admin) throw new Error("Admin not found");
      Object.assign(admin, args.data);
      return admin;
    },
  };

  constructor() {
    // initialized via class field
  }

  addAdmin(admin: AdminRecord) {
    this.admins.set(admin.id, admin);
  }
}

/** Encrypt a TOTP secret using AES-256-GCM (mirrors AuthService.encrypt) */
function encryptTotpSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Admin Auth Integration", () => {
  let app: NestFastifyApplication;
  let fakePrisma: FakePrismaAdminService;
  let fakeRedis: FakeRedisService;
  let jwtService: JwtService;
  let testAdmin: AdminRecord;

  const ENC_KEY = "0".repeat(64);
  const JWT_SECRET = "this-is-a-test-secret-for-jwt-32-char!";
  const ADMIN_PASSWORD = "TestPassw0rd!";

  beforeAll(async () => {
    process.env.ADMIN_JWT_SECRET = JWT_SECRET;
    process.env.TOTP_ENCRYPTION_KEY = ENC_KEY;
    process.env.COOKIE_SECURE = "false";
    process.env.NODE_ENV = "test";

    testAdmin = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@test.polyforge.app",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      displayName: "Test Admin",
      role: "SUPER_ADMIN",
      active: true,
      totpEnabled: false,
      totpSecret: null,
      totpEnabledAt: null,
      totpBackupCodes: [],
      createdAt: new Date(),
    };

    fakePrisma = new FakePrismaAdminService();
    fakePrisma.addAdmin({ ...testAdmin });

    fakeRedis = new FakeRedisService();

    @Global()
    @Module({
      providers: [
        { provide: PrismaAdminService, useValue: fakePrisma },
        { provide: RedisService, useValue: fakeRedis },
      ],
      exports: [PrismaAdminService, RedisService],
    })
    class TestInfraModule {}

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        TestInfraModule,
        AuthModule,
      ],
    }).compile();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyCookie as any);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clean up Redis sessions between tests to avoid cross-test interference
    const keysToDelete: string[] = [];
    for (const key of fakeRedis.store.keys()) {
      if (
        key.startsWith("admin:session:") ||
        key.startsWith("admin:login:fail:") ||
        key.startsWith("admin:totp:")
      ) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      fakeRedis.store.delete(key);
    }
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function cookieVal(
    cookies: Array<{ name: string; value: string }>,
  ): string | undefined {
    return cookies.find((c) => c.name === "pf_admin_token")?.value;
  }

  function cookieHdr(val: string | undefined): string {
    return val ? `pf_admin_token=${val}` : "";
  }

  async function loginCookie(
    email: string,
    password: string,
    totpCode?: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email, password, ...(totpCode ? { totpCode } : {}) },
    });
    return cookieVal(res.cookies) ?? "";
  }

  function parseJson(body: string): Record<string, unknown> {
    return JSON.parse(body);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  describe("POST /login", () => {
    it("returns 200 with admin profile and sets an httpOnly cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: testAdmin.email, password: ADMIN_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body).toEqual({
        id: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
        displayName: testAdmin.displayName,
        totpEnabled: testAdmin.totpEnabled,
      });

      const token = cookieVal(res.cookies);
      expect(token).toBeDefined();
      expect(res.headers["set-cookie"]).toContain("HttpOnly");
    });

    it("returns 400 INVALID_CREDENTIALS for unknown email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: "ghost@admin.com", password: ADMIN_PASSWORD },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 400 INVALID_CREDENTIALS for wrong password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: testAdmin.email, password: "WrongPass1!" },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 400 INVALID_CREDENTIALS for inactive admin", async () => {
      const inactive: AdminRecord = {
        ...testAdmin,
        id: "inactive-admin-id",
        email: "inactive@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        active: false,
      };
      fakePrisma.addAdmin(inactive);

      const res = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: inactive.email, password: ADMIN_PASSWORD },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("INVALID_CREDENTIALS");
    });

    it("stores a session key in Redis on successful login", async () => {
      await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: testAdmin.email, password: ADMIN_PASSWORD },
      });

      const sessionKeys = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      );
      expect(sessionKeys.length).toBeGreaterThanOrEqual(1);
      expect(fakeRedis.store.get(sessionKeys[0])).toBe(testAdmin.id);
    });

    it("generates a unique session ID per login", async () => {
      await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: testAdmin.email, password: ADMIN_PASSWORD },
      });
      await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: testAdmin.email, password: ADMIN_PASSWORD },
      });

      const sessionKeys = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      );
      expect(sessionKeys.length).toBeGreaterThanOrEqual(2);
    });

    it("returns 403 TOTP_REQUIRED when admin has 2FA enabled but no code", async () => {
      const totpAdmin: AdminRecord = {
        ...testAdmin,
        id: "totp-admin-id",
        email: "totp@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        totpEnabled: true,
        totpSecret: encryptTotpSecret("JBSWY3DPEHPK3PXP", ENC_KEY),
      };
      fakePrisma.addAdmin(totpAdmin);

      const res = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: totpAdmin.email, password: ADMIN_PASSWORD },
      });

      expect(res.statusCode).toBe(403);
      expect(parseJson(res.body).code).toBe("TOTP_REQUIRED");
    });

    it("returns 429 after 5 failed login attempts (account lockout)", async () => {
      const ADMIN_ID = "lockout-admin-id";
      const lockoutAdmin: AdminRecord = {
        ...testAdmin,
        id: ADMIN_ID,
        email: "lockout@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      };
      fakePrisma.addAdmin(lockoutAdmin);

      // Pre-set lockout counter to simulate 5 prior failed attempts
      const failKey = `admin:login:fail:${ADMIN_ID}`;
      fakeRedis.store.set(failKey, "5");

      const locked = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: lockoutAdmin.email, password: ADMIN_PASSWORD },
      });

      expect(locked.statusCode).toBe(429);
      expect(parseJson(locked.body).code).toBe("ACCOUNT_LOCKED");
    });

    it("clears lockout counter on successful login", async () => {
      const recoverAdmin: AdminRecord = {
        ...testAdmin,
        id: "recover-admin-id",
        email: "recover@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      };
      fakePrisma.addAdmin(recoverAdmin);

      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: "POST",
          url: "/login",
          payload: { email: recoverAdmin.email, password: "wrong" },
        });
      }

      const success = await app.inject({
        method: "POST",
        url: "/login",
        payload: { email: recoverAdmin.email, password: ADMIN_PASSWORD },
      });
      expect(success.statusCode).toBe(200);

      const failKey = `admin:login:fail:${recoverAdmin.id}`;
      expect(fakeRedis.store.has(failKey)).toBe(false);
    });
  });

  // ── Get Me ─────────────────────────────────────────────────────────────────

  describe("GET /me", () => {
    it("returns 200 with admin profile when cookie is valid", async () => {
      const cookie = await loginCookie(testAdmin.email, ADMIN_PASSWORD);

      const res = await app.inject({
        method: "GET",
        url: "/me",
        headers: { cookie: cookieHdr(cookie) },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body.email).toBe(testAdmin.email);
      expect(body.role).toBe(testAdmin.role);
    });

    it("returns 401 when no cookie is present", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/me",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when cookie contains an invalid JWT", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/me",
        headers: { cookie: "pf_admin_token=invalid-jwt" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when session has been revoked", async () => {
      const cookie = await loginCookie(testAdmin.email, ADMIN_PASSWORD);

      // Revoke all sessions
      const sessionKeys = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      );
      for (const key of sessionKeys) {
        fakeRedis.store.delete(key);
      }

      const res = await app.inject({
        method: "GET",
        url: "/me",
        headers: { cookie: cookieHdr(cookie) },
      });

      expect(res.statusCode).toBe(401);
      expect(parseJson(res.body).code).toBe("SESSION_EXPIRED");
    });

    it("returns 403 when admin account is inactive", async () => {
      const inactiveAdmin: AdminRecord = {
        ...testAdmin,
        id: "inactive-me-id",
        email: "inactiveme@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        active: false,
      };
      fakePrisma.addAdmin(inactiveAdmin);

      const payload = {
        sub: inactiveAdmin.id,
        role: "ADMIN",
        sessionId: "sess-inactive",
      };
      const token = jwtService.sign(payload, {
        secret: JWT_SECRET,
        expiresIn: "1h",
        algorithm: "HS256",
      });
      fakeRedis.store.set("admin:session:sess-inactive", inactiveAdmin.id);

      const res = await app.inject({
        method: "GET",
        url: "/me",
        headers: { cookie: `pf_admin_token=${token}` },
      });

      expect(res.statusCode).toBe(403);
      expect(parseJson(res.body).code).toBe("ACCOUNT_INACTIVE");
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe("POST /logout", () => {
    it("returns 204, clears cookie, and revokes session", async () => {
      const sessionCountBefore = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      ).length;

      const cookie = await loginCookie(testAdmin.email, ADMIN_PASSWORD);

      // One session should have been created
      const sessionCountAfterLogin = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      ).length;
      expect(sessionCountAfterLogin).toBe(sessionCountBefore + 1);

      const res = await app.inject({
        method: "POST",
        url: "/logout",
        headers: { cookie: cookieHdr(cookie) },
      });

      expect(res.statusCode).toBe(204);

      // Cookie should be cleared
      const setCookie = res.headers["set-cookie"] ?? "";
      expect(setCookie).toContain("pf_admin_token=;");

      // Session should be revoked (back to pre-login count)
      const sessionKeysAfter = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      );
      expect(sessionKeysAfter.length).toBe(sessionCountBefore);
    });

    it("returns 204 even when no cookie is present (no-op)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/logout",
      });

      expect(res.statusCode).toBe(204);
    });

    it("/me returns 401 after logout", async () => {
      const cookie = await loginCookie(testAdmin.email, ADMIN_PASSWORD);

      await app.inject({
        method: "POST",
        url: "/logout",
        headers: { cookie: cookieHdr(cookie) },
      });

      const meRes = await app.inject({
        method: "GET",
        url: "/me",
        headers: { cookie: cookieHdr(cookie) },
      });

      expect(meRes.statusCode).toBe(401);
    });
  });

  // ── TOTP Setup ────────────────────────────────────────────────────────────

  describe("POST /totp/setup", () => {
    it("returns 200 with secret, uri, and qrCode", async () => {
      const cookie = await loginCookie(testAdmin.email, ADMIN_PASSWORD);

      const res = await app.inject({
        method: "POST",
        url: "/totp/setup",
        headers: { cookie: cookieHdr(cookie) },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body).toHaveProperty("secret");
      expect(body).toHaveProperty("uri");
      expect(body).toHaveProperty("qrCode");
      expect(body.qrCode).toContain("data:image/png;base64,");

      // Pending secret stored in Redis
      const pendingKey = `totp:pending:admin:${testAdmin.id}`;
      expect(fakeRedis.store.get(pendingKey)).toBe(body.secret);
    });

    it("returns 409 when TOTP is already enabled", async () => {
      const totpSecret = generateSecret();
      const encryptedSecret = encryptTotpSecret(totpSecret, ENC_KEY);
      const totpOnAdmin: AdminRecord = {
        ...testAdmin,
        id: "totp-enabled-id",
        email: "totpenabled@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        totpEnabled: true,
        totpSecret: encryptedSecret,
      };
      fakePrisma.addAdmin(totpOnAdmin);

      // Login with TOTP
      const totpCode = generateSync({ secret: totpSecret });
      const cookie = await loginCookie(
        totpOnAdmin.email,
        ADMIN_PASSWORD,
        totpCode,
      );

      expect(cookie).toBeTruthy();

      const res = await app.inject({
        method: "POST",
        url: "/totp/setup",
        headers: { cookie: cookieHdr(cookie) },
      });

      expect(res.statusCode).toBe(409);
      expect(parseJson(res.body).code).toBe("TOTP_ALREADY_ENABLED");
    });
  });

  // ── TOTP Confirm ──────────────────────────────────────────────────────────

  describe("POST /totp/confirm", () => {
    it("returns 200 and enables TOTP on valid code", async () => {
      const setupAdmin: AdminRecord = {
        ...testAdmin,
        id: "confirm-setup-admin-id",
        email: "confirmsetup@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      };
      fakePrisma.addAdmin(setupAdmin);

      const cookie = await loginCookie(setupAdmin.email, ADMIN_PASSWORD);

      // Initiate setup
      const setupRes = await app.inject({
        method: "POST",
        url: "/totp/setup",
        headers: { cookie: cookieHdr(cookie) },
      });
      const secret: string = parseJson(setupRes.body).secret as string;

      // Generate valid TOTP code from the secret
      const validCode = generateSync({ secret });

      const confirmRes = await app.inject({
        method: "POST",
        url: "/totp/confirm",
        headers: { cookie: cookieHdr(cookie) },
        payload: { code: validCode },
      });

      expect(confirmRes.statusCode).toBe(200);
      expect(parseJson(confirmRes.body)).toEqual({ enabled: true });

      // Admin record updated
      const updated = fakePrisma.admins.get(setupAdmin.id);
      expect(updated?.totpEnabled).toBe(true);
      expect(updated?.totpSecret).not.toBeNull();

      // Pending secret cleared
      const pendingKey = `totp:pending:admin:${setupAdmin.id}`;
      expect(fakeRedis.store.has(pendingKey)).toBe(false);
    });

    it("returns 400 when no pending TOTP setup exists", async () => {
      const cookie = await loginCookie(testAdmin.email, ADMIN_PASSWORD);

      // Ensure no pending secret
      const pendingKey = `totp:pending:admin:${testAdmin.id}`;
      fakeRedis.store.delete(pendingKey);

      const res = await app.inject({
        method: "POST",
        url: "/totp/confirm",
        headers: { cookie: cookieHdr(cookie) },
        payload: { code: "123456" },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("TOTP_SETUP_EXPIRED");
    });

    it("returns 400 on invalid TOTP code", async () => {
      const invalidAdmin: AdminRecord = {
        ...testAdmin,
        id: "confirm-invalid-admin-id",
        email: "confirminvalid@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      };
      fakePrisma.addAdmin(invalidAdmin);

      const cookie = await loginCookie(invalidAdmin.email, ADMIN_PASSWORD);

      // Initiate setup
      await app.inject({
        method: "POST",
        url: "/totp/setup",
        headers: { cookie: cookieHdr(cookie) },
      });

      // Submit wrong code
      const res = await app.inject({
        method: "POST",
        url: "/totp/confirm",
        headers: { cookie: cookieHdr(cookie) },
        payload: { code: "000000" },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("TOTP_INVALID");
    });

    it("rejects a TOTP code that was already consumed (replay)", async () => {
      const replayAdmin: AdminRecord = {
        ...testAdmin,
        id: "confirm-replay-admin-id",
        email: "confirmreplay@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      };
      fakePrisma.addAdmin(replayAdmin);

      const cookie = await loginCookie(replayAdmin.email, ADMIN_PASSWORD);

      // Initiate setup
      await app.inject({
        method: "POST",
        url: "/totp/setup",
        headers: { cookie: cookieHdr(cookie) },
      });

      // Mark code as already consumed
      fakeRedis.store.set(`admin:totp:used:${replayAdmin.id}:123456`, "1");

      const res = await app.inject({
        method: "POST",
        url: "/totp/confirm",
        headers: { cookie: cookieHdr(cookie) },
        payload: { code: "123456" },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("TOTP_INVALID");
    });

    it("returns 429 after 5 failed confirm attempts (brute-force lockout)", async () => {
      const bruteAdmin: AdminRecord = {
        ...testAdmin,
        id: "confirm-brute-admin-id",
        email: "confirmbrute@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      };
      fakePrisma.addAdmin(bruteAdmin);

      const cookie = await loginCookie(bruteAdmin.email, ADMIN_PASSWORD);

      // Initiate setup
      await app.inject({
        method: "POST",
        url: "/totp/setup",
        headers: { cookie: cookieHdr(cookie) },
      });

      // 5 failed confirm attempts
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/totp/confirm",
          headers: { cookie: cookieHdr(cookie) },
          payload: { code: "000000" },
        });
        // First 4 should be 400
        if (i < 4) {
          expect(res.statusCode).toBe(400);
        }
      }

      // 6th attempt: should be locked (429)
      const locked = await app.inject({
        method: "POST",
        url: "/totp/confirm",
        headers: { cookie: cookieHdr(cookie) },
        payload: { code: "123456" },
      });

      expect(locked.statusCode).toBe(429);
      expect(parseJson(locked.body).code).toBe("TOTP_CONFIRM_LOCKED");
    });
  });

  // ── TOTP Disable ──────────────────────────────────────────────────────────

  describe("DELETE /totp", () => {
    it("returns 204 and disables TOTP after valid re-authentication", async () => {
      const totpSecret = generateSecret();
      const encryptedSecret = encryptTotpSecret(totpSecret, ENC_KEY);

      const disableAdmin: AdminRecord = {
        ...testAdmin,
        id: "real-totp-disable-id",
        email: "realtotpdisable@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        totpEnabled: true,
        totpSecret: encryptedSecret,
        totpEnabledAt: new Date(),
      };
      fakePrisma.addAdmin(disableAdmin);

      // Login with TOTP code directly
      const totpCode = generateSync({ secret: totpSecret });
      const totpCookie = await loginCookie(
        disableAdmin.email,
        ADMIN_PASSWORD,
        totpCode,
      );

      expect(totpCookie).toBeTruthy();

      // Login consumed the current TOTP code for replay protection.
      // Clear it so the disable re-authentication code (same window) passes.
      const totpUsedKey = `admin:totp:used:${disableAdmin.id}:${totpCode}`;
      fakeRedis.store.delete(totpUsedKey);

      // Generate fresh TOTP code for disable re-authentication
      const disableCode = generateSync({ secret: totpSecret });

      const res = await app.inject({
        method: "DELETE",
        url: "/totp",
        headers: { cookie: cookieHdr(totpCookie) },
        payload: { password: ADMIN_PASSWORD, totpCode: disableCode },
      });

      expect(res.statusCode).toBe(204);

      const updated = fakePrisma.admins.get(disableAdmin.id);
      expect(updated?.totpEnabled).toBe(false);
      expect(updated?.totpSecret).toBeNull();
    });

    it("returns 401 when password is wrong", async () => {
      const totpSecret = generateSecret();
      const encryptedSecret = encryptTotpSecret(totpSecret, ENC_KEY);

      const wrongPwdAdmin: AdminRecord = {
        ...testAdmin,
        id: "wrong-pwd-disable-id",
        email: "wrongpwddisable@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        totpEnabled: true,
        totpSecret: encryptedSecret,
      };
      fakePrisma.addAdmin(wrongPwdAdmin);

      const totpCode = generateSync({ secret: totpSecret });
      const cookie = await loginCookie(
        wrongPwdAdmin.email,
        ADMIN_PASSWORD,
        totpCode,
      );

      expect(cookie).toBeTruthy();

      const res = await app.inject({
        method: "DELETE",
        url: "/totp",
        headers: { cookie: cookieHdr(cookie) },
        payload: { password: "WrongPassword1!", totpCode: "123456" },
      });

      expect(res.statusCode).toBe(401);
      expect(parseJson(res.body).code).toBe("RE_AUTH_FAILED");
    });

    it("returns 400 when TOTP is not enabled", async () => {
      const noTotpAdmin: AdminRecord = {
        ...testAdmin,
        id: "no-totp-disable-id",
        email: "nototpdisable@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        totpEnabled: false,
      };
      fakePrisma.addAdmin(noTotpAdmin);

      const cookie = await loginCookie(noTotpAdmin.email, ADMIN_PASSWORD);

      const res = await app.inject({
        method: "DELETE",
        url: "/totp",
        headers: { cookie: cookieHdr(cookie) },
        payload: { password: ADMIN_PASSWORD, totpCode: "123456" },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe("TOTP_NOT_ENABLED");
    });

    it("returns 401 when session is revoked", async () => {
      const totpSecret = generateSecret();
      const encryptedSecret = encryptTotpSecret(totpSecret, ENC_KEY);

      const revokedSessionAdmin: AdminRecord = {
        ...testAdmin,
        id: "revoked-session-admin-id",
        email: "revokedsession@test.polyforge.app",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        totpEnabled: true,
        totpSecret: encryptedSecret,
      };
      fakePrisma.addAdmin(revokedSessionAdmin);

      const totpCode = generateSync({ secret: totpSecret });
      const cookie = await loginCookie(
        revokedSessionAdmin.email,
        ADMIN_PASSWORD,
        totpCode,
      );

      expect(cookie).toBeTruthy();

      // Revoke all sessions
      const sessionKeys = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith("admin:session:"),
      );
      for (const key of sessionKeys) {
        fakeRedis.store.delete(key);
      }

      const res = await app.inject({
        method: "DELETE",
        url: "/totp",
        headers: { cookie: cookieHdr(cookie) },
        payload: { password: ADMIN_PASSWORD, totpCode: "123456" },
      });

      expect(res.statusCode).toBe(401);
      expect(parseJson(res.body).code).toBe("SESSION_REVOKED");
    });
  });
});
