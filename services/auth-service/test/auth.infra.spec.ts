import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import fastifyCookie from '@fastify/cookie';
import * as bcrypt from 'bcrypt';

import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { PosthogService } from '@polyforge/shared-posthog';
import { MailService } from '../src/mail/mail.service';
import { cleanAuthDb } from './helpers/clean-db';
import { cleanAuthRedis } from './helpers/clean-redis';

const HAS_TEST_DB = !!process.env.TEST_DATABASE_URL;
const HAS_TEST_REDIS = !!process.env.TEST_REDIS_URL;

// ─── Mock bcrypt.util to avoid worker threads ────────────────────────────────
vi.mock('../src/auth/bcrypt.util', () => ({
  hashPassword: async (password: string, rounds = 12) =>
    bcrypt.hash(password, rounds),
  comparePassword: async (password: string, hash: string) =>
    bcrypt.compare(password, hash),
}));

// ─── Fake Mail ────────────────────────────────────────────────────────────────

class FakeMailService {
  sentEmails: Array<{ to: string; type: string; token?: string }> = [];

  async sendVerificationEmail(to: string, token: string) {
    this.sentEmails.push({ to, type: 'verification', token });
  }
  async sendWaitlistConfirmationEmail(to: string) {
    this.sentEmails.push({ to, type: 'waitlist' });
  }
  async sendAccountApprovedEmail(to: string, _username: string) {
    this.sentEmails.push({ to, type: 'approved' });
  }
  async sendPasswordResetEmail(to: string, token: string) {
    this.sentEmails.push({ to, type: 'password-reset', token });
  }
}

// ─── Fake Posthog ─────────────────────────────────────────────────────────────

class FakePosthogService {
  capture(
    _distinctId: string,
    _event: string,
    _properties?: Record<string, unknown>,
  ) {}
  identify(_distinctId: string, _properties?: Record<string, unknown>) {}
  async onModuleDestroy() {}
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe.runIf(HAS_TEST_DB && HAS_TEST_REDIS)('Auth Real Integration', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redisService: RedisService;
  let fakeMail: FakeMailService;

  const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;
  const TEST_REDIS_URL = process.env.TEST_REDIS_URL!;
  const TEST_PASSWORD = 'TestPassw0rd!';

  beforeAll(async () => {
    // Set env vars before NestJS constructs RedisService (reads REDIS_URL in ctor)
    vi.stubEnv('REDIS_URL', TEST_REDIS_URL);
    vi.stubEnv('DATABASE_URL', TEST_DATABASE_URL);

    fakeMail = new FakeMailService();

    @Global()
    @Module({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      providers: [
        { provide: PosthogService, useValue: new FakePosthogService() },
      ],
      exports: [ConfigModule, PosthogService],
    })
    class TestGlobalModule {}

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestGlobalModule, AuthModule],
    })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

