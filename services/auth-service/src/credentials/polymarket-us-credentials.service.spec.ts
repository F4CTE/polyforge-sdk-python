import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { PolymarketUsCredentialsService } from './polymarket-us-credentials.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';
import { userFactory } from '../../test/factories';
import { JwtService } from '@nestjs/jwt';

function makeMockConfig(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string, def: string) => overrides[key] ?? def),
    getOrThrow: vi.fn(
      (key: string) => overrides[key] ?? 'test-internal-jwt-secret',
    ),
  };
}

function makeMockJwt() {
  return {
    sign: vi.fn().mockReturnValue('mock-internal-jwt'),
  } as unknown as JwtService;
}

const validDto = {
  keyId: 'test-key-id-abc123',
  // 64-char hex string (32-byte Ed25519 seed)
  secretKey: 'a'.repeat(64),
};

describe('PolymarketUsCredentialsService', () => {
  let service: PolymarketUsCredentialsService;
  let db: MockDb;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    const config = makeMockConfig();
    const jwt = makeMockJwt();
    service = new PolymarketUsCredentialsService(db as any, config as any, jwt);

    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── import ────────────────────────────────────────────────────────────────

  describe('import', () => {
    it('forwards credentials to signer-service and marks user as US-connected', async () => {
      const user = userFactory({ polymarketUsConnected: false } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        polymarketUsConnected: true,
        country: 'US',
      } as any);
      fetchSpy.mockResolvedValue({ ok: true });

      await service.import(user.id, validDto, 'US');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/internal/us-credentials'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({
            polymarketUsConnected: true,
            country: 'US',
          }),
        }),
      );
    });

    it('omits country update when X-Country-Code header is absent', async () => {
      const user = userFactory({ polymarketUsConnected: false } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);
      fetchSpy.mockResolvedValue({ ok: true });

      await service.import(user.id, validDto, undefined);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ country: expect.anything() }),
        }),
      );
    });

    it('throws BAD_GATEWAY when signer-service returns error', async () => {
      const user = userFactory();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(
        service.import(user.id, validDto, 'US'),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_GATEWAY,
      });
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('throws SERVICE_UNAVAILABLE when signer-service is unreachable', async () => {
      const user = userFactory();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.import(user.id, validDto, 'US'),
      ).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('throws when user does not exist', async () => {
      db.user.findUniqueOrThrow.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.import('nonexistent', validDto, 'US'),
      ).rejects.toThrow();
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('stops US strategies, removes signer credentials, and marks user disconnected', async () => {
      const user = userFactory({ polymarketUsConnected: true } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        polymarketUsConnected: false,
      } as any);

      // First fetch: list running US strategies (empty list)
      // Second fetch: DELETE signer credentials
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({ ok: true });

      await service.delete(user.id);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { polymarketUsConnected: false },
        }),
      );
      // DELETE call to signer endpoint
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/internal/us-credentials/${user.id}`),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws CREDENTIALS_NOT_FOUND when user has no US credentials', async () => {
      const user = userFactory({ polymarketUsConnected: false } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(service.delete(user.id)).rejects.toMatchObject({
        response: { code: 'CREDENTIALS_NOT_FOUND' },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('proceeds with deletion even if strategy engine is unreachable', async () => {
      const user = userFactory({ polymarketUsConnected: true } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      // Strategy engine unreachable, signer responds OK
      fetchSpy
        .mockRejectedValueOnce(new TypeError('network error'))
        .mockResolvedValueOnce({ ok: true });

      await expect(service.delete(user.id)).resolves.toBeUndefined();
      expect(db.user.update).toHaveBeenCalled();
    });

    it('stops each running US strategy before deleting credentials', async () => {
      const user = userFactory({ polymarketUsConnected: true } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);

      const strategies = [{ id: 'strat-1' }, { id: 'strat-2' }];
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(strategies),
        })
        .mockResolvedValueOnce({ ok: true }) // stop strat-1
        .mockResolvedValueOnce({ ok: true }) // stop strat-2
        .mockResolvedValueOnce({ ok: true }); // signer delete

      await service.delete(user.id);

      // 1 list + 2 stops + 1 signer delete = 4 calls
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('throws BAD_GATEWAY when signer delete fails', async () => {
      const user = userFactory({ polymarketUsConnected: true } as any);
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(service.delete(user.id)).rejects.toMatchObject({
        status: HttpStatus.BAD_GATEWAY,
      });
      expect(db.user.update).not.toHaveBeenCalled();
    });
  });
});
