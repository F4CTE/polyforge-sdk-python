import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TotpService } from '../totp/totp.service';
import { RedisService } from '@polyforge/shared-redis';
import { PrismaService } from '@polyforge/shared-db';
import { Prisma } from '@prisma/client';
import { createMockMailService } from '../../test/helpers/mock-mail';
import { userFactory } from '../../test/factories';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeRegisterDto(overrides: Record<string, unknown> = {}) {
  return {
    email: 'alice@example.com',
    password: 'Passw0rd!',
    username: 'alice',
    tosAccepted: true,
    ...overrides,
  };
}

function makeLoginDto(overrides: Record<string, unknown> = {}) {
  return { email: 'alice@example.com', password: 'Passw0rd!', ...overrides };
}

function hashTokenForTest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let mailService: MailService;
  let totpService: TotpService;
  let config: ConfigService;
  let redis: RedisService;
  let prisma: PrismaService;

  beforeEach(() => {
    usersService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findByEmailInsensitive: vi.fn(),
      findByEmailCanonical: vi.fn(),
      findById: vi.fn(),
      validatePassword: vi.fn(),
      rehashIfNeeded: vi.fn().mockResolvedValue(undefined),
      createEmailVerificationToken: vi.fn().mockResolvedValue('a'.repeat(64)),
      verifyEmail: vi.fn(),
      createPasswordResetToken: vi.fn().mockResolvedValue('b'.repeat(64)),
      resetPassword: vi.fn(),
      findByUsername: vi.fn(),
    } as unknown as UsersService;

    jwtService = {
      sign: vi.fn().mockReturnValue('signed-jwt-token'),
    } as unknown as JwtService;

    mailService = createMockMailService() as MailService;

    totpService = {
      verify: vi.fn().mockResolvedValue(true),
    } as unknown as TotpService;

    config = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      getClient: vi.fn().mockReturnValue({
        decr: vi.fn(),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(0),
        xadd: vi.fn().mockResolvedValue('stream-id'),
        scanStream: vi.fn().mockReturnValue({
          on: vi.fn().mockImplementation(function (
            this: any,
            event: string,
            cb: (...args: unknown[]) => unknown,
          ) {
            if (event === 'end') cb();
            return this;
          }),
        }),
        pipeline: vi.fn().mockReturnValue({
          del: vi.fn(),
          exec: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as RedisService;

    prisma = {
      userLoginHistory: {
        create: vi.fn().mockResolvedValue({}),
      },
      strategy: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      apiKey: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      webhook: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      botConnection: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
      userCredential: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      kalshiCredential: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      polymarketUsCredential: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;

    service = new AuthService(
      usersService,
      jwtService,
      mailService,
      totpService,
      config,
      redis,
      prisma,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('returns a JWT and user profile on success', async () => {
      const user = userFactory({
        emailVerified: false,
        polymarketConnected: false,
      });
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());

      expect(result.token).toBe('signed-jwt-token');
      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);
      expect(result.user.username).toBe(user.username);
      expect(result.user.status).toBe('UNVERIFIED');
    });

    // Regression for POLA-1978 / PolyForge#1160 — JWT payloads MUST NOT carry
    // PII (email) because they get logged broadly by infra and SDKs.
    // The user object on the response body is allowed to carry email; only
    // the signed JWT payload is restricted.
    it('does NOT include email or other PII in the signed JWT payload (GDPR)', async () => {
      const user = userFactory();
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      await service.register(makeRegisterDto());

      const jwtPayload = vi.mocked(jwtService.sign).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(jwtPayload).not.toHaveProperty('email');
      expect(jwtPayload).not.toHaveProperty('phone');
      expect(jwtPayload).not.toHaveProperty('displayName');
      // Sanity: the non-PII identifiers we expect ARE present.
      expect(jwtPayload).toHaveProperty('sub', user.id);
      expect(jwtPayload).toHaveProperty('username', user.username);
    });

    it('never exposes passwordHash in the response', async () => {
      const user = userFactory();
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());

      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('$2b$');
    });

    it('sends a verification email fire-and-forget', async () => {
      const user = userFactory();
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      await service.register(makeRegisterDto());

      // Fire-and-forget: email is queued but may not be awaited yet
      await vi.waitFor(() => {
        expect(usersService.createEmailVerificationToken).toHaveBeenCalledWith(
          user.id,
        );
      });
    });

    it('does NOT fail registration when email sending throws', async () => {
      const user = userFactory();
      vi.mocked(usersService.create).mockResolvedValue(user as any);
      vi.mocked(usersService.createEmailVerificationToken).mockRejectedValue(
        new Error('SMTP down'),
      );

      // Registration should succeed even if email fails
      await expect(
        service.register(makeRegisterDto() as any),
      ).resolves.toBeDefined();
    });

    it('derives SUSPENDED status when user is suspended', async () => {
      const user = userFactory({ suspended: true, emailVerified: true });
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());
      expect(result.user.status).toBe('SUSPENDED');
    });

    it('derives CONNECTED status when polymarketConnected is true', async () => {
      const user = userFactory({
        polymarketConnected: true,
        emailVerified: true,
      });
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());
      expect(result.user.status).toBe('CONNECTED');
    });

    it('derives VERIFIED status when emailVerified is true', async () => {
      const user = userFactory({
        emailVerified: true,
        polymarketConnected: false,
      });
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());
      expect(result.user.status).toBe('VERIFIED');
    });
  });

  // ── register — invite-only mode ───────────────────────────────────────────

  describe('register (invite-only mode)', () => {
    beforeEach(() => {
      // Enable invite-only via Redis flag
      vi.mocked(redis.get).mockImplementation((key: string) =>
        key === 'config:invite_only'
          ? Promise.resolve('true')
          : Promise.resolve(null),
      );
    });

    it('returns a pending (unapproved) user when no invite code is provided', async () => {
      const user = userFactory({ approved: false });
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());

      expect(result.pending).toBe(true);
      expect(result.user.status).toBe('PENDING');
    });

    it('throws INVITE_INVALID (403) when invite code is not in Redis', async () => {
      // Lua script returns -1 when key doesn't exist
      const evalMock = vi.fn().mockResolvedValue(-1);
      vi.mocked(redis.getClient).mockReturnValue({
        eval: evalMock,
        xadd: vi.fn().mockResolvedValue('1-0'),
      } as any);

      await expect(
        service.register(makeRegisterDto({ inviteCode: 'POLY-AAAAAA' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'INVITE_INVALID' },
        status: 403,
      });
    });

    it('deletes the invite key when only 1 use remains', async () => {
      // Lua script returns 0 = single-use code consumed (key deleted atomically)
      const evalMock = vi.fn().mockResolvedValue(0);
      vi.mocked(redis.getClient).mockReturnValue({
        eval: evalMock,
        xadd: vi.fn().mockResolvedValue('1-0'),
      } as any);
      const user = userFactory();
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      await service.register(makeRegisterDto({ inviteCode: 'POLY-AAAAAA' }));

      // Lua script handles deletion atomically; eval was called with the invite key
      expect(evalMock).toHaveBeenCalled();
    });

    it('decrements the invite key when more than 1 use remains', async () => {
      // Lua script returns remaining uses after decrement (e.g. 2 remaining)
      const evalMock = vi.fn().mockResolvedValue(2);
      vi.mocked(redis.getClient).mockReturnValue({
        eval: evalMock,
        xadd: vi.fn().mockResolvedValue('1-0'),
      } as any);
      const user = userFactory();
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      await service.register(makeRegisterDto({ inviteCode: 'POLY-AAAAAA' }));

      expect(evalMock).toHaveBeenCalled();
    });

    it('respects env-var fallback when Redis flag is absent', async () => {
      vi.mocked(redis.get).mockResolvedValue(null); // no Redis flag
      vi.mocked(config.get).mockReturnValue('true'); // env var is true

      const user = userFactory({ approved: false });
      vi.mocked(usersService.create).mockResolvedValue(user as any);

      const result = await service.register(makeRegisterDto());

      expect(result.pending).toBe(true);
      expect(result.user.status).toBe('PENDING');
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns a JWT and user profile on valid credentials', async () => {
      const user = userFactory({ totpEnabled: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      const result = await service.login(makeLoginDto());

      expect(result.token).toBe('signed-jwt-token');
      expect(result.user.id).toBe(user.id);
      expect(result.requiresTotp).toBe(false);
    });

    it('throws INVALID_CREDENTIALS (400) when user does not exist', async () => {
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(null);

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAILED',
          ip: 'unknown',
          reason: 'unknown_or_deleted_user',
        }),
        'User login failed',
      );
    });

    it('throws INVALID_CREDENTIALS (400) when user is soft-deleted', async () => {
      const user = userFactory({ deleted: true });
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAILED',
          ip: 'unknown',
          reason: 'unknown_or_deleted_user',
        }),
        'User login failed',
      );
    });

    it('does NOT create Redis keys for unknown email (spray-safe — no per-email key growth)', async () => {
      const incr = vi.fn().mockResolvedValue(1);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(null);
      vi.mocked(redis.getClient).mockReturnValue({
        incr,
        expire: vi.fn().mockResolvedValue(1),
        xadd: vi.fn().mockResolvedValue('stream-id'),
      } as any);

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });

      expect(incr).not.toHaveBeenCalled();
    });

    it('throws ACCOUNT_SUSPENDED (403) when user is suspended', async () => {
      const user = userFactory({ suspended: true });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'ACCOUNT_SUSPENDED' },
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects unknown email with INVALID_CREDENTIALS regardless of Redis state (spray-safe)', async () => {
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(null);
      // Redis state is irrelevant — unknown accounts never read lockout keys
      vi.mocked(redis.get).mockResolvedValue('10');

      await expect(
        service.login(makeLoginDto({ email: 'alice@example.com' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('does NOT write Redis keys for unknown email (prevents keyspace growth via spray)', async () => {
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(null);
      vi.mocked(redis.get).mockResolvedValue('0');
      const client = {
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      };
      vi.mocked(redis.getClient).mockReturnValue(client as any);

      await expect(
        service.login(makeLoginDto({ email: 'unknown@example.com' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });

      expect(client.incr).not.toHaveBeenCalled();
      expect(client.expire).not.toHaveBeenCalled();
    });

    it('rejects login when the per-user lockout counter reaches the limit', async () => {
      const user = userFactory({ email: 'alice@example.com' });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(redis.get).mockImplementation((key: string) =>
        key === `login:fail:user:${user.id}`
          ? Promise.resolve('10')
          : Promise.resolve(null),
      );

      await expect(
        service.login(makeLoginDto({ email: 'alice@example.com' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'ACCOUNT_LOCKED' },
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('clears per-user lockout counter on successful login', async () => {
      const user = userFactory({
        email: 'alice@example.com',
        totpEnabled: false,
      });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(redis.get).mockImplementation((key: string) =>
        key === `login:fail:user:${user.id}`
          ? Promise.resolve('9')
          : Promise.resolve(null),
      );

      await service.login(makeLoginDto({ email: 'alice@example.com' }));

      expect(redis.del).toHaveBeenCalledWith(`login:fail:user:${user.id}`);
    });

    it('throws INVALID_CREDENTIALS (400) on wrong password', async () => {
      const user = userFactory({ suspended: false });
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(false);

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAILED',
          userId: user.id,
          ip: 'unknown',
          reason: 'invalid_password',
        }),
        'User login failed',
      );
    });

    it('enforces email-hash lockout counter alongside per-user counter', async () => {
      const user = userFactory({ email: 'alice@example.com' });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(redis.get).mockImplementation((key: string) => {
        // Email-hash counter at limit, per-user counter clean
        if (
          key ===
          'login:fail:ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976'
        ) {
          return Promise.resolve('10');
        }
        return Promise.resolve(null);
      });

      await expect(
        service.login(makeLoginDto({ email: 'alice@example.com' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'ACCOUNT_LOCKED' },
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('enforces both counters — blocks login when email-hash is at limit even if per-user is clean', async () => {
      const user = userFactory({
        email: 'alice@example.com',
        suspended: false,
        totpEnabled: false,
      });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(redis.get).mockImplementation((key: string) =>
        key ===
        'login:fail:ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976'
          ? Promise.resolve('10')
          : Promise.resolve(null),
      );

      await expect(
        service.login(makeLoginDto({ email: ' Alice@Example.COM ' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'ACCOUNT_LOCKED' },
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('increments the normalized email failure counter on wrong password', async () => {
      const user = userFactory({
        email: 'alice@example.com',
        suspended: false,
      });
      const incr = vi.fn().mockResolvedValue(1);
      const expire = vi.fn().mockResolvedValue(1);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(false);
      vi.mocked(redis.getClient).mockReturnValue({
        incr,
        expire,
        xadd: vi.fn().mockResolvedValue('stream-id'),
      } as any);

      await expect(
        service.login(makeLoginDto({ email: ' Alice@Example.COM ' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(incr).toHaveBeenCalledWith(
        'login:fail:ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976',
      );
      expect(incr).toHaveBeenCalledWith(`login:fail:user:${user.id}`);
      expect(expire).toHaveBeenCalledWith(
        'login:fail:ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976',
        900,
      );
      expect(expire).toHaveBeenCalledWith(`login:fail:user:${user.id}`, 900);
    });

    it('throws TOTP_REQUIRED (400) when 2FA is enabled but no code provided', async () => {
      const user = userFactory({ totpEnabled: true });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'TOTP_REQUIRED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('does NOT increment lockout counter on TOTP_REQUIRED (2FA challenge)', async () => {
      const user = userFactory({
        email: 'alice@example.com',
        totpEnabled: true,
      });
      const incr = vi.fn().mockResolvedValue(1);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(redis.getClient).mockReturnValue({
        incr,
        expire: vi.fn().mockResolvedValue(1),
        xadd: vi.fn().mockResolvedValue('stream-id'),
      } as any);

      await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
        response: { code: 'TOTP_REQUIRED' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(incr).not.toHaveBeenCalled();
    });

    it('sets requiresTotp=true when totpEnabled', async () => {
      const user = userFactory({ totpEnabled: true });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(totpService.verify).mockResolvedValue(true);

      // Provide a totpCode so the TOTP_REQUIRED guard passes
      const result = await service.login(makeLoginDto({ totpCode: '123456' }));
      expect(result.requiresTotp).toBe(true);
    });

    it('throws TOTP_INVALID (400) when 2FA code is wrong', async () => {
      const user = userFactory({ totpEnabled: true });
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(totpService.verify).mockResolvedValue(false);

      await expect(
        service.login(makeLoginDto({ totpCode: '999999' }) as any),
      ).rejects.toMatchObject({
        response: { code: 'TOTP_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TOTP_FAILED',
          userId: user.id,
          ip: 'unknown',
          reason: 'invalid_totp',
        }),
        'User TOTP verification failed',
      );
    });

    it('increments the normalized email failure counter when the 2FA code is wrong', async () => {
      const user = userFactory({
        email: 'alice@example.com',
        totpEnabled: true,
      });
      const incr = vi.fn().mockResolvedValue(2);
      const expire = vi.fn().mockResolvedValue(1);
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(totpService.verify).mockResolvedValue(false);
      vi.mocked(redis.getClient).mockReturnValue({
        incr,
        expire,
        xadd: vi.fn().mockResolvedValue('stream-id'),
      } as any);

      await expect(
        service.login(
          makeLoginDto({
            email: ' Alice@Example.COM ',
            totpCode: '999999',
          }) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: 'TOTP_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });
      expect(incr).toHaveBeenCalledWith(
        'login:fail:ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976',
      );
      expect(incr).toHaveBeenCalledWith(`login:fail:user:${user.id}`);
    });

    it('never exposes passwordHash in the response', async () => {
      const user = userFactory();
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      const result = await service.login(makeLoginDto());
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('does not throw when rehashIfNeeded fails (fire-and-forget catch)', async () => {
      const user = userFactory({ totpEnabled: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(usersService.rehashIfNeeded).mockRejectedValue(
        new Error('db error'),
      );

      await expect(service.login(makeLoginDto() as any)).resolves.toBeDefined();
    });

    it('includes status, polymarketConnected, emailVerified in response', async () => {
      const user = userFactory({
        emailVerified: true,
        polymarketConnected: false,
      });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      const result = await service.login(makeLoginDto());
      expect(result.user.status).toBeDefined();
      expect(result.user.polymarketConnected).toBe(false);
      expect(result.user.emailVerified).toBe(true);
    });

    it('emits LOGIN event to Redis stream after successful login (N-M6)', async () => {
      const user = userFactory({ totpEnabled: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      const xaddMock = redis.getClient().xadd;

      await service.login(makeLoginDto({ ip: '192.168.1.1' }));

      // xadd is fire-and-forget, so wait for it to be called
      await vi.waitFor(() => {
        expect(xaddMock).toHaveBeenCalledWith(
          'stream:auth:events',
          '*',
          'event',
          'LOGIN',
          'userId',
          user.id,
          'ip',
          '192.168.1.1',
          'ts',
          expect.any(String),
        );
      });
    });

    it('does not fail login when Redis xadd throws (fire-and-forget) (N-M6)', async () => {
      const user = userFactory({ totpEnabled: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      (redis.getClient().xadd as any).mockRejectedValue(
        new Error('Redis down'),
      );

      await expect(
        service.login(makeLoginDto({ ip: '10.0.0.1' }) as any),
      ).resolves.toBeDefined();
    });

    it('uses "unknown" as IP when ip is not provided (N-M6)', async () => {
      const user = userFactory({ totpEnabled: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      const xaddMock = redis.getClient().xadd;

      await service.login(makeLoginDto());

      await vi.waitFor(() => {
        expect(xaddMock).toHaveBeenCalledWith(
          'stream:auth:events',
          '*',
          'event',
          'LOGIN',
          'userId',
          user.id,
          'ip',
          'unknown',
          'ts',
          expect.any(String),
        );
      });
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('atomically consumes a refresh token so only one concurrent caller succeeds', async () => {
      const rawRefreshToken = 'existing-refresh-token';
      const tokenHash = hashTokenForTest(rawRefreshToken);
      const user = userFactory({
        id: 'user-1',
        deleted: false,
        suspended: false,
      });
      const lookupKey = `refresh_lookup:${tokenHash}`;
      const refreshKey = `refresh:${user.id}:${tokenHash}`;

      vi.mocked(redis.get).mockImplementation((key: string) =>
        key === lookupKey ? Promise.resolve(user.id) : Promise.resolve(null),
      );
      vi.mocked(usersService.findById).mockResolvedValue(user as any);

      let consumed = false;
      const evalCall = vi.fn().mockImplementation(async () => {
        if (consumed) return null;
        consumed = true;
        return user.id;
      });
      const scanStream = vi.fn().mockReturnValue({
        on: vi.fn().mockImplementation(function (
          this: any,
          event: string,
          cb: (...args: unknown[]) => unknown,
        ) {
          if (event === 'end') cb();
          return this;
        }),
      });
      const pipelineExec = vi.fn().mockResolvedValue([]);
      const pipeline = vi.fn().mockReturnValue({
        del: vi.fn(),
        exec: pipelineExec,
      });
      vi.mocked(redis.getClient).mockReturnValue({
        call: evalCall,
        scanStream,
        pipeline,
        xadd: vi.fn().mockResolvedValue('stream-id'),
      } as any);

      const [first, second] = await Promise.allSettled([
        service.refresh(rawRefreshToken),
        service.refresh(rawRefreshToken),
      ]);

      expect(first.status).toBe('fulfilled');
      expect(second.status).toBe('rejected');
      if (first.status === 'fulfilled') {
        expect(first.value.token).toBe('signed-jwt-token');
        expect(first.value.refreshToken).toEqual(expect.any(String));
      }
      if (second.status === 'rejected') {
        expect(second.reason).toMatchObject({
          response: { code: 'REFRESH_TOKEN_REPLAY' },
          status: HttpStatus.UNAUTHORIZED,
        });
      }
      expect(evalCall).toHaveBeenCalledTimes(2);
      expect(evalCall).toHaveBeenCalledWith(
        'EVAL',
        expect.any(String),
        2,
        refreshKey,
        lookupKey,
      );
      expect(usersService.findById).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(2);
      expect(scanStream).toHaveBeenCalledWith({
        match: `refresh:${user.id}:*`,
        count: 100,
      });
      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(pipelineExec).not.toHaveBeenCalled();
    });

    it('rejects a replayed refresh token without issuing a replacement token', async () => {
      const rawRefreshToken = 'replayed-refresh-token';
      const tokenHash = hashTokenForTest(rawRefreshToken);
      const userId = 'user-1';

      vi.mocked(redis.get).mockResolvedValue(userId);

      const evalCall = vi.fn().mockResolvedValue(null);
      vi.mocked(redis.getClient).mockReturnValue({
        call: evalCall,
        scanStream: vi.fn().mockReturnValue({
          on: vi.fn().mockImplementation(function (
            this: any,
            event: string,
            cb: (...args: unknown[]) => unknown,
          ) {
            if (event === 'end') cb();
            return this;
          }),
        }),
        pipeline: vi.fn().mockReturnValue({
          del: vi.fn(),
          exec: vi.fn().mockResolvedValue([]),
        }),
        xadd: vi.fn().mockResolvedValue('stream-id'),
      } as any);

      await expect(service.refresh(rawRefreshToken)).rejects.toMatchObject({
        response: { code: 'REFRESH_TOKEN_REPLAY' },
        status: HttpStatus.UNAUTHORIZED,
      });

      expect(evalCall).toHaveBeenCalledWith(
        'EVAL',
        expect.any(String),
        2,
        `refresh:${userId}:${tokenHash}`,
        `refresh_lookup:${tokenHash}`,
      );
      expect(usersService.findById).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(
        `refresh_lookup:${tokenHash}`,
      );
    });
  });

  // ── me ────────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns the full user profile', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);

      const result = await service.me(user.id);

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.bio).toBeDefined();
      expect(result.totpEnabled).toBeDefined();
    });

    it('throws UNAUTHORIZED (401) when user is not found', async () => {
      vi.mocked(usersService.findById).mockResolvedValue(null);

      await expect(service.me('non-existent-id')).rejects.toMatchObject({
        response: { code: 'UNAUTHORIZED' },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws UNAUTHORIZED (401) when user is soft-deleted', async () => {
      const user = userFactory({ deleted: true });
      vi.mocked(usersService.findById).mockResolvedValue(user as any);

      await expect(service.me(user.id)).rejects.toMatchObject({
        response: { code: 'UNAUTHORIZED' },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('never exposes passwordHash in the profile', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);

      const result = await service.me(user.id);
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('delegates to usersService.verifyEmail and returns success message', async () => {
      vi.mocked(usersService.verifyEmail).mockResolvedValue(undefined);
      const token = 'a'.repeat(64);

      const result = await service.verifyEmail({ token });
      expect(result.message).toContain('verified');
      expect(usersService.verifyEmail).toHaveBeenCalledWith(token);
    });

    it('propagates errors from usersService.verifyEmail', async () => {
      vi.mocked(usersService.verifyEmail).mockRejectedValue(
        Object.assign(new Error(), {
          response: { code: 'TOKEN_EXPIRED' },
          status: 400,
        }),
      );

      await expect(
        service.verifyEmail({ token: 'a'.repeat(64) }),
      ).rejects.toMatchObject({
        response: { code: 'TOKEN_EXPIRED' },
      });
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('returns a generic message when user exists (no enumeration)', async () => {
      const user = userFactory();
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );

      const result = await service.forgotPassword({ email: user.email });
      expect(result.message).toBeTruthy();
    });

    it('returns the same message when user does NOT exist (prevents enumeration)', async () => {
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'ghost@example.com',
      });
      expect(result.message).toBeTruthy();
    });

    it('triggers a password reset email when user exists', async () => {
      const user = userFactory({ deleted: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );

      await service.forgotPassword({ email: user.email });

      await vi.waitFor(() => {
        expect(usersService.createPasswordResetToken).toHaveBeenCalledWith(
          user.id,
        );
      });
    });

    it('does NOT trigger an email for deleted users', async () => {
      const user = userFactory({ deleted: true });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );

      await service.forgotPassword({ email: user.email });

      await new Promise((r) => setTimeout(r, 50)); // let fire-and-forget settle
      expect(usersService.createPasswordResetToken).not.toHaveBeenCalled();
    });

    it('does not throw when the reset email fails (fire-and-forget catch)', async () => {
      const user = userFactory({ deleted: false });
      vi.mocked(usersService.findByEmailCanonical).mockResolvedValue(
        user as any,
      );
      vi.mocked(usersService.createPasswordResetToken).mockRejectedValue(
        new Error('db error'),
      );

      await expect(
        service.forgotPassword({ email: user.email }),
      ).resolves.toBeDefined();
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('delegates to usersService.resetPassword and returns success message', async () => {
      vi.mocked(usersService.resetPassword).mockResolvedValue('user-1');
      const dto = { token: 'a'.repeat(64), newPassword: 'NewPassw0rd!' };

      const result = await service.resetPassword(dto);
      expect(result.message).toContain('reset');
      expect(usersService.resetPassword).toHaveBeenCalledWith(
        dto.token,
        dto.newPassword,
      );
    });

    it('propagates errors from usersService.resetPassword', async () => {
      vi.mocked(usersService.resetPassword).mockRejectedValue(
        Object.assign(new Error(), {
          response: { code: 'TOKEN_INVALID' },
          status: 400,
        }),
      );

      await expect(
        service.resetPassword({
          token: 'a'.repeat(64),
          newPassword: 'NewPassw0rd!',
        } as any),
      ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
    });
  });

  // ── status derivation (edge cases) ────────────────────────────────────────

  describe('deriveUserStatus (priority order)', () => {
    const statuses = [
      {
        desc: 'SUSPENDED beats CONNECTED and VERIFIED',
        user: {
          suspended: true,
          polymarketConnected: true,
          emailVerified: true,
        },
        expected: 'SUSPENDED',
      },
      {
        desc: 'CONNECTED beats VERIFIED when not suspended',
        user: {
          suspended: false,
          polymarketConnected: true,
          emailVerified: true,
        },
        expected: 'CONNECTED',
      },
      {
        desc: 'VERIFIED when email verified but not connected',
        user: {
          suspended: false,
          polymarketConnected: false,
          emailVerified: true,
        },
        expected: 'VERIFIED',
      },
      {
        desc: 'UNVERIFIED when nothing set',
        user: {
          suspended: false,
          polymarketConnected: false,
          emailVerified: false,
        },
        expected: 'UNVERIFIED',
      },
    ];

    statuses.forEach(({ desc, user: overrides, expected }) => {
      it(desc, async () => {
        const user = userFactory(overrides);
        vi.mocked(usersService.create).mockResolvedValue(user as any);

        const result = await service.register(makeRegisterDto());
        expect(result.user.status).toBe(expected);
      });
    });
  });

  // ── deleteAccount (GDPR erasure) ──────────────────────────────────────────

  describe('deleteAccount', () => {
    const PASSWORD = 'Passw0rd!';

    it('anonymizes PII fields and emits USER_DELETED event', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      await service.deleteAccount(user.id, PASSWORD);

      // Credential tables are purged before anonymization
      expect(prisma.userCredential.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
      expect(prisma.kalshiCredential.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
      expect(prisma.polymarketUsCredential.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id },
      });

      const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: user.id });
      expect(updateCall.data.email).toMatch(/^deleted-[a-f0-9]+@anon\.local$/);
      expect(updateCall.data.username).toMatch(/^del_[a-f0-9]+$/);
      expect(updateCall.data.passwordHash).toBe('');
      expect(updateCall.data.displayName).toBeNull();
      expect(updateCall.data.bio).toBeNull();
      expect(updateCall.data.avatarUrl).toBeNull();
      expect(updateCall.data.twitterHandle).toBeNull();
      expect(updateCall.data.totpSecret).toBeNull();
      expect(updateCall.data.totpEnabled).toBe(false);
      expect(updateCall.data.totpBackupCodes).toEqual([]);
      expect(updateCall.data.venuePreferences).toBe(Prisma.DbNull);
      expect(updateCall.data.deleted).toBe(true);
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);

      const xaddMock = redis.getClient().xadd;
      expect(xaddMock).toHaveBeenCalledWith(
        'stream:auth:events',
        '*',
        'event',
        'USER_DELETED',
        'userId',
        user.id,
        'ts',
        expect.any(String),
      );
    });

    it('stops strategies and revokes API keys before erasing', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      await service.deleteAccount(user.id, PASSWORD);

      expect(prisma.strategy.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: user.id, status: 'RUNNING' },
        }),
      );
      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: user.id, revoked: false },
          data: expect.objectContaining({ revoked: true }),
        }),
      );
    });

    it('deactivates webhooks and bot connections', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      await service.deleteAccount(user.id, PASSWORD);

      expect(prisma.webhook.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, active: true },
        data: { active: false },
      });
      expect(prisma.botConnection.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, active: true },
        data: { active: false },
      });
    });

    it('throws INVALID_PASSWORD when password is wrong', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);
      vi.mocked(usersService.validatePassword).mockResolvedValue(false);

      await expect(service.deleteAccount(user.id, 'wrong')).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.userCredential.deleteMany).not.toHaveBeenCalled();
      expect(prisma.kalshiCredential.deleteMany).not.toHaveBeenCalled();
      expect(prisma.polymarketUsCredential.deleteMany).not.toHaveBeenCalled();
    });

    it('throws when user not found or already deleted', async () => {
      vi.mocked(usersService.findById).mockResolvedValue(null);

      await expect(service.deleteAccount('nope', PASSWORD)).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.userCredential.deleteMany).not.toHaveBeenCalled();
      expect(prisma.kalshiCredential.deleteMany).not.toHaveBeenCalled();
      expect(prisma.polymarketUsCredential.deleteMany).not.toHaveBeenCalled();
    });

    it('throws ACCOUNT_ERASURE_FAILED when credential purge fails', async () => {
      const user = userFactory();
      vi.mocked(usersService.findById).mockResolvedValue(user as any);
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);

      vi.mocked(prisma.userCredential.deleteMany).mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      await expect(
        service.deleteAccount(user.id, PASSWORD),
      ).rejects.toMatchObject({
        response: {
          code: 'ACCOUNT_ERASURE_FAILED',
          message: 'Failed to purge account credentials — please retry',
        },
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
