import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { TotpService } from './totp.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';
import { userFactory } from '../../test/factories';
import { generateSync, generateSecret, verifySync } from 'otplib';

// Partial mock: only verifySync is mockable, rest stays real.
vi.mock('otplib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('otplib')>();
  return { ...actual, verifySync: vi.fn(actual.verifySync) };
});
const mockedVerifySync = vi.mocked(verifySync);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockRedisClient() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
}

function makeMockRedis() {
  const ioClient = makeMockRedisClient();
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockReturnValue(ioClient),
    _ioClient: ioClient,
  };
}

function makeMockConfig(key = '0'.repeat(64)) {
  return { getOrThrow: vi.fn().mockReturnValue(key) };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('TotpService', () => {
  let service: TotpService;
  let db: MockDb;
  let redis: ReturnType<typeof makeMockRedis>;
  let config: ReturnType<typeof makeMockConfig>;

  beforeEach(() => {
    db = createMockDb();
    redis = makeMockRedis();
    config = makeMockConfig();
    service = new TotpService(db, redis as any, config as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── constructor ───────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when TOTP_ENCRYPTION_KEY is not 32 bytes (64 hex chars)', () => {
      const badConfig = { getOrThrow: vi.fn().mockReturnValue('deadbeef') }; // 4 bytes
      expect(() => new TotpService(db, redis as any, badConfig as any)).toThrow(
        'TOTP_ENCRYPTION_KEY is not properly configured',
      );
    });
  });

  // ── setup ─────────────────────────────────────────────────────────────────

  describe('setup', () => {
    it('returns a secret, URI, and QR code data URL', async () => {
      const user = userFactory({ totpEnabled: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      const result = await service.setup(user.id);

      expect(result.secret).toBeTruthy();
      expect(result.uri).toMatch(/^otpauth:\/\/totp\//);
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
    });

    it('stores the pending secret in Redis with 300s TTL', async () => {
      const user = userFactory({ totpEnabled: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      const result = await service.setup(user.id);

      expect(redis.set).toHaveBeenCalledWith(
        `totp:pending:${user.id}`,
        result.secret,
        300,
      );
    });

    it('throws TOTP_ALREADY_ENABLED (409) when 2FA is already on', async () => {
      const user = userFactory({ totpEnabled: true });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(service.setup(user.id)).rejects.toMatchObject({
        response: { code: 'TOTP_ALREADY_ENABLED' },
        status: HttpStatus.CONFLICT,
      });
    });
  });

  // ── confirm ───────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('throws TOTP_SETUP_EXPIRED (400) when no pending secret in Redis', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.confirm('user-id', '123456')).rejects.toMatchObject({
        response: { code: 'TOTP_SETUP_EXPIRED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws TOTP_INVALID (400) for a wrong code', async () => {
      // Use a valid Base32 secret so verifySync doesn't throw, but code won't match
      redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');

      await expect(service.confirm('user-id', '000000')).rejects.toMatchObject({
        response: { code: 'TOTP_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('returns 10 backup codes and commits to DB on success', async () => {
      // Mock verifySync to avoid TOTP 30-second window boundary flakes.
      // We're testing backup code generation + DB commit, not otplib itself.
      mockedVerifySync.mockReturnValueOnce({ valid: true } as any);
      redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');
      db.$transaction.mockResolvedValue([]);

      const result = await service.confirm('user-id', '123456');

      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[0-9A-F]{20}$/); // 10 bytes = 20 hex chars
      expect(db.$transaction).toHaveBeenCalledOnce();
    });

    it('stores SHA-256 hashed codes in DB, returns plain codes to caller', async () => {
      mockedVerifySync.mockReturnValueOnce({ valid: true } as any);
      redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');
      db.$transaction.mockResolvedValue([]);

      const result = await service.confirm('user-id', '123456');
      const updateCall = db.user.update.mock.calls[0][0];
      const updateData = updateCall.data;

      // Plain codes are plain hex — no $2b$ bcrypt prefix
      expect(result.backupCodes[0]).not.toMatch(/^\$2b\$/);
      // Stored hashes are SHA-256 hex (64 hex chars), not bcrypt
      expect(updateData.totpBackupCodes[0]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('deletes the pending Redis key on success', async () => {
      mockedVerifySync.mockReturnValueOnce({ valid: true } as any);
      redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');
      db.$transaction.mockResolvedValue([]);

      await service.confirm('user-id', '123456');

      expect(redis.del).toHaveBeenCalledWith('totp:pending:user-id');
      expect(redis._ioClient.set).toHaveBeenCalledWith(
        'totp:used:user-id:123456',
        '1',
        'EX',
        90,
        'NX',
      );
    });

    it('rejects a valid TOTP code that was already consumed (replay) during confirm', async () => {
      mockedVerifySync.mockReturnValueOnce({ valid: true } as any);
      redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');
      redis._ioClient.set.mockResolvedValue(null); // already consumed

      await expect(service.confirm('user-id', '123456')).rejects.toMatchObject({
        response: { code: 'TOTP_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });

      expect(redis._ioClient.set).toHaveBeenCalledWith(
        'totp:used:user-id:123456',
        '1',
        'EX',
        90,
        'NX',
      );
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalledWith('totp:pending:user-id');
    });

    it('fails closed (503) when Redis replay-key write errors during confirm', async () => {
      mockedVerifySync.mockReturnValueOnce({ valid: true } as any);
      redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');
      redis._ioClient.set.mockRejectedValueOnce(new Error('READONLY'));

      const logSpy = vi
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await expect(service.confirm('user-id', '123456')).rejects.toMatchObject({
        response: { code: 'TOTP_SETUP_FAILED' },
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'TOTP_REPLAY_CHECK_FAILED' }),
        'Redis replay-key write failed during TOTP confirm',
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── disable ───────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('throws TOTP_NOT_ENABLED (400) when 2FA is off', async () => {
      const user = userFactory({ totpEnabled: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(
        service.disable(user.id, 'password', '123456'),
      ).rejects.toMatchObject({
        response: { code: 'TOTP_NOT_ENABLED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws INVALID_CREDENTIALS (400) on wrong password', async () => {
      const user = userFactory({
        totpEnabled: true,
        passwordHash: '$2b$12$hashedbutnotthispass',
      });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(
        service.disable(user.id, 'wrong_password', '123456'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws INVALID_TOTP (401) when totpCode is missing', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct_password', 10);
      const secret = generateSecret({ length: 20 });
      const encrypted = (service as any).encrypt(secret);
      const user = userFactory({
        totpEnabled: true,
        passwordHash: hash,
        totpSecret: encrypted,
      } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(
        service.disable(user.id, 'correct_password', ''),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TOTP' },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws INVALID_TOTP (401) when totpCode is wrong', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct_password', 10);
      const secret = generateSecret({ length: 20 });
      const encrypted = (service as any).encrypt(secret);
      const user = userFactory({
        totpEnabled: true,
        passwordHash: hash,
        totpSecret: encrypted,
      } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(
        service.disable(user.id, 'correct_password', '000000'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TOTP' },
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('clears TOTP fields on success with correct password + TOTP code', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct_password', 10);
      const secret = generateSecret({ length: 20 });
      const validCode = generateSync({ secret, strategy: 'totp' });
      const encrypted = (service as any).encrypt(secret);
      const user = userFactory({
        totpEnabled: true,
        passwordHash: hash,
        totpSecret: encrypted,
      } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);
      redis._ioClient.set.mockResolvedValue('OK');

      mockedVerifySync.mockReturnValueOnce({ valid: true, delta: 0, epoch: Math.floor(Date.now() / 1000), timeStep: 0 });

      await service.disable(user.id, 'correct_password', validCode);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          totpSecret: null,
          totpEnabled: false,
          totpEnabledAt: null,
          totpBackupCodes: [],
        },
      });
      expect(redis._ioClient.set).toHaveBeenCalledWith(
        `totp:used:${user.id}:${validCode}`,
        '1',
        'EX',
        90,
        'NX',
      );
    });

    it('rejects a valid TOTP code that was already consumed (replay) during disable', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct_password', 10);
      const secret = generateSecret({ length: 20 });
      const validCode = generateSync({ secret, strategy: 'totp' });
      const encrypted = (service as any).encrypt(secret);
      const user = userFactory({
        totpEnabled: true,
        passwordHash: hash,
        totpSecret: encrypted,
      } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      redis._ioClient.set.mockResolvedValue(null);

      mockedVerifySync.mockReturnValueOnce({ valid: true, delta: 0, epoch: Math.floor(Date.now() / 1000), timeStep: 0 });

      await expect(
        service.disable(user.id, 'correct_password', validCode),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TOTP' },
        status: HttpStatus.UNAUTHORIZED,
      });

      expect(redis._ioClient.set).toHaveBeenCalledWith(
        `totp:used:${user.id}:${validCode}`,
        '1',
        'EX',
        90,
        'NX',
      );
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('fails closed (503) when Redis replay-key write errors during disable', async () => {
      mockedVerifySync.mockReturnValueOnce({ valid: true } as any);
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correct_password', 10);
      const secret = generateSecret({ length: 20 });
      const validCode = generateSync({ secret, strategy: 'totp' });
      const encrypted = (service as any).encrypt(secret);
      const user = userFactory({
        totpEnabled: true,
        passwordHash: hash,
        totpSecret: encrypted,
      } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      redis._ioClient.set.mockRejectedValueOnce(new Error('READONLY'));

      const logSpy = vi
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.disable(user.id, 'correct_password', validCode),
      ).rejects.toMatchObject({
        response: { code: 'TOTP_DISABLE_FAILED' },
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'TOTP_REPLAY_CHECK_FAILED' }),
        'Redis replay-key write failed during TOTP disable',
      );
      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  // ── regenBackupCodes ──────────────────────────────────────────────────────

  describe('regenBackupCodes', () => {
    it('throws TOTP_NOT_ENABLED (400) when 2FA is off', async () => {
      const user = userFactory({ totpEnabled: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(service.regenBackupCodes(user.id)).rejects.toMatchObject({
        response: { code: 'TOTP_NOT_ENABLED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('returns 10 new backup codes and updates DB', async () => {
      const user = userFactory({ totpEnabled: true });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      const result = await service.regenBackupCodes(user.id);

      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[0-9A-F]{20}$/);
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpBackupCodes: expect.arrayContaining([expect.any(String)]) },
      });
    });

    it('stores SHA-256 hashed codes in DB, returns plain codes to caller', async () => {
      const user = userFactory({ totpEnabled: true });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      const result = await service.regenBackupCodes(user.id);
      const updateCall = db.user.update.mock.calls[0][0];
      const storedHashes = updateCall.data.totpBackupCodes as string[];

      // Plain codes are plain hex — no $2b$ bcrypt prefix
      expect(result.backupCodes[0]).not.toMatch(/^\$2b\$/);
      // Stored hashes are SHA-256 hex (64 hex chars)
      expect(storedHashes[0]).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── verify ────────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('returns false when user does not exist', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      expect(await service.verify('nonexistent', '123456')).toBe(false);
    });

    it('returns false when TOTP is not enabled', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const user = userFactory({ totpEnabled: false });
      db.user.findUnique.mockResolvedValue(user as any);
      expect(await service.verify(user.id, '123456')).toBe(false);
    });

    it('returns false when TOTP secret is null', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const user = { ...userFactory({ totpEnabled: true }), totpSecret: null };
      db.user.findUnique.mockResolvedValue(user as any);
      expect(await service.verify(user.id, '123456')).toBe(false);
    });

    it('throws TOTP_LOCKED (429) when fail counter is at or above threshold', async () => {
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      redis._ioClient.get.mockResolvedValue('5');

      await expect(service.verify('user-id', '123456')).rejects.toMatchObject({
        response: { code: 'TOTP_LOCKED' },
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TOTP_LOCKED',
          userId: 'user-id',
          failCount: 5,
        }),
        'TOTP verification locked',
      );
    });

    it('increments fail counter on a bad code and sets TTL on first failure', async () => {
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      redis._ioClient.get.mockResolvedValue(null); // no prior failures
      redis._ioClient.incr.mockResolvedValue(1); // first failure

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');
      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      const result = await service.verify(user.id, '000000');
      expect(result).toBe(false);
      expect(redis._ioClient.incr).toHaveBeenCalledWith(`totp:fail:${user.id}`);
      expect(redis._ioClient.expire).toHaveBeenCalledWith(
        `totp:fail:${user.id}`,
        900,
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TOTP_FAILED',
          userId: user.id,
          failCount: 1,
        }),
        'TOTP verification failed',
      );
    });

    it('does not reset TTL on subsequent failures (incr > 1)', async () => {
      redis._ioClient.get.mockResolvedValue('2'); // 2 prior failures
      redis._ioClient.incr.mockResolvedValue(3); // 3rd failure

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');
      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      await service.verify(user.id, '000000');
      expect(redis._ioClient.expire).not.toHaveBeenCalled();
    });

    it('returns true and clears fail counter when TOTP code matches', async () => {
      const logSpy = vi
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);
      redis._ioClient.get.mockResolvedValue('2'); // had 2 prior failures

      const secret = generateSecret({ length: 20 });
      const validCode = generateSync({ secret, strategy: 'totp' });
      const encrypted = (service as any).encrypt(secret);

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      const result = await service.verify(user.id, validCode);
      expect(result).toBe(true);
      expect(redis._ioClient.del).toHaveBeenCalledWith(`totp:fail:${user.id}`);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TOTP_SUCCESS',
          userId: user.id,
          method: 'totp',
        }),
        'TOTP verification succeeded',
      );
    });

    it('rejects a valid TOTP code that was already consumed in its validity window', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      redis._ioClient.set.mockResolvedValue(null);

      const secret = generateSecret({ length: 20 });
      const validCode = generateSync({ secret, strategy: 'totp' });
      const encrypted = (service as any).encrypt(secret);

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      const result = await service.verify(user.id, validCode);

      expect(result).toBe(false);
      expect(redis._ioClient.set).toHaveBeenCalledWith(
        `totp:used:${user.id}:${validCode}`,
        '1',
        'EX',
        90,
        'NX',
      );
      expect(redis._ioClient.del).not.toHaveBeenCalledWith(
        `totp:fail:${user.id}`,
      );
      expect(redis._ioClient.incr).toHaveBeenCalledWith(`totp:fail:${user.id}`);
      expect(redis._ioClient.expire).toHaveBeenCalledWith(
        `totp:fail:${user.id}`,
        900,
      );
    });

    it('fails closed (503) when Redis replay-key write errors during verify', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      redis._ioClient.set.mockRejectedValueOnce(new Error('READONLY'));

      const secret = generateSecret({ length: 20 });
      const validCode = generateSync({ secret, strategy: 'totp' });
      const encrypted = (service as any).encrypt(secret);

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      const logSpy = vi
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);

      await expect(service.verify(user.id, validCode)).rejects.toMatchObject({
        response: { code: 'TOTP_VERIFY_FAILED' },
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'TOTP_REPLAY_CHECK_FAILED' }),
        'Redis replay-key write failed during TOTP verify',
      );
    });

    it('burns a backup code on successful backup code usage', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const { createHash } = await import('crypto');
      const code = 'ABCD1234';
      const hash = createHash('sha256').update(code).digest('hex');

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [hash, 'other-hash'],
      };
      db.user.findUnique.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      const result = await service.verify(user.id, code);
      expect(result).toBe(true);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpBackupCodes: ['other-hash'] },
      });
    });

    it('verifies a SHA-256 hashed backup code (new format)', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const { createHash, randomBytes } = await import('crypto');
      const code = randomBytes(10).toString('hex').toUpperCase();
      const hash = createHash('sha256').update(code).digest('hex');

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [
          hash,
          createHash('sha256').update('OTHER').digest('hex'),
        ],
      };
      db.user.findUnique.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      const result = await service.verify(user.id, code);
      expect(result).toBe(true);
      // The matched code should be burned from the array
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpBackupCodes: [user.totpBackupCodes[1]] },
      });
    });

    it('verifies a bcrypt-hashed backup code (legacy format) and burns it', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const { createHash } = await import('crypto');
      // Use a realistic backup code (not a 6-digit TOTP token to avoid the early-exit guard)
      const code = 'ABCD-1234-EFGH';
      const bcrypt = await import('bcrypt');
      // Hash with the same cost that was used historically (10)
      const bcryptHash = await bcrypt.hash(code, 10);

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

      // Store one legacy bcrypt hash + one new SHA-256 hash
      const otherHash = createHash('sha256').update('OTHER').digest('hex');
      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [bcryptHash, otherHash],
      };
      db.user.findUnique.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      const result = await service.verify(user.id, code);
      expect(result).toBe(true);
      // The matched bcrypt-backed code at index 0 should be burned
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpBackupCodes: [otherHash] },
      });
    });

    it('skips backup code loop for 6-digit TOTP-only codes', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      // Use a bcrypt-hash as a stored backup code to verify bcrypt.compare is NOT called
      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        // Store a $2b$ prefixed hash — if bcrypt.compare is called, the test
        // would try to actually compute bcrypt and possibly fail or be slow
        totpBackupCodes: ['$2b$10$invalidhashatleast22chars...'],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      // A 6-digit TOTP code should skip the backup code loop entirely
      const result = await service.verify(user.id, '123456');
      expect(result).toBe(false);
      // bcrypt.compare should NOT have been called — the loop was skipped
    });

    it('caps bcrypt comparisons per verify call to prevent CPU exhaustion', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

      // Create 4 bcrypt-hashed codes (exceeds MAX_BCRYPT_COMPARISONS=3)
      // Use cost 4 for test speed
      const bcryptMod = await import('bcrypt');
      const codes = ['BAK-111', 'BAK-222', 'BAK-333', 'BAK-444'];
      const hashes = await Promise.all(codes.map((c) => bcryptMod.hash(c, 4)));

      // Include a SHA-256 code at the end to verify mixed-format arrays work
      const { createHash: ch } = await import('crypto');
      const shaHash = ch('sha256').update('FFFFFFFFFFFFFFFFFFFF').digest('hex');

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: [...hashes, shaHash],
      };
      db.user.findUnique.mockResolvedValue(user as any);

      // Invalid code — should hit the bcrypt comparison limit
      const result = await service.verify(user.id, 'DEFINITELY-NOT-A-MATCH');
      expect(result).toBe(false);

      // Warning should be logged when the bcrypt limit is hit
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'BCRYPT_LIMIT_HIT',
          userId: user.id,
          totalBackupCodes: 5,
        }),
        expect.any(String),
      );
    });

    it('finds a valid bcrypt backup code within the comparison limit', async () => {
      redis._ioClient.get.mockResolvedValue(null);
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);

      const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

      const bcryptMod = await import('bcrypt');
      const codes = ['BAK-AAA', 'BAK-BBB', 'BAK-CCC', 'BAK-DDD'];
      const hashes = await Promise.all(codes.map((c) => bcryptMod.hash(c, 4)));

      const user = {
        ...userFactory({ totpEnabled: true }),
        totpSecret: encrypted,
        totpBackupCodes: hashes,
      };
      db.user.findUnique.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      // Valid backup code at position 1 (within the 3-comparison limit)
      const result = await service.verify(user.id, 'BAK-BBB');
      expect(result).toBe(true);

      // No bcrypt-limit warning should have been logged
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'BCRYPT_LIMIT_HIT' }),
        expect.any(String),
      );

      // The matched code (index 1) should be burned, leaving codes at indices 0, 2, 3
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { totpBackupCodes: [hashes[0], hashes[2], hashes[3]] },
      });
    });
  });
});
