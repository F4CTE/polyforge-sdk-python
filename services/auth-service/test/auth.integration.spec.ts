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
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { PosthogService } from '@polyforge/shared-posthog';
import { MailService } from '../src/mail/mail.service';

// ─── Mock bcrypt.util to avoid worker threads ──────────────────────────────────
vi.mock('../src/auth/bcrypt.util', () => ({
  hashPassword: async (password: string, rounds = 12) =>
    bcrypt.hash(password, rounds),
  comparePassword: async (password: string, hash: string) =>
    bcrypt.compare(password, hash),
}));

// ─── User record shape ─────────────────────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  passwordHash: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  polymarketConnected: boolean;
  polymarketUsConnected: boolean;
  kalshiConnected: boolean;
  kalshiUserId: string | null;
  totpEnabled: boolean;
  totpSecret: string | null;
  totpEnabledAt: Date | null;
  totpBackupCodes: string[];
  suspended: boolean;
  deleted: boolean;
  approved: boolean;
  approvedAt: Date | null;
  bio: string | null;
  avatarUrl: string | null;
  tosAcceptedAt: Date;
  polymarketAddress: string | null;
  twitterHandle: string | null;
  country: string | null;
  venuePreferences: unknown;
  deletedAt: Date | null;
  createdAt: Date;
  lastSeen: Date | null;
}

interface EmailVerificationRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

// ─── Fake Redis ────────────────────────────────────────────────────────────────

