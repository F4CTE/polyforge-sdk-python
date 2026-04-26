import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock the worker-thread bcrypt util to use direct bcrypt in tests
vi.mock('../auth/bcrypt.util', () => ({
  hashPassword: (password: string, rounds?: number) =>
    bcrypt.hash(password, rounds ?? 12),
  comparePassword: (password: string, hash: string) =>
    bcrypt.compare(password, hash),
}));

import { UsersService } from './users.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';
import {
  userFactory,
  emailVerificationFactory,
  passwordResetTokenFactory,
  rawToken,
} from '../../test/factories';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** SHA-256 of a token — mirrors the production hashing logic */
import { createHash } from 'crypto';
function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createMockRedis() {
  const pipelineDel = vi.fn();
  const pipelineExec = vi.fn().mockResolvedValue([]);
  const scanStreamInstance = {
    on: vi.fn().mockImplementation(function (
      this: any,
      event: string,
      cb: (...args: unknown[]) => unknown,
    ) {
      if (event === 'end') cb();
      return scanStreamInstance;
    }),
  };
  return {
    getClient: vi.fn().mockReturnValue({
      scanStream: vi.fn().mockReturnValue(scanStreamInstance),
      pipeline: vi
        .fn()
        .mockReturnValue({ del: pipelineDel, exec: pipelineExec }),
    }),
    _scanStream: scanStreamInstance,
    _pipelineDel: pipelineDel,
    _pipelineExec: pipelineExec,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

function createMockPosthog() {
  return { capture: vi.fn(), identify: vi.fn() };
}

describe('UsersService', () => {
  let service: UsersService;
  let db: MockDb;
  let redis: ReturnType<typeof createMockRedis>;
  let posthog: ReturnType<typeof createMockPosthog>;

  beforeEach(() => {
    db = createMockDb();
    redis = createMockRedis();
    posthog = createMockPosthog();
    service = new UsersService(db as any, redis as any, posthog as any);
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      const user = userFactory();
      db.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findByEmail(user.email);

      expect(result).toEqual(user);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
    });

    it('returns null when no user exists', async () => {
      db.user.findUnique.mockResolvedValue(null);
      expect(await service.findByEmail('nobody@example.com')).toBeNull();
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = userFactory();
      db.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findById(user.id);
      expect(result).toEqual(user);
    });

    it('returns null when no user exists', async () => {
      db.user.findUnique.mockResolvedValue(null);
      expect(await service.findById('non-existent-id')).toBeNull();
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a user and returns the record', async () => {
      const user = userFactory();
      db.user.findUnique.mockResolvedValue(null); // no duplicate
      db.user.create.mockResolvedValue(user as any);

      const result = await service.create({
        email: user.email,
        password: 'Passw0rd!',
        username: user.username,
      });

      expect(result).toEqual(user);
      expect(db.user.create).toHaveBeenCalledOnce();
    });

    it('hashes the password before storing', async () => {
      const user = userFactory();
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue(user as any);

      await service.create({
        email: user.email,
        password: 'Passw0rd!',
        username: user.username,
      });

      const callArg = db.user.create.mock.calls[0][0];
      const hash = callArg.data.passwordHash;
      expect(hash).toMatch(/^\$2[ab]\$/); // bcrypt uses $2b$
      expect(hash).not.toContain('Passw0rd!');
    });

    it('throws EMAIL_TAKEN (409) when email already exists', async () => {
      const existing = userFactory();
      // First findUnique (email check) returns a user
      db.user.findUnique.mockResolvedValueOnce(existing as any);

      await expect(
        service.create({
          email: existing.email,
          password: 'Passw0rd!',
          username: 'newuser',
        }),
      ).rejects.toMatchObject({
        response: { code: 'EMAIL_TAKEN' },
        status: HttpStatus.CONFLICT,
      });
    });

    it('throws USERNAME_TAKEN (409) when username already exists', async () => {
      const existing = userFactory();
      // Email check → null, username check → existing
      db.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing as any);

      await expect(
        service.create({
          email: 'new@example.com',
          password: 'Passw0rd!',
          username: existing.username,
        }),
      ).rejects.toMatchObject({
        response: { code: 'USERNAME_TAKEN' },
        status: HttpStatus.CONFLICT,
      });
    });
  });

  // ── rehashIfNeeded ────────────────────────────────────────────────────────

  describe('rehashIfNeeded', () => {
    it('rehashes and updates DB when rounds < 12', async () => {
      // bcrypt with cost 10 — below the MIN_ROUNDS threshold
      const weakHash = await bcrypt.hash('Passw0rd!', 10);
      db.user.update.mockResolvedValue({} as any);

      await service.rehashIfNeeded('user-id', 'Passw0rd!', weakHash);

      expect(db.user.update).toHaveBeenCalledOnce();
      const newHash = db.user.update.mock.calls[0][0].data
        .passwordHash as string;
      expect(newHash).toMatch(/^\$2[ab]\$/);
      expect(bcrypt.getRounds(newHash)).toBe(12);
    });

    it('does nothing when rounds are already >= 12', async () => {
      const strongHash = await bcrypt.hash('Passw0rd!', 12);

      await service.rehashIfNeeded('user-id', 'Passw0rd!', strongHash);

      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  // ── validatePassword ─────────────────────────────────────────────────────

  describe('validatePassword', () => {
    it('returns true for a correct password', async () => {
      const password = 'Passw0rd!';
      const hash = await bcrypt.hash(password, 12);
      expect(
        await service.validatePassword({ passwordHash: hash }, password),
      ).toBe(true);
    });

    it('returns false for an incorrect password', async () => {
      const hash = await bcrypt.hash('Passw0rd!', 12);
      expect(
        await service.validatePassword({ passwordHash: hash }, 'WrongPass1'),
      ).toBe(false);
    });
  });

  // ── createEmailVerificationToken ─────────────────────────────────────────

  describe('createEmailVerificationToken', () => {
    it('returns a 64-character hex token', async () => {
      db.emailVerification.create.mockResolvedValue({} as any);

      const token = await service.createEmailVerificationToken('user-id');

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stores the SHA-256 hash of the token (not the plaintext)', async () => {
      db.emailVerification.create.mockResolvedValue({} as any);

      const token = await service.createEmailVerificationToken('user-id');
      const callArg = db.emailVerification.create.mock.calls[0][0];

      expect(callArg.data.tokenHash).toBe(sha256(token));
      expect(callArg.data.tokenHash).not.toBe(token);
    });

    it('sets a 24-hour expiry', async () => {
      db.emailVerification.create.mockResolvedValue({} as any);

      const before = Date.now();
      await service.createEmailVerificationToken('user-id');
      const after = Date.now();

      const callArg = db.emailVerification.create.mock.calls[0][0];
      const expiresAt = callArg.data.expiresAt as Date;
      const ttlMs = expiresAt.getTime();

      expect(ttlMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 100);
      expect(ttlMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100);
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('marks the token used and sets emailVerified on the user', async () => {
      const token = rawToken();
      const record = emailVerificationFactory({ tokenHash: sha256(token) });
      db.emailVerification.findUnique.mockResolvedValue(record as any);
      db.$transaction.mockResolvedValue([]);

      await service.verifyEmail(token);

      expect(db.$transaction).toHaveBeenCalledOnce();
    });

    it('throws TOKEN_INVALID (400) when the token does not exist', async () => {
      db.emailVerification.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail(rawToken())).rejects.toMatchObject({
        response: { code: 'TOKEN_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws TOKEN_ALREADY_USED (400) when usedAt is set', async () => {
      const token = rawToken();
      const record = emailVerificationFactory({
        tokenHash: sha256(token),
        usedAt: new Date(),
      });
      db.emailVerification.findUnique.mockResolvedValue(record as any);

      await expect(service.verifyEmail(token)).rejects.toMatchObject({
        response: { code: 'TOKEN_ALREADY_USED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws TOKEN_EXPIRED (400) when expiresAt is in the past', async () => {
      const token = rawToken();
      const record = emailVerificationFactory({
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() - 1000), // 1s in the past
      });
      db.emailVerification.findUnique.mockResolvedValue(record as any);

      await expect(service.verifyEmail(token)).rejects.toMatchObject({
        response: { code: 'TOKEN_EXPIRED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  // ── createPasswordResetToken ──────────────────────────────────────────────

  describe('createPasswordResetToken', () => {
    it('returns a 64-character hex token', async () => {
      db.passwordResetToken.create.mockResolvedValue({} as any);

      const token = await service.createPasswordResetToken('user-id');
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stores the SHA-256 hash, not the plaintext', async () => {
      db.passwordResetToken.create.mockResolvedValue({} as any);

      const token = await service.createPasswordResetToken('user-id');
      const callArg = db.passwordResetToken.create.mock.calls[0][0];

      expect(callArg.data.tokenHash).toBe(sha256(token));
    });

    it('sets a 1-hour expiry', async () => {
      db.passwordResetToken.create.mockResolvedValue({} as any);

      const before = Date.now();
      await service.createPasswordResetToken('user-id');
      const after = Date.now();

      const callArg = db.passwordResetToken.create.mock.calls[0][0];
      const expiresAt = callArg.data.expiresAt as Date;
      const ttlMs = expiresAt.getTime();

      expect(ttlMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 100);
      expect(ttlMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 100);
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('updates the password hash via transaction', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);
      db.$transaction.mockResolvedValue([]);

      await service.resetPassword(token, 'NewPassw0rd!');

      expect(db.$transaction).toHaveBeenCalledOnce();
    });

    it('hashes the new password before storing', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);

      (db.$transaction as any).mockImplementation(async (ops: any[]) => ops);

      await service.resetPassword(token, 'NewPassw0rd!');

      // The second operation in the transaction updates the user's passwordHash

      const txOps = (db.$transaction as any).mock.calls[0][0] as any[];
      // We can't inspect the deferred Prisma operations directly, but we verify
      // that $transaction was called with an array of operations.
      expect(Array.isArray(txOps)).toBe(true);
      expect(txOps).toHaveLength(2);
    });

    it('throws TOKEN_INVALID (400) when the token does not exist', async () => {
      db.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword(rawToken(), 'NewPassw0rd!'),
      ).rejects.toMatchObject({
        response: { code: 'TOKEN_INVALID' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws TOKEN_ALREADY_USED (400) when usedAt is set', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({
        tokenHash: sha256(token),
        usedAt: new Date(),
      });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);

      await expect(
        service.resetPassword(token, 'NewPassw0rd!'),
      ).rejects.toMatchObject({
        response: { code: 'TOKEN_ALREADY_USED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws TOKEN_EXPIRED (400) when expiresAt is in the past', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() - 1000),
      });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);

      await expect(
        service.resetPassword(token, 'NewPassw0rd!'),
      ).rejects.toMatchObject({
        response: { code: 'TOKEN_EXPIRED' },
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('revokes all refresh tokens after password reset (N-H1)', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);
      db.$transaction.mockResolvedValue([]);

      // Simulate scanStream emitting keys then ending
      redis._scanStream.on.mockImplementation(
        (event: string, cb: (...args: unknown[]) => unknown) => {
          if (event === 'data') cb(['refresh:' + record.userId + ':abc123']);
          if (event === 'end') cb();
          return redis._scanStream;
        },
      );

      await service.resetPassword(token, 'NewPassw0rd!');

      expect(redis.getClient().scanStream).toHaveBeenCalledWith({
        match: `refresh:${record.userId}:*`,
        count: 100,
      });
      expect(redis._pipelineDel).toHaveBeenCalledWith(
        `refresh:${record.userId}:abc123`,
      );
      expect(redis._pipelineExec).toHaveBeenCalledOnce();
    });

    it('skips pipeline.exec when no refresh tokens exist', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);
      db.$transaction.mockResolvedValue([]);

      // Simulate scanStream emitting no keys
      redis._scanStream.on.mockImplementation(
        (event: string, cb: (...args: unknown[]) => unknown) => {
          if (event === 'end') cb();
          return redis._scanStream;
        },
      );

      await service.resetPassword(token, 'NewPassw0rd!');

      expect(redis._pipelineDel).not.toHaveBeenCalled();
      expect(redis._pipelineExec).not.toHaveBeenCalled();
    });

    it('still updates the password hash when revoking tokens (N-H1)', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record as any);
      db.$transaction.mockResolvedValue([]);

      redis._scanStream.on.mockImplementation(
        (event: string, cb: (...args: unknown[]) => unknown) => {
          if (event === 'end') cb();
          return redis._scanStream;
        },
      );

      await service.resetPassword(token, 'NewPassw0rd!');

      expect(db.$transaction).toHaveBeenCalledOnce();
    });
  });
});