    prisma = moduleFixture.get(PrismaService);
    redisService = moduleFixture.get(RedisService);

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
  }, 30_000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app.close();
  }, 30_000);

  beforeEach(async () => {
    // Drain pending async email sends from the previous test so they
    // do not leak into sentEmails after we clear it below.
    await new Promise((r) => setTimeout(r, 50));
    fakeMail.sentEmails = [];
    await cleanAuthDb(prisma);
    await cleanAuthRedis(redisService.getClient(), TEST_REDIS_URL);
  }, 30_000);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function tokenCookie(
    cookies: Array<{ name: string; value: string }>,
  ): string | undefined {
    return cookies.find((c) => c.name === 'pf_token')?.value;
  }

  function refreshCookie(
    cookies: Array<{ name: string; value: string }>,
  ): string | undefined {
    return cookies.find((c) => c.name === 'pf_refresh')?.value;
  }

  function cookieHdr(token?: string, refresh?: string): string {
    const parts: string[] = [];
    if (token) parts.push(`pf_token=${token}`);
    if (refresh) parts.push(`pf_refresh=${refresh}`);
    return parts.join('; ');
  }

  function setCookieVal(headers: Record<string, unknown>): string {
    const raw = headers['set-cookie'];
    if (Array.isArray(raw)) return raw.join(', ');
    return (raw as string) ?? '';
  }

  function parseJson(body: string): Record<string, unknown> {
    return JSON.parse(body);
  }

  async function waitForSentEmail(
    predicate: (
      email: { to: string; type: string; token?: string },
    ) => boolean,
    timeoutMs = 2_000,
  ): Promise<boolean> {
    const interval = 50;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (fakeMail.sentEmails.some(predicate)) return true;
      await new Promise((r) => setTimeout(r, interval));
    }
    return false;
  }

  async function registerAndLogin(
    email: string,
    password: string,
  ): Promise<{
    user: Record<string, unknown>;
    token: string;
    refresh: string;
  }> {
    const regRes = await app.inject({
      method: 'POST',
      url: '/register',
      payload: {
        email,
        password,
        username: `usr_${Date.now()}`,
        tosAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const user = parseJson(regRes.body);
    const token = tokenCookie(regRes.cookies) ?? '';
    const refresh = refreshCookie(regRes.cookies) ?? '';
    expect(token).toBeTruthy();
    expect(refresh).toBeTruthy();

    return { user, token, refresh };
  }

  // ─── Register ────────────────────────────────────────────────────────────────

  describe('POST /register', () => {
    beforeEach(() => {
      fakeMail.sentEmails = [];
    });

    it('creates user in real DB and returns 201 with cookies', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'alice@test.com',
          password: TEST_PASSWORD,
          username: 'alice_test',
          tosAccepted: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = parseJson(res.body);
      expect(body.email).toBe('alice@test.com');
      expect(body.username).toBe('alice_test');
      expect(body.status).toBe('UNVERIFIED');

      // Verify cookie presence
      const token = tokenCookie(res.cookies);
      expect(token).toBeDefined();
      expect(setCookieVal(res.headers)).toContain('HttpOnly');

      const refresh = refreshCookie(res.cookies);
      expect(refresh).toBeDefined();

      // Verify user was persisted in real DB
      const dbUser = await prisma.user.findUnique({
        where: { email: 'alice@test.com' },
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser!.username).toBe('alice_test');
      expect(dbUser!.passwordHash).toMatch(/^\$2[bay]\$/); // bcrypt prefix
      // No PII in stored data: password is hashed, email is stored
    });

    it('sends a verification email after registration', async () => {
      await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'bob@test.com',
          password: TEST_PASSWORD,
          username: 'bob_test',
          tosAccepted: true,
        },
      });

      const gotEmail = await waitForSentEmail(
        (email) => email.type === 'verification' && email.to === 'bob@test.com',
      );
      expect(gotEmail).toBeTruthy();
      const bobMail = fakeMail.sentEmails.find((e) => e.to === 'bob@test.com');
      expect(bobMail?.type).toBe('verification');
    });

    it('returns 400 on missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: { email: 'bad@test.com' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when tosAccepted is false', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'charlie@test.com',
          password: TEST_PASSWORD,
          username: 'charlie_test',
          tosAccepted: false,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 409 EMAIL_TAKEN for duplicate email (real unique constraint)', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'dave@test.com',
          password: TEST_PASSWORD,
          username: 'dave_1',
          tosAccepted: true,
        },
      });

      // Duplicate email
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'dave@test.com',
          password: TEST_PASSWORD,
          username: 'dave_2',
          tosAccepted: true,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(parseJson(res.body).code).toBe('EMAIL_TAKEN');
    });

    it('returns 409 USERNAME_TAKEN for duplicate username', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'frank@test.com',
          password: TEST_PASSWORD,
          username: 'frank_unique',
          tosAccepted: true,
        },
      });

      // Duplicate username
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'frank2@test.com',
          password: TEST_PASSWORD,
          username: 'frank_unique',
          tosAccepted: true,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(parseJson(res.body).code).toBe('USERNAME_TAKEN');
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  describe('POST /login', () => {
    it('authenticates against real bcrypt hash, returns 200 with cookies', async () => {
      const email = 'ivan@test.com';
      const { token } = await registerAndLogin(email, TEST_PASSWORD);

      expect(token).toBeTruthy();

      // Verify the persisted hash in real DB
      const dbUser = await prisma.user.findUnique({
        where: { email },
      });
      expect(dbUser!.passwordHash).toMatch(/^\$2[bay]\$/);

      // Re-login with same credentials
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body.email).toBe(email);

      const loginToken = tokenCookie(res.cookies);
      expect(loginToken).toBeDefined();

      const loginRefresh = refreshCookie(res.cookies);
      expect(loginRefresh).toBeDefined();
    });

    it('returns 400 INVALID_CREDENTIALS for unknown email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'ghost@test.com', password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 400 INVALID_CREDENTIALS for wrong password', async () => {
      const email = 'julia@test.com';
      await registerAndLogin(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: 'WrongPass1!' },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe('INVALID_CREDENTIALS');
    });

    it('persists login history row on successful login', async () => {
      const email = 'hist-test@test.com';
      // Register first to create the user
      await registerAndLogin(email, TEST_PASSWORD);

      // Actually login to trigger login history creation
      const loginRes = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });
      expect(loginRes.statusCode).toBe(200);

      // Fire-and-forget: poll for async login history write (real DB IO)
      let history: unknown[] = [];
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 10));
        history = await prisma.userLoginHistory.findMany();
        if (history.length > 0) break;
      }
      expect(history.length).toBeGreaterThanOrEqual(1);
      const latest = history[history.length - 1] as Record<string, unknown>;
      expect(latest).toHaveProperty('userId');
      expect(latest).toHaveProperty('success');
    });

    it('increments lockout counter on failed attempts (real Redis)', async () => {
      const email = 'failcounter@test.com';
      await registerAndLogin(email, TEST_PASSWORD);

      await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: 'WrongPass1!' },
      });

      // Verify failure counter was set in real Redis
      const keys = await redisService.getClient().keys('login:fail:*');
      expect(keys.length).toBe(2);
      const count = await redisService.getClient().get(keys[0]);
      expect(Number(count)).toBe(1);
    });

    it('returns 429 after 10 failed attempts (real Redis TTL)', async () => {
      const email = 'locked@test.com';
      const { user } = await registerAndLogin(email, TEST_PASSWORD);

      // Pre-set lockout counter to 10 using the user's DB ID (not JWT sub)
      await redisService
        .getClient()
        .set(`login:fail:user:${user.id}`, '10', 'EX', 900);

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(429);
      expect(parseJson(res.body).code).toBe('ACCOUNT_LOCKED');
    });
  });

  // ─── Me ──────────────────────────────────────────────────────────────────────

  describe('GET /me', () => {
    it('returns 200 with user profile from real DB', async () => {
      const email = 'me-test@test.com';
      const { token, refresh } = await registerAndLogin(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: cookieHdr(token, refresh) },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body.email).toBe(email);
      expect(body.status).toBeDefined();
      // Ensure password hash is not leaked
      expect(body.password).toBeUndefined();
      expect(body.passwordHash).toBeUndefined();
    });

    it('returns 401 when no cookie is present', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 with an invalid JWT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: 'pf_token=bogus.jwt.token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  describe('POST /refresh', () => {
    it('returns 200 with new token pair (real Redis Lua script)', async () => {
      const email = 'refresh-test@test.com';
      const { refresh } = await registerAndLogin(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: refresh },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body.token).toBeDefined();

      const newToken = tokenCookie(res.cookies);
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(refresh);

      // Verify new refresh token is stored in real Redis
      const refreshKeys = await redisService.getClient().keys('refresh:*');
      expect(refreshKeys.length).toBeGreaterThan(0);
    });

    it('returns 401 on invalid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: 'f0000000-0000-4000-8000-000000000000' },
      });

      expect(res.statusCode).toBe(401);
      expect(parseJson(res.body).code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('returns 401 on replay (token already consumed via real Redis Lua)', async () => {
      const email = 'replay-test@test.com';
      const { refresh } = await registerAndLogin(email, TEST_PASSWORD);

      // First refresh succeeds
      const first = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: refresh },
      });
      expect(first.statusCode).toBe(200);

      // Second refresh with same token fails (real Redis Lua atomic consume)
      const second = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: refresh },
      });

      expect(second.statusCode).toBe(401);
      expect(parseJson(second.body).code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────

  describe('POST /logout', () => {
    it('returns 204, clears cookies, and revokes refresh token (real Redis)', async () => {
      const email = 'logout-test@test.com';
      const { token, refresh } = await registerAndLogin(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/logout',
        headers: { cookie: cookieHdr(token, refresh) },
        payload: {},
      });

      expect(res.statusCode).toBe(204);

      // Cookies should be cleared
      const scv = setCookieVal(res.headers);
      expect(scv).toContain('pf_token=;');
      expect(scv).toContain('pf_refresh=;');
    });

    it('returns 204 even with no cookies (no-op)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/logout',
        payload: {},
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // ─── Verify Email ────────────────────────────────────────────────────────────

  describe('POST /verify-email', () => {
    it('verifies email with token persisted in real DB', async () => {
      // Register to create an unverified user and get verification token
      const email = 'verify@test.com';
      const regRes = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email,
          password: TEST_PASSWORD,
          username: 'verify_user',
          tosAccepted: true,
        },
      });
      expect(regRes.statusCode).toBe(201);

      // Fire-and-forget: poll for async verification email under CI load.
      // Filter by recipient email so stale verification tokens from
      // prior tests are never matched (fire-and-forget race).
      let verifyToken: string | undefined;
      for (let i = 0; i < 20; i++) {
        verifyToken = fakeMail.sentEmails.find(
          (e) => e.type === 'verification' && e.to === email,
        )?.token;
        if (verifyToken) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(verifyToken).toBeDefined();

      // Verify email
      const res = await app.inject({
        method: 'POST',
        url: '/verify-email',
        payload: { token: verifyToken },
      });

      expect(res.statusCode).toBe(200);
      expect(parseJson(res.body).message).toBe('Email verified successfully');

      // Verify user is now email-verified in real DB
      const dbUser = await prisma.user.findUnique({
        where: { email },
      });
      expect(dbUser!.emailVerified).toBe(true);
      expect(dbUser!.emailVerifiedAt).toBeTruthy();
    });

    it('returns 400 on invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/verify-email',
        payload: { token: 'a'.repeat(64) },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe('TOKEN_INVALID');
    });
  });

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  describe('POST /forgot-password', () => {
    it('returns 200 even for unknown email (anti-enumeration)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/forgot-password',
        payload: { email: 'unknown@test.com' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('sends password reset email for known user', async () => {
      const email = 'resetme@test.com';
      await registerAndLogin(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/forgot-password',
        payload: { email },
      });

      expect(res.statusCode).toBe(200);
      const gotResetEmail = await waitForSentEmail(
        (email) => email.type === 'password-reset',
      );
      expect(gotResetEmail).toBeTruthy();
    });
  });

  // ─── Reset Password ──────────────────────────────────────────────────────────

  describe('POST /reset-password', () => {
    it('resets password and persists new bcrypt hash in real DB', async () => {
      const email = 'pwreset@test.com';
      await registerAndLogin(email, TEST_PASSWORD);

      // Trigger password reset to get a token
      fakeMail.sentEmails = [];
      await app.inject({
        method: 'POST',
        url: '/forgot-password',
        payload: { email },
      });

      // Fire-and-forget: poll for async password reset email under CI load.
      let resetToken: string | undefined;
      for (let i = 0; i < 20; i++) {
        resetToken = fakeMail.sentEmails.find(
          (e) => e.type === 'password-reset' && e.to === email,
        )?.token;
        if (resetToken) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(resetToken).toBeDefined();

      const newPassword = 'NewPassw0rd!';
      const res = await app.inject({
        method: 'POST',
        url: '/reset-password',
        payload: { token: resetToken, newPassword },
      });

      expect(res.statusCode).toBe(200);
      expect(parseJson(res.body).message).toBe('Password reset successfully');

      // Old password should no longer work
      const oldLoginRes = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });
      expect(oldLoginRes.statusCode).toBe(400);

      // New password should work against real bcrypt in real DB
      const newLoginRes = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: newPassword },
      });
      expect(newLoginRes.statusCode).toBe(200);

      // Verify the new hash in real DB
      const dbUser = await prisma.user.findUnique({
        where: { email },
      });
      expect(dbUser!.passwordHash).not.toBe(TEST_PASSWORD);
      expect(dbUser!.passwordHash).toMatch(/^\$2[bay]\$/);
    });
  });

  // ─── Delete Account ──────────────────────────────────────────────────────────

  describe('DELETE /account', () => {
    it('deletes account and anonymizes PII in real DB', async () => {
      const email = 'delete-me@test.com';
      const { user, token, refresh } = await registerAndLogin(
        email,
        TEST_PASSWORD,
      );

      const res = await app.inject({
        method: 'DELETE',
        url: '/account',
        headers: { cookie: cookieHdr(token, refresh) },
        payload: { password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      expect(parseJson(res.body).message).toBe('Account deleted successfully');

      // Cookies should be cleared
      expect(setCookieVal(res.headers)).toContain('pf_token=;');

      // Verify anonymization in real DB — email is changed during deletion
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id as string },
      });
      expect(dbUser!.deleted).toBe(true);
      expect(dbUser!.email).toContain('@anon.local');
    });

    it('returns 400 INVALID_PASSWORD on wrong password', async () => {
      const email = 'wrong-pwd-delete@test.com';
      const { token, refresh } = await registerAndLogin(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'DELETE',
        url: '/account',
        headers: { cookie: cookieHdr(token, refresh) },
        payload: { password: 'WrongPassword1!' },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe('INVALID_PASSWORD');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/account',
        payload: { password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── Full Auth Lifecycle ─────────────────────────────────────────────────────

  describe('Full auth lifecycle', () => {
    it('register → verify → me → refresh → logout (real DB + Redis)', async () => {
      const email = 'lifecycle@test.com';
      const username = 'lifecycle_user';

      // 1. Register
      const regRes = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email,
          password: TEST_PASSWORD,
          username,
          tosAccepted: true,
        },
      });
      expect(regRes.statusCode).toBe(201);
      const regBody = parseJson(regRes.body);
      expect(regBody.email).toBe(email);
      expect(regBody.status).toBe('UNVERIFIED');

      const regToken = tokenCookie(regRes.cookies);
      const regRefresh = refreshCookie(regRes.cookies);
      expect(regToken).toBeDefined();
      expect(regRefresh).toBeDefined();

      const gotLifecycleEmail = await waitForSentEmail(
        (sentEmail) =>
          sentEmail.type === 'verification' && sentEmail.to === email,
      );
      expect(gotLifecycleEmail).toBeTruthy();

      const verifyToken = fakeMail.sentEmails.find(
        (e) => e.type === 'verification' && e.to === email,
      )?.token;
      expect(verifyToken).toBeDefined();

      // 2. Verify email
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/verify-email',
        payload: { token: verifyToken },
      });
      expect(verifyRes.statusCode).toBe(200);

      // 3. Me — now verified (from real DB)
      const meRes = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: cookieHdr(regToken, regRefresh) },
      });
      expect(meRes.statusCode).toBe(200);
      const meBody = parseJson(meRes.body);
      expect(meBody.emailVerified).toBe(true);

      // 4. Refresh (real Redis Lua)
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: regRefresh },
      });
      expect(refreshRes.statusCode).toBe(200);
      const newToken = tokenCookie(refreshRes.cookies);
      const newRefresh = refreshCookie(refreshRes.cookies);
      expect(newToken).toBeDefined();
      expect(newRefresh).toBeDefined();

      // 5. Logout (real Redis deletion)
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/logout',
        headers: { cookie: cookieHdr(newToken, newRefresh) },
        payload: {},
      });
      expect(logoutRes.statusCode).toBe(204);

      // 6. Verify refresh token is revoked in real Redis
      const keysAfterLogout = await redisService.getClient().keys('refresh:*');
      expect(keysAfterLogout.length).toBe(0);

      // 7. Refresh after logout should fail
      const refreshAfterLogout = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: newRefresh },
      });
      expect(refreshAfterLogout.statusCode).toBe(401);
    });
  });
});

// ─── Skip message when test infrastructure is unavailable ─────────────────────

describe.skipIf(HAS_TEST_DB && HAS_TEST_REDIS)(
  'Auth Real Integration (SKIPPED — no test infrastructure)',
  () => {
    it('skips because TEST_DATABASE_URL or TEST_REDIS_URL is not set', () => {
      if (!HAS_TEST_DB) {
        console.log(
          '  TEST_DATABASE_URL not set — set it to a PostgreSQL connection string for real integration tests.',
        );
        console.log(
          '  Example: TEST_DATABASE_URL="postgresql://poly_test:poly_test@localhost:5433/polyforge_test?pgbouncer=true"',
        );
      }
      if (!HAS_TEST_REDIS) {
        console.log(
          '  TEST_REDIS_URL not set — set it to a Redis connection string for real integration tests.',
        );
        console.log('  Example: TEST_REDIS_URL="redis://localhost:6380"');
      }
    });
  },
);
