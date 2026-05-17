import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let db: MockDb;

  const makeRedis = () => ({
    getClient: () => ({
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    }),
  });

  beforeEach(() => {
    db = createMockDb();
    service = new ApiKeysService(db, makeRedis() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const userId = 'user-1';
    const dto = {
      name: 'My Bot Key',
      scopes: ['READ', 'TRADE'],
      expiresAt: '2027-01-01T00:00:00Z',
    };

    it('generates a key with pf_ prefix and returns plaintext key', async () => {
      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      const result = await service.create(userId, dto as any);

      expect(result.key).toMatch(/^pf_[a-f0-9]{64}$/);
      expect(result.id).toBe('key-1');
      expect(result.name).toBe('My Bot Key');
    });

    it('hashes the plaintext key with SHA256 and stores the hash in DB', async () => {
      const { createHash } = await import('crypto');

      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      const result = await service.create(userId, dto as any);

      const createCall = db.apiKey.create.mock.calls[0][0];
      const expectedHash = createHash('sha256')
        .update(result.key)
        .digest('hex');
      expect(createCall.data.tokenHash).toBe(expectedHash);
    });

    it('stores the first 7 characters as prefix (pf_ + 4 hex chars)', async () => {
      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      const result = await service.create(userId, dto as any);

      const createCall = db.apiKey.create.mock.calls[0][0];
      expect(createCall.data.prefix).toBe(result.key.slice(0, 7));
      expect(createCall.data.prefix).toMatch(/^pf_[a-f0-9]{4}$/);
    });

    it('stores correct scopes, name, and expiration', async () => {
      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      await service.create(userId, dto as any);

      const createCall = db.apiKey.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe(userId);
      expect(createCall.data.name).toBe('My Bot Key');
      expect(createCall.data.scopes).toEqual(['READ', 'TRADE']);
      expect(createCall.data.expiresAt).toEqual(
        new Date('2027-01-01T00:00:00Z'),
      );
    });

    it('defaults scopes to empty array when not provided', async () => {
      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      await service.create(userId, { name: 'No scopes' });

      const createCall = db.apiKey.create.mock.calls[0][0];
      expect(createCall.data.scopes).toEqual([]);
    });

    it('sets expiresAt to null when not provided', async () => {
      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      await service.create(userId, { name: 'No expiry' });

      const createCall = db.apiKey.create.mock.calls[0][0];
      expect(createCall.data.expiresAt).toBeNull();
    });

    it('throws CONFLICT (MAX_API_KEYS) when user has 10 active keys', async () => {
      db.apiKey.count.mockResolvedValue(10);

      await expect(service.create(userId, dto as any)).rejects.toMatchObject({
        response: { code: 'MAX_API_KEYS' },
        status: HttpStatus.CONFLICT,
      });

      expect(db.apiKey.create).not.toHaveBeenCalled();
    });

    it('allows creation when user has 9 active keys', async () => {
      db.apiKey.count.mockResolvedValue(9);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      const result = await service.create(userId, dto as any);

      expect(result.key).toBeDefined();
    });

    it('counts only non-revoked keys for the given user', async () => {
      db.apiKey.count.mockResolvedValue(0);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );

      await service.create(userId, dto as any);

      expect(db.apiKey.count).toHaveBeenCalledWith({
        where: { userId, revoked: false },
      });
    });
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all keys for user without tokenHash', async () => {
      const keys = [
        {
          id: 'key-1',
          name: 'Bot Key',
          prefix: 'pf_abcd',
          scopes: ['READ'],
          expiresAt: null,
          lastUsedAt: null,
          lastUsedIp: null,
          revoked: false,
          createdAt: new Date(),
        },
        {
          id: 'key-2',
          name: 'Trade Key',
          prefix: 'pf_efgh',
          scopes: ['READ', 'TRADE'],
          expiresAt: new Date('2027-01-01'),
          lastUsedAt: new Date(),
          lastUsedIp: '1.2.3.4',
          revoked: true,
          createdAt: new Date(),
        },
      ];

      db.apiKey.findMany.mockResolvedValue(keys as any);

      const result = await service.list('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('tokenHash');
      expect(result[1]).not.toHaveProperty('tokenHash');
    });

    it('queries with correct userId and orders by createdAt desc', async () => {
      db.apiKey.findMany.mockResolvedValue([]);

      await service.list('user-1');

      const call = db.apiKey.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('user-1');
      expect(call.orderBy.createdAt).toBe('desc');
    });

    it('uses select to exclude tokenHash from query', async () => {
      db.apiKey.findMany.mockResolvedValue([]);

      await service.list('user-1');

      const call = db.apiKey.findMany.mock.calls[0][0];
      expect(call.select.tokenHash).toBeUndefined();
      expect(call.select.id).toBe(true);
      expect(call.select.name).toBe(true);
      expect(call.select.prefix).toBe(true);
    });
  });

  // ── revoke ──────────────────────────────────────────────────────────────────

  describe('revoke', () => {
    it('sets revoked=true and revokedAt on a valid key', async () => {
      db.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        revoked: false,
      } as any);
      db.apiKey.update.mockResolvedValue({ revoked: true } as any);

      const result = await service.revoke('key-1', 'user-1');

      expect(result).toEqual({ revoked: true });
      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('throws NOT_FOUND (404) for unknown key id', async () => {
      db.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.revoke('nonexistent', 'user-1'),
      ).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('throws NOT_FOUND (404) when key belongs to a different user', async () => {
      db.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 'other-user',
        revoked: false,
      } as any);

      await expect(service.revoke('key-1', 'user-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
        status: HttpStatus.NOT_FOUND,
      });

      expect(db.apiKey.update).not.toHaveBeenCalled();
    });

    it('throws ALREADY_REVOKED (409) when key is already revoked', async () => {
      db.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        revoked: true,
      } as any);

      await expect(service.revoke('key-1', 'user-1')).rejects.toMatchObject({
        response: { code: 'ALREADY_REVOKED' },
        status: HttpStatus.CONFLICT,
      });

      expect(db.apiKey.update).not.toHaveBeenCalled();
    });
  });

  // ── rotateKey ─────────────────────────────────────────────────────────────

  describe('rotateKey', () => {
    const oldKey = {
      id: 'old-key-1',
      userId: 'user-1',
      name: 'Production Key',
      scopes: ['READ', 'TRADE'],
      expiresAt: null,
      revoked: false,
    };

    it('creates a new key and marks old key as deprecated', async () => {
      db.apiKey.findUnique.mockResolvedValue(oldKey as any);
      db.apiKey.count.mockResolvedValue(1);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'new-key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );
      db.apiKey.update.mockResolvedValue({} as any);

      const result = await service.rotateKey('old-key-1', 'user-1');

      expect(result.newKey.id).toBe('new-key-1');
      expect(result.newKey.key).toMatch(/^pf_/);
      expect(result.oldKeyId).toBe('old-key-1');
      expect(result.graceExpiresAt).toBeInstanceOf(Date);

      // Verify the old key was marked as deprecated
      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'old-key-1' },
        data: expect.objectContaining({
          deprecated: true,
          deprecatedAt: expect.any(Date),
          deprecatedExpiresAt: expect.any(Date),
        }),
      });
    });

    it('sets 24-hour grace period on deprecated key', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));

      db.apiKey.findUnique.mockResolvedValue(oldKey as any);
      db.apiKey.count.mockResolvedValue(1);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'new-key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );
      db.apiKey.update.mockResolvedValue({} as any);

      const result = await service.rotateKey('old-key-1', 'user-1');

      expect(result.graceExpiresAt).toEqual(new Date('2026-03-25T12:00:00Z'));

      vi.useRealTimers();
    });

    it('throws NOT_FOUND (404) for unknown key', async () => {
      db.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.rotateKey('nonexistent', 'user-1'),
      ).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('throws ALREADY_REVOKED (409) when key is already revoked', async () => {
      db.apiKey.findUnique.mockResolvedValue({
        ...oldKey,
        revoked: true,
      } as any);

      await expect(
        service.rotateKey('old-key-1', 'user-1'),
      ).rejects.toMatchObject({
        response: { code: 'ALREADY_REVOKED' },
        status: HttpStatus.CONFLICT,
      });
    });

    it('names the new key with (rotated) suffix', async () => {
      db.apiKey.findUnique.mockResolvedValue(oldKey as any);
      db.apiKey.count.mockResolvedValue(1);
      db.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'new-key-1',
          name: data.name,
          prefix: data.prefix,
          tokenHash: data.tokenHash,
          scopes: data.scopes,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        }),
      );
      db.apiKey.update.mockResolvedValue({} as any);

      const result = await service.rotateKey('old-key-1', 'user-1');

      expect(result.newKey.name).toBe('Production Key (rotated)');
    });
  });

  // ── revokeExpiredDeprecatedKeys (cron) ─────────────────────────────────────

  describe('revokeExpiredDeprecatedKeys', () => {
    it('revokes deprecated keys past grace period', async () => {
      db.apiKey.findMany.mockResolvedValue([
        { id: 'expired-1' },
        { id: 'expired-2' },
      ] as any);
      db.apiKey.updateMany.mockResolvedValue({ count: 2 });

      const count = await service.revokeExpiredDeprecatedKeys();

      expect(count).toBe(2);
      expect(db.apiKey.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['expired-1', 'expired-2'] } },
        data: {
          revoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('returns 0 when no deprecated keys have expired', async () => {
      db.apiKey.findMany.mockResolvedValue([]);

      const count = await service.revokeExpiredDeprecatedKeys();

      expect(count).toBe(0);
      expect(db.apiKey.updateMany).not.toHaveBeenCalled();
    });
  });
});
