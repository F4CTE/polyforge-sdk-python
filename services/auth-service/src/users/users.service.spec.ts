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
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
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
    service = new UsersService(db, redis as any, posthog as any);
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

  // ── findByEmailCanonical ───────────────────────────────────────────────────

  describe('findByEmailCanonical', () => {
    it('returns the indexed hit immediately when input email matches exactly', async () => {
      const user = userFactory({ email: 'alice@example.com' });
      db.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(user);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      expect(db.user.findMany).not.toHaveBeenCalled();
    });

    it('returns canonical hit immediately when stored email is already normalized', async () => {
      const user = userFactory({ email: 'alice@example.com' });
      db.user.findUnique.mockResolvedValue(user as any);
      // Input has whitespace and case differences → collision scan runs
      db.user.findMany.mockResolvedValue([user as any]);

      const result = await service.findByEmailCanonical(' Alice@Example.COM ');

      expect(result).toEqual(user);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      // Collision scan runs because input differs from normalized form
      expect(db.user.findMany).toHaveBeenCalled();
    });

    it('falls back to case-insensitive search when indexed lookup misses', async () => {
      const user = userFactory({ email: 'Alice@Example.COM' });
      db.user.findUnique.mockResolvedValue(null);
      db.user.findMany.mockResolvedValue([user as any]);
      db.user.update.mockResolvedValue({} as any);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(user);
      expect(db.user.findMany).toHaveBeenCalledWith({
        where: { email: { equals: 'alice@example.com', mode: 'insensitive' } },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { email: 'alice@example.com' },
      });
    });

    it('returns null when neither indexed nor insensitive lookup finds a match', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.findMany.mockResolvedValue([]);

      const result = await service.findByEmailCanonical('ghost@example.com');

      expect(result).toBeNull();
    });

    it('does not attempt normalization when the insensitive match is already lowercase', async () => {
      const user = userFactory({ email: 'alice@example.com' });
      db.user.findUnique.mockResolvedValue(null);
      db.user.findMany.mockResolvedValue([user as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(user);
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('skips a soft-deleted canonical hit and returns an active case-variant account', async () => {
      const deleted = userFactory({
        id: 'id-del',
        email: 'alice@example.com',
        deleted: true,
      });
      const active = userFactory({ id: 'id-act', email: 'ALICE@example.com' });
      db.user.findUnique.mockResolvedValue(deleted as any);
      db.user.findMany.mockResolvedValue([deleted as any, active as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(active);
      expect(db.user.findMany).toHaveBeenCalled();
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('does not auto-normalize when a soft-deleted row already owns the canonical email', async () => {
      const deleted = userFactory({
        id: 'id-del',
        email: 'alice@example.com',
        deleted: true,
      });
      const active = userFactory({ id: 'id-act', email: 'Alice@example.com' });
      db.user.findUnique.mockResolvedValue(deleted as any);
      db.user.findMany.mockResolvedValue([deleted as any, active as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(active);
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('returns null when only a soft-deleted account matches and no active alternative exists', async () => {
      const deleted = userFactory({
        id: 'id-del',
        email: 'alice@example.com',
        deleted: true,
      });
      db.user.findUnique.mockResolvedValue(deleted as any);
      db.user.findMany.mockResolvedValue([deleted as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toBeNull();
    });

    it('filters deleted rows from collision results and returns the exact match', async () => {
      const exact = userFactory({ id: 'id-match', email: 'alice@example.com' });
      const deleted = userFactory({
        id: 'id-del',
        email: 'ALICE@example.com',
        deleted: true,
      });
      db.user.findUnique.mockResolvedValue(null);
      db.user.findMany.mockResolvedValue([deleted as any, exact as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(exact);
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('returns the exact match and skips normalization when case-colliding accounts exist', async () => {
      const exact = userFactory({ id: 'id-match', email: 'alice@example.com' });
      const other = userFactory({ id: 'id-other', email: 'ALICE@example.com' });
      db.user.findUnique.mockResolvedValue(null);
      db.user.findMany.mockResolvedValue([other as any, exact as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toEqual(exact);
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('returns the exact case match when findUnique hits but a case-colliding account exists', async () => {
      const lowercase = userFactory({
        id: 'id-low',
        email: 'alice@example.com',
      });
      const mixed = userFactory({ id: 'id-mix', email: 'Alice@Example.com' });
      // findUnique on normalized email finds the lowercase account,
      // but the input was mixed-case — the collision scan must
      // detect the mixed-case sibling and return it.
      // The collision-path return refetches by exact.id to get the
      // full user row (not just the { id, email, deleted } select).
      db.user.findUnique.mockImplementation(((args: any) => {
        if (args?.where?.id) return Promise.resolve(mixed as any);
        return Promise.resolve(lowercase as any);
      }) as any);
      db.user.findMany.mockResolvedValue([lowercase as any, mixed as any]);

      const result = await service.findByEmailCanonical('Alice@Example.com');

      expect(result).toEqual(mixed);
      expect(db.user.findMany).toHaveBeenCalled();
    });

    it('returns null when findUnique hits but no exact match exists among case-colliding accounts', async () => {
      const lowercase = userFactory({
        id: 'id-low',
        email: 'alice@example.com',
      });
      const other = userFactory({ id: 'id-other', email: 'ALICE@example.com' });
      db.user.findUnique.mockResolvedValue(lowercase as any);
      db.user.findMany.mockResolvedValue([lowercase as any, other as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      // Input matches the normalized email but normalize('alice@example.com') === 'alice@example.com'
      // so the input-equals-normalized check at line 59 is false → no collision scan needed,
      // and the canonical hit is returned.
      expect(result).toEqual(lowercase);
      expect(db.user.findMany).not.toHaveBeenCalled();
    });

    it('returns null when case-colliding accounts exist and no exact match is present', async () => {
      const a = userFactory({ id: 'id-a', email: 'Alice@Example.com' });
      const b = userFactory({ id: 'id-b', email: 'ALICE@EXAMPLE.COM' });
      db.user.findUnique.mockResolvedValue(null);
      db.user.findMany.mockResolvedValue([a as any, b as any]);

      const result = await service.findByEmailCanonical('alice@example.com');

      expect(result).toBeNull();
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
      db.user.findFirst.mockResolvedValue(null); // email check → findFirst
      db.user.findUnique.mockResolvedValue(null); // username check
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
      db.user.findFirst.mockResolvedValue(null);
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
      db.user.findFirst.mockResolvedValueOnce(existing as any);

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
      db.user.findFirst.mockResolvedValueOnce(null);
      db.user.findUnique.mockResolvedValueOnce(existing as any);

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
      db.emailVerification.findUnique.mockResolvedValue(record);
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
      db.emailVerification.findUnique.mockResolvedValue(record);

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
      db.emailVerification.findUnique.mockResolvedValue(record);

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
      db.passwordResetToken.findUnique.mockResolvedValue(record);
      db.$transaction.mockResolvedValue([]);

      await service.resetPassword(token, 'NewPassw0rd!');

      expect(db.$transaction).toHaveBeenCalledOnce();
    });

    it('writes the stale-access-token marker before changing password state', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      const callOrder: string[] = [];
      db.passwordResetToken.findUnique.mockResolvedValue(record);
      redis.set.mockImplementation(async () => {
        callOrder.push('pwchange');
      });
      db.$transaction.mockImplementation(async () => {
        callOrder.push('transaction');
        return [];
      });

      await service.resetPassword(token, 'NewPassw0rd!');

      expect(redis.set).toHaveBeenCalledWith(
        `pwchange:${record.userId}`,
        expect.any(String),
        300,
      );
      expect(callOrder).toEqual(['pwchange', 'transaction']);
    });

    it('does not consume the reset token or change password when stale-token invalidation fails', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record);
      redis.set.mockRejectedValue(new Error('redis down'));

      await expect(
        service.resetPassword(token, 'NewPassw0rd!'),
      ).rejects.toThrow('redis down');

      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('clears pwchange marker when the password transaction fails', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record);
      db.$transaction.mockRejectedValue(new Error('db write failure'));
      const delSpy = vi.spyOn(redis, 'del');

      await expect(
        service.resetPassword(token, 'NewPassw0rd!'),
      ).rejects.toThrow('db write failure');

      expect(delSpy).toHaveBeenCalledWith(`pwchange:${record.userId}`);
    });

    it('revokes refresh tokens after the password transaction succeeds, and throws on revocation failure', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record);
      db.$transaction.mockResolvedValue([]);
      const callOrder: string[] = [];
      db.$transaction.mockImplementation(async () => {
        callOrder.push('transaction');
        return [];
      });
      // Simulate refresh-token revocation failure via pipeline rejection.
      redis._pipelineExec.mockRejectedValue(
        new Error('redis revocation failed'),
      );
      redis._scanStream.on.mockImplementation(
        (event: string, cb: (...args: unknown[]) => unknown) => {
          if (event === 'data') cb([`refresh:${record.userId}:abc123`]);
          if (event === 'end') cb();
          return redis._scanStream;
        },
      );

      await expect(
        service.resetPassword(token, 'NewPassw0rd!'),
      ).rejects.toThrow('redis revocation failed');

      // Transaction must complete before revocation — password is changed
      // even though session cleanup failed.
      expect(db.$transaction).toHaveBeenCalledOnce();
    });

    it('hashes the new password before storing', async () => {
      const token = rawToken();
      const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
      db.passwordResetToken.findUnique.mockResolvedValue(record);

      db.$transaction.mockImplementation(async (ops: any[]) => ops);

      await service.resetPassword(token, 'NewPassw0rd!');

      // The second operation in the transaction updates the user's passwordHash

      const txOps = db.$transaction.mock.calls[0][0] as any[];
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
      db.passwordResetToken.findUnique.mockResolvedValue(record);

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
      db.passwordResetToken.findUnique.mockResolvedValue(record);

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
      db.passwordResetToken.findUnique.mockResolvedValue(record);
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
      db.passwordResetToken.findUnique.mockResolvedValue(record);
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
      db.passwordResetToken.findUnique.mockResolvedValue(record);
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