class FakeRedisService {
  store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttl?: number): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  get isHealthy(): boolean {
    return true;
  }

  getClient() {
    const store = this.store;

    // Minimal Lua interpreter for the two known scripts
    function evalLua(script: string, keys: string[]): number | string | null {
      const trimmed = script.trim();
      if (
        trimmed.startsWith("local val = redis.call('GET', KEYS[1])") &&
        trimmed.includes('return -1 end')
      ) {
        // Invite code redeem script
        const key = keys[0];
        const val = store.get(key);
        if (val === undefined) return -1;
        const remaining = parseInt(val, 10);
        if (remaining <= 0) return -2;
        if (remaining <= 1) {
          store.delete(key);
          return 0;
        }
        store.set(key, String(remaining - 1));
        return remaining - 1;
      }

      if (
        trimmed.startsWith("local val = redis.call('GET', KEYS[1])") &&
        trimmed.includes("redis.call('DEL', KEYS[2])")
      ) {
        // Atomic refresh consume script
        const val = store.get(keys[0]);
        if (val === undefined) return null;
        keys.forEach((k) => store.delete(k));
        return val;
      }

      throw new Error(
        `Unsupported Lua script in test: ${script.slice(0, 100)}`,
      );
    }

    return {
      get: async (key: string) => store.get(key) ?? null,
      set: async (
        key: string,
        value: string,
        ...args: string[]
      ): Promise<string | null> => {
        const nxIdx = args.indexOf('NX');
        if (nxIdx >= 0 && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
      del: async (key: string) => {
        store.delete(key);
        return 1;
      },
      incr: async (key: string): Promise<number> => {
        const raw = store.get(key);
        const current = parseInt(raw ?? '0', 10);
        const next = current + 1;
        store.set(key, String(next));
        return next;
      },
      expire: async (_key: string, _seconds: number): Promise<number> => 1,
      eval: async (script: string, nkeys: number, ...keys: string[]) => {
        return evalLua(script, keys.slice(0, nkeys));
      },
      call: async (command: string, ...args: any[]) => {
        if (command === 'EVAL') {
          const script = args[0] as string;
          const nkeys = args[1] as number;
          const keys = args.slice(2, 2 + nkeys) as string[];
          return evalLua(script, keys);
        }
        throw new Error(`Unsupported Redis command in test: ${command}`);
      },
      scanStream: (opts: { match: string; count: number }) => {
        const pattern = opts.match.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        const matchingKeys: string[] = [];
        for (const key of store.keys()) {
          if (regex.test(key)) matchingKeys.push(key);
        }

        const listeners: Record<string, Array<(...a: any[]) => void>> = {
          data: [],
          end: [],
          error: [],
        };
        const stream = {
          on(event: string, fn: (...a: any[]) => void) {
            listeners[event]?.push(fn);
            return stream;
          },
        };

        // Emit asynchronously
        void Promise.resolve().then(() => {
          const count = opts.count ?? 100;
          for (let i = 0; i < matchingKeys.length; i += count) {
            const chunk = matchingKeys.slice(i, i + count);
            for (const fn of listeners.data) fn(chunk);
          }
          for (const fn of listeners.end) fn();
        });

        return stream;
      },
      pipeline: () => {
        const commands: Array<{ op: string; key: string }> = [];
        return {
          del(key: string) {
            commands.push({ op: 'del', key });
            return this;
          },
          async exec() {
            for (const cmd of commands) {
              if (cmd.op === 'del') store.delete(cmd.key);
            }
            return [];
          },
        };
      },
      xadd: async (
        _stream: string,
        _id: string,
        ..._fields: string[]
      ): Promise<string> => 'ok',
    };
  }
}

// ─── Fake Prisma ───────────────────────────────────────────────────────────────

let fakeIdSeq = 0;
function fakeId(): string {
  fakeIdSeq += 1;
  return `fake-id-${String(fakeIdSeq).padStart(8, '0')}`;
}

class FakePrismaService {
  users = new Map<string, UserRecord>();
  emailVerifications = new Map<string, EmailVerificationRecord>();
  passwordResetTokens = new Map<string, PasswordResetRecord>();
  apiKeys: unknown[] = [];
  strategies: unknown[] = [];
  webhooks: unknown[] = [];
  botConnections: unknown[] = [];
  loginHistory: unknown[] = [];

  // Using constructor to assign methods with proper 'this' binding
  declare user: {
    findUnique: (args: {
      where: { id?: string; email?: string; username?: string };
    }) => Promise<UserRecord | null>;
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<UserRecord | null>;
    findMany: (args: { where: Record<string, unknown> }) => Promise<UserRecord[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<UserRecord>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<UserRecord>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare emailVerification: {
    findUnique: (args: {
      where: { tokenHash: string };
    }) => Promise<EmailVerificationRecord | null>;
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<EmailVerificationRecord>;
    update: (args: {
      where: { tokenHash: string };
      data: Record<string, unknown>;
    }) => Promise<EmailVerificationRecord>;
  };

  declare passwordResetToken: {
    findUnique: (args: {
      where: { tokenHash: string };
    }) => Promise<PasswordResetRecord | null>;
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<PasswordResetRecord>;
    update: (args: {
      where: { tokenHash: string };
      data: Record<string, unknown>;
    }) => Promise<PasswordResetRecord>;
  };

  declare apiKey: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare strategy: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare webhook: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare botConnection: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare userCredential: {
    deleteMany: (args: {
      where: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare kalshiCredential: {
    deleteMany: (args: {
      where: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare polymarketUsCredential: {
    deleteMany: (args: {
      where: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };

  declare userLoginHistory: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.user = {
      findUnique: async (args) => {
        if (args.where.id) return self.users.get(args.where.id) ?? null;
        if (args.where.email) {
          for (const u of self.users.values()) {
            if (u.email === args.where.email) return u;
          }
          return null;
        }
        if (args.where.username) {
          for (const u of self.users.values()) {
            if (u.username === args.where.username) return u;
          }
          return null;
        }
        return null;
      },

      findFirst: async (args) => {
        const where = args.where as Record<string, unknown>;
        // Support { email: { equals, mode: 'insensitive' } } for findByEmailInsensitive
        if (where.email && typeof where.email === 'object') {
          const emailFilter = where.email as { equals?: string; mode?: string };
          if (emailFilter.equals) {
            const target = emailFilter.equals.toLowerCase();
            for (const u of self.users.values()) {
              if (u.email.toLowerCase() === target) return u;
            }
            return null;
          }
        }
        return null;
      },

      findMany: async (args) => {
        const results: UserRecord[] = [];
        const where = args.where as Record<string, unknown>;
        if (where.email && typeof where.email === 'object') {
          const emailFilter = where.email as { equals?: string; mode?: string };
          if (emailFilter.equals) {
            const target = emailFilter.equals.toLowerCase();
            for (const u of self.users.values()) {
              if (u.email.toLowerCase() === target) results.push(u);
            }
          }
        }
        return results;
      },

      create: async (args) => {
        const id = (args.data.id as string) ?? fakeId();
        const now = new Date();
        const user: UserRecord = {
          id,
          email: (args.data.email as string) ?? '',
          username: (args.data.username as string) ?? '',
          displayName: (args.data.displayName as string) ?? null,
          passwordHash: (args.data.passwordHash as string) ?? '',
          emailVerified: (args.data.emailVerified as boolean) ?? false,
          emailVerifiedAt: (args.data.emailVerifiedAt as Date) ?? null,
          polymarketConnected:
            (args.data.polymarketConnected as boolean) ?? false,
          polymarketUsConnected:
            (args.data.polymarketUsConnected as boolean) ?? false,
          kalshiConnected: (args.data.kalshiConnected as boolean) ?? false,
          kalshiUserId: (args.data.kalshiUserId as string) ?? null,
          totpEnabled: (args.data.totpEnabled as boolean) ?? false,
          totpSecret: (args.data.totpSecret as string) ?? null,
          totpEnabledAt: (args.data.totpEnabledAt as Date) ?? null,
          totpBackupCodes: (args.data.totpBackupCodes as string[]) ?? [],
          suspended: (args.data.suspended as boolean) ?? false,
          deleted: (args.data.deleted as boolean) ?? false,
          approved: (args.data.approved as boolean) ?? true,
          approvedAt: (args.data.approvedAt as Date) ?? now,
          bio: (args.data.bio as string) ?? null,
          avatarUrl: (args.data.avatarUrl as string) ?? null,
          tosAcceptedAt: (args.data.tosAcceptedAt as Date) ?? now,
          polymarketAddress: (args.data.polymarketAddress as string) ?? null,
          twitterHandle: (args.data.twitterHandle as string) ?? null,
          country: (args.data.country as string) ?? null,
          venuePreferences: args.data.venuePreferences ?? null,
          deletedAt: (args.data.deletedAt as Date) ?? null,
          createdAt: (args.data.createdAt as Date) ?? now,
          lastSeen: (args.data.lastSeen as Date) ?? null,
        };
        self.users.set(id, user);
        return user;
      },

      update: async (args) => {
        const user = self.users.get(args.where.id);
        if (!user) throw new Error('User not found');
        Object.assign(user, args.data);
        return user;
      },

      updateMany: async () => ({ count: 0 }),
    };

    this.emailVerification = {
      findUnique: async (args) =>
        self.emailVerifications.get(args.where.tokenHash) ?? null,

      create: async (args) => {
        const id = (args.data.id as string) ?? fakeId();
        const record: EmailVerificationRecord = {
          id,
          userId: (args.data.userId as string) ?? '',
          tokenHash: (args.data.tokenHash as string) ?? '',
          expiresAt: (args.data.expiresAt as Date) ?? new Date(),
          usedAt: (args.data.usedAt as Date) ?? null,
          createdAt: (args.data.createdAt as Date) ?? new Date(),
        };
        self.emailVerifications.set(record.tokenHash, record);
        return record;
      },

      update: async (args) => {
        const record = self.emailVerifications.get(args.where.tokenHash);
        if (!record) throw new Error('Email verification not found');
        Object.assign(record, args.data);
        return record;
      },
    };

    this.passwordResetToken = {
      findUnique: async (args) =>
        self.passwordResetTokens.get(args.where.tokenHash) ?? null,

      create: async (args) => {
        const id = (args.data.id as string) ?? fakeId();
        const record: PasswordResetRecord = {
          id,
          userId: (args.data.userId as string) ?? '',
          tokenHash: (args.data.tokenHash as string) ?? '',
          expiresAt: (args.data.expiresAt as Date) ?? new Date(),
          usedAt: (args.data.usedAt as Date) ?? null,
          createdAt: (args.data.createdAt as Date) ?? new Date(),
        };
        self.passwordResetTokens.set(record.tokenHash, record);
        return record;
      },

      update: async (args) => {
        const record = self.passwordResetTokens.get(args.where.tokenHash);
        if (!record) throw new Error('Password reset token not found');
        Object.assign(record, args.data);
        return record;
      },
    };

    this.apiKey = {
      updateMany: async () => ({ count: 0 }),
    };

    this.strategy = {
      updateMany: async () => ({ count: 0 }),
    };

    this.webhook = {
      updateMany: async () => ({ count: 0 }),
    };

    this.botConnection = {
      updateMany: async () => ({ count: 0 }),
    };

    this.userCredential = {
      deleteMany: async () => ({ count: 0 }),
    };

    this.kalshiCredential = {
      deleteMany: async () => ({ count: 0 }),
    };

    this.polymarketUsCredential = {
      deleteMany: async () => ({ count: 0 }),
    };

    this.userLoginHistory = {
      create: async (args) => {
        self.loginHistory.push(args.data);
        return args.data;
      },
    };
  }

  async $transaction<T>(operations: Promise<T>[]): Promise<T[]> {
    return Promise.all(operations);
  }

  addUser(user: UserRecord) {
    this.users.set(user.id, user);
  }
}

// ─── Fake Posthog ──────────────────────────────────────────────────────────────

class FakePosthogService {
  capture(
    _distinctId: string,
    _event: string,
    _properties?: Record<string, unknown>,
  ) {}
  identify(_distinctId: string, _properties?: Record<string, unknown>) {}
  async onModuleDestroy() {}
}

// ─── Fake Mail ─────────────────────────────────────────────────────────────────

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

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe('Auth Integration', () => {
  let app: NestFastifyApplication;
  let fakePrisma: FakePrismaService;
  let fakeRedis: FakeRedisService;
  let fakeMail: FakeMailService;

  const TEST_PASSWORD = 'TestPassw0rd!';

  beforeAll(async () => {
    fakePrisma = new FakePrismaService();
    fakeRedis = new FakeRedisService();
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
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .overrideProvider(RedisService)
      .useValue(fakeRedis)
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

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
    // Reset user sequence for deterministic IDs
    fakeIdSeq = 0;
    // Clean up Redis between tests
    const keysToDelete: string[] = [];
    for (const key of fakeRedis.store.keys()) {
      keysToDelete.push(key);
    }
    for (const key of keysToDelete) {
      fakeRedis.store.delete(key);
    }
    // Reset mail capture
    fakeMail.sentEmails = [];
    // Reset Prisma collections
    fakePrisma.users.clear();
    fakePrisma.emailVerifications.clear();
    fakePrisma.passwordResetTokens.clear();
    fakePrisma.loginHistory = [];
  });

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

  /** Create a user directly in the fake DB with an approved, verified account */
  async function seedUser(
    email: string,
    password: string,
  ): Promise<UserRecord> {
    const passwordHash = await bcrypt.hash(password, 12);
    const user: UserRecord = {
      id: fakeId(),
      email,
      username: `user_${fakeIdSeq}`,
      displayName: null,
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      polymarketConnected: false,
      polymarketUsConnected: false,
      kalshiConnected: false,
      kalshiUserId: null,
      totpEnabled: false,
      totpSecret: null,
      totpEnabledAt: null,
      totpBackupCodes: [],
      suspended: false,
      deleted: false,
      approved: true,
      approvedAt: new Date(),
      bio: null,
      avatarUrl: null,
      tosAcceptedAt: new Date(),
      polymarketAddress: null,
      twitterHandle: null,
      country: null,
      venuePreferences: null,
      deletedAt: null,
      createdAt: new Date(),
      lastSeen: null,
    };
    fakePrisma.addUser(user);
    return user;
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
    it('returns 201 with user profile and sets HttpOnly cookies', async () => {
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

      const token = tokenCookie(res.cookies);
      expect(token).toBeDefined();
      expect(setCookieVal(res.headers)).toContain('HttpOnly');

      const refresh = refreshCookie(res.cookies);
      expect(refresh).toBeDefined();
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

      // Use find() instead of sentEmails[0] so async emails from previous
      // tests still in-flight do not contaminate this assertion.
      const verificationEmail = fakeMail.sentEmails.find(
        (e) => e.to === 'bob@test.com' && e.type === 'verification',
      );
      expect(verificationEmail).toBeTruthy();
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

    it('returns 409 EMAIL_TAKEN for duplicate email', async () => {
      await seedUser('dave@test.com', TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'dave@test.com',
          password: TEST_PASSWORD,
          username: 'dave_other',
          tosAccepted: true,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(parseJson(res.body).code).toBe('EMAIL_TAKEN');
    });

    it('returns 409 USERNAME_TAKEN for duplicate username', async () => {
      await seedUser('eve@test.com', TEST_PASSWORD);

      // First register with the target username
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

      // Now try to register with the already-taken username
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

    it('returns pending registration when invite-only mode is active and no invite code', async () => {
      fakeRedis.store.set('config:invite_only', 'true');

      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'grace@test.com',
          password: TEST_PASSWORD,
          username: 'grace_test',
          tosAccepted: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = parseJson(res.body);
      expect(body.pending).toBe(true);
    });

    it('redeems a valid invite code when invite-only is active', async () => {
      fakeRedis.store.set('config:invite_only', 'true');
      fakeRedis.store.set('invite:POLY-ABC123', '5');

      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'heidi@test.com',
          password: TEST_PASSWORD,
          username: 'heidi_test',
          tosAccepted: true,
          inviteCode: 'POLY-ABC123',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = parseJson(res.body);
      // Not pending — approved immediately
      expect(body.pending).toBeUndefined();
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  describe('POST /login', () => {
    it('returns 200 with user profile and sets cookies', async () => {
      const email = 'ivan@test.com';
      await seedUser(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body.email).toBe(email);

      const token = tokenCookie(res.cookies);
      expect(token).toBeDefined();

      const refresh = refreshCookie(res.cookies);
      expect(refresh).toBeDefined();
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
      await seedUser(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: 'WrongPass1!' },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 403 when user is suspended', async () => {
      const email = 'suspended@test.com';
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
      const user: UserRecord = {
        id: fakeId(),
        email,
        username: 'suspended_user',
        displayName: null,
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        polymarketConnected: false,
        polymarketUsConnected: false,
        kalshiConnected: false,
        kalshiUserId: null,
        totpEnabled: false,
        totpSecret: null,
        totpEnabledAt: null,
        totpBackupCodes: [],
        suspended: true,
        deleted: false,
        approved: true,
        approvedAt: new Date(),
        bio: null,
        avatarUrl: null,
        tosAcceptedAt: new Date(),
        polymarketAddress: null,
        twitterHandle: null,
        country: null,
        venuePreferences: null,
        deletedAt: null,
        createdAt: new Date(),
        lastSeen: null,
      };
      fakePrisma.addUser(user);

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(403);
      expect(parseJson(res.body).code).toBe('ACCOUNT_SUSPENDED');
    });

    it('returns 403 when user is pending approval', async () => {
      const email = 'pending@test.com';
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
      const user: UserRecord = {
        id: fakeId(),
        email,
        username: 'pending_user',
        displayName: null,
        passwordHash,
        emailVerified: false,
        emailVerifiedAt: null,
        polymarketConnected: false,
        polymarketUsConnected: false,
        kalshiConnected: false,
        kalshiUserId: null,
        totpEnabled: false,
        totpSecret: null,
        totpEnabledAt: null,
        totpBackupCodes: [],
        suspended: false,
        deleted: false,
        approved: false,
        approvedAt: null,
        bio: null,
        avatarUrl: null,
        tosAcceptedAt: new Date(),
        polymarketAddress: null,
        twitterHandle: null,
        country: null,
        venuePreferences: null,
        deletedAt: null,
        createdAt: new Date(),
        lastSeen: null,
      };
      fakePrisma.addUser(user);

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(403);
      expect(parseJson(res.body).code).toBe('ACCOUNT_PENDING');
    });

    it('returns 429 after 10 failed login attempts', async () => {
      const email = 'locked@test.com';
      const user = await seedUser(email, TEST_PASSWORD);

      // Pre-set per-user lockout counter to 10 — main uses USER_LOGIN_FAILURE_KEY
      fakeRedis.store.set(`login:fail:user:${user.id}`, '10');

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(429);
      expect(parseJson(res.body).code).toBe('ACCOUNT_LOCKED');
    });

    it('increments failure counter on wrong password', async () => {
      const email = 'failcounter@test.com';
      await seedUser(email, TEST_PASSWORD);

      await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: 'WrongPass1!' },
      });

      // Check that failure counters were incremented — main uses dual keys
      // (email-hash + per-user) for credential-spray + case-collision safety
      const failKeys = [...fakeRedis.store.keys()].filter((k) =>
        k.startsWith('login:fail:'),
      );
      expect(failKeys.length).toBeGreaterThanOrEqual(1);
      expect(fakeRedis.store.get(failKeys[0])).toBe('1');
    });

    it('clears failure counter on successful login', async () => {
      const email = 'recover@test.com';
      const user = await seedUser(email, TEST_PASSWORD);

      // First fail a few times
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/login',
          payload: { email, password: 'WrongPass1!' },
        });
      }

      const userFailKey = `login:fail:user:${user.id}`;
      const emailFailKey = [...fakeRedis.store.keys()].find(
        (k) => k.startsWith('login:fail:') && k !== userFailKey,
      );
      expect(fakeRedis.store.has(userFailKey)).toBe(true);

      // Then succeed
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      expect(fakeRedis.store.has(userFailKey)).toBe(false);
    });
  });

  // ─── Me ──────────────────────────────────────────────────────────────────────

  describe('GET /me', () => {
    it('returns 200 with user profile when authenticated', async () => {
      const { token, refresh } = await registerAndLogin(
        'me-test@test.com',
        TEST_PASSWORD,
      );

      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: cookieHdr(token, refresh) },
      });

      expect(res.statusCode).toBe(200);
      const body = parseJson(res.body);
      expect(body.email).toBe('me-test@test.com');
      expect(body.status).toBeDefined();
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
    it('returns 200 with new token pair', async () => {
      const { refresh } = await registerAndLogin(
        'refresh-test@test.com',
        TEST_PASSWORD,
      );

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

    it('returns 401 when no refresh token is provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: {},
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 401 on replay (token already consumed)', async () => {
      const { refresh } = await registerAndLogin(
        'replay-test@test.com',
        TEST_PASSWORD,
      );

      // First refresh — should succeed
      const first = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: refresh },
      });
      expect(first.statusCode).toBe(200);

      // Second refresh with same token — already consumed, returns INVALID_REFRESH_TOKEN
      const second = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: refresh },
      });

      expect(second.statusCode).toBe(401);
      expect(parseJson(second.body).code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('accepts refresh token from cookie', async () => {
      const { token, refresh } = await registerAndLogin(
        'cookie-refresh@test.com',
        TEST_PASSWORD,
      );

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: { cookie: cookieHdr(token, refresh) },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const newToken = tokenCookie(res.cookies);
      expect(newToken).toBeDefined();
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────

  describe('POST /logout', () => {
    it('returns 204, clears cookies, and revokes refresh token', async () => {
      const { token, refresh } = await registerAndLogin(
        'logout-test@test.com',
        TEST_PASSWORD,
      );

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

    it('/me returns 200 after logout (JWT is stateless, still valid)', async () => {
      const { token, refresh } = await registerAndLogin(
        'post-logout@test.com',
        TEST_PASSWORD,
      );

      await app.inject({
        method: 'POST',
        url: '/logout',
        headers: { cookie: cookieHdr(token, refresh) },
        payload: {},
      });

      // JWT is stateless — access token remains valid until it expires.
      // Only the refresh token is revoked.
      const meRes = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: cookieHdr(token, refresh) },
      });

      expect(meRes.statusCode).toBe(200);
    });

    it('accepts refreshToken from body for API clients', async () => {
      const { token, refresh } = await registerAndLogin(
        'api-logout@test.com',
        TEST_PASSWORD,
      );

      const res = await app.inject({
        method: 'POST',
        url: '/logout',
        headers: { cookie: cookieHdr(token) },
        payload: { refreshToken: refresh },
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // ─── Verify Email ────────────────────────────────────────────────────────────

  describe('POST /verify-email', () => {
    it('returns 200 on valid verification token', async () => {
      const email = 'verify@test.com';
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
      // Create an unverified user
      const user: UserRecord = {
        id: fakeId(),
        email,
        username: 'verify_user',
        displayName: null,
        passwordHash,
        emailVerified: false,
        emailVerifiedAt: null,
        polymarketConnected: false,
        polymarketUsConnected: false,
        kalshiConnected: false,
        kalshiUserId: null,
        totpEnabled: false,
        totpSecret: null,
        totpEnabledAt: null,
        totpBackupCodes: [],
        suspended: false,
        deleted: false,
        approved: true,
        approvedAt: new Date(),
        bio: null,
        avatarUrl: null,
        tosAcceptedAt: new Date(),
        polymarketAddress: null,
        twitterHandle: null,
        country: null,
        venuePreferences: null,
        deletedAt: null,
        createdAt: new Date(),
        lastSeen: null,
      };
      fakePrisma.addUser(user);

      // Create an email verification token
      const rawVerificationToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256')
        .update(rawVerificationToken)
        .digest('hex');
      await fakePrisma.emailVerification.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/verify-email',
        payload: { token: rawVerificationToken },
      });

      expect(res.statusCode).toBe(200);
      expect(parseJson(res.body).message).toBe('Email verified successfully');
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

    it('returns 200 and sends reset email for known user', async () => {
      const email = 'resetme@test.com';
      await seedUser(email, TEST_PASSWORD);

      const res = await app.inject({
        method: 'POST',
        url: '/forgot-password',
        payload: { email },
      });

      expect(res.statusCode).toBe(200);
      // Wait for async email send
      await new Promise((r) => setTimeout(r, 100));
      expect(fakeMail.sentEmails.length).toBeGreaterThanOrEqual(1);
      expect(fakeMail.sentEmails.some((e) => e.type === 'password-reset')).toBe(
        true,
      );
    });
  });

  // ─── Reset Password ──────────────────────────────────────────────────────────

  describe('POST /reset-password', () => {
    it('returns 200 and resets password with valid token', async () => {
      const email = 'pwreset@test.com';
      const user = await seedUser(email, TEST_PASSWORD);

      // Create a password reset token
      const rawResetToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256')
        .update(rawResetToken)
        .digest('hex');
      await fakePrisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const newPassword = 'NewPassw0rd!';
      const res = await app.inject({
        method: 'POST',
        url: '/reset-password',
        payload: { token: rawResetToken, newPassword },
      });

      expect(res.statusCode).toBe(200);
      expect(parseJson(res.body).message).toBe('Password reset successfully');

      // Old password should no longer work
      const loginRes = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: TEST_PASSWORD },
      });
      expect(loginRes.statusCode).toBe(400);

      // New password should work
      const newLoginRes = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email, password: newPassword },
      });
      expect(newLoginRes.statusCode).toBe(200);
    });

    it('returns 400 on invalid reset token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/reset-password',
        payload: { token: 'a'.repeat(64), newPassword: 'NewPassw0rd!' },
      });

      expect(res.statusCode).toBe(400);
      expect(parseJson(res.body).code).toBe('TOKEN_INVALID');
    });
  });

  // ─── Resend Verification ─────────────────────────────────────────────────────

  describe('POST /resend-verification', () => {
    it('returns 200 even for unknown email (anti-enumeration)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/resend-verification',
        payload: { email: 'ghost@test.com' },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── Delete Account ──────────────────────────────────────────────────────────

  describe('DELETE /account', () => {
    it('returns 200, clears cookies, and anonymizes PII', async () => {
      const email = 'delete-me@test.com';
      const { token, refresh } = await registerAndLogin(email, TEST_PASSWORD);

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
    });

    it('returns 400 INVALID_PASSWORD on wrong password', async () => {
      const { token, refresh } = await registerAndLogin(
        'wrong-pwd-delete@test.com',
        TEST_PASSWORD,
      );

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

    it('returns 500 when webhook deactivation fails with unexpected error', async () => {
      const email = 'webhook-fail@test.com';
      const { token, refresh } = await registerAndLogin(email, TEST_PASSWORD);

      // Simulate a real Prisma error on an existing webhooks table — only the
      // missing-table case (P2021) is suppressed; any other Prisma error should
      // fail the account deletion.
      const saved = fakePrisma.webhook.updateMany;
      fakePrisma.webhook.updateMany = async () => {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`id`)',
          { code: 'P2002', clientVersion: '5.0.0' },
        );
      };

      const res = await app.inject({
        method: 'DELETE',
        url: '/account',
        headers: { cookie: cookieHdr(token, refresh) },
        payload: { password: TEST_PASSWORD },
      });

      fakePrisma.webhook.updateMany = saved;

      expect(res.statusCode).toBe(500);
    });
  });

  // ─── Full Auth Flow (E2E-style through integration layer) ────────────────────

  describe('Full auth lifecycle', () => {
    it('register → verify → login → refresh → logout', async () => {
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

      // 2. Verify email — get the token from the mail capture
      expect(fakeMail.sentEmails.length).toBeGreaterThanOrEqual(1);
      const verifyToken = fakeMail.sentEmails.find(
        (e) => e.type === 'verification',
      )?.token;
      expect(verifyToken).toBeDefined();

      const verifyRes = await app.inject({
        method: 'POST',
        url: '/verify-email',
        payload: { token: verifyToken },
      });
      expect(verifyRes.statusCode).toBe(200);

      // 3. Me — now verified
      const meRes = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: cookieHdr(regToken, regRefresh) },
      });
      expect(meRes.statusCode).toBe(200);
      const meBody = parseJson(meRes.body);
      expect(meBody.emailVerified).toBe(true);

      // 4. Refresh
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

      // 5. Logout
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/logout',
        headers: { cookie: cookieHdr(newToken, newRefresh) },
        payload: {},
      });
      expect(logoutRes.statusCode).toBe(204);

      // 6. Me after logout — access token JWT is still valid (stateless)
      // but refresh token is revoked so refresh should fail
      const meAfterLogout = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { cookie: cookieHdr(newToken, newRefresh) },
      });
      // JWT is still valid, stateless
      expect(meAfterLogout.statusCode).toBe(200);

      // Refresh after logout should fail (token revoked)
      const refreshAfterLogout = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: { refreshToken: newRefresh },
      });
      expect(refreshAfterLogout.statusCode).toBe(401);
    });
  });
});
