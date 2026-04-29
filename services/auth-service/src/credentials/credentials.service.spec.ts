import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
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

const verifiedUser = () =>
  userFactory({ emailVerified: true, polymarketConnected: false });
const connectedUser = () =>
  userFactory({ emailVerified: true, polymarketConnected: true });

const validDto = {
  walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
  privateKey: '0x' + 'a'.repeat(64),
  sigType: 0 as const,
  apiKey: 'key',
  apiSecret: 'secret',
  apiPassphrase: 'pass',
};

describe('CredentialsService', () => {
  let service: CredentialsService;
  let db: MockDb;
  let config: ReturnType<typeof makeMockConfig>;
  let jwt: JwtService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    config = makeMockConfig();
    jwt = makeMockJwt();
    service = new CredentialsService(db as any, config as any, jwt);

    // Mock global fetch
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── import ────────────────────────────────────────────────────────────────

  describe('import', () => {
    it('allows credential import for unverified users (graceful degradation)', async () => {
      // Unverified users are no longer hard-blocked — they can connect Polymarket
      // credentials and are encouraged to verify via the UI.
      const user = userFactory({ emailVerified: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        polymarketConnected: true,
      } as any);
      fetchSpy.mockResolvedValue({ ok: true });

      await expect(service.import(user.id, validDto)).resolves.toBeUndefined();
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ polymarketConnected: true }),
        }),
      );
    });

    it('calls signer-service and marks user as connected on success', async () => {
      const user = verifiedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        polymarketConnected: true,
      } as any);
      fetchSpy.mockResolvedValue({ ok: true });

      await service.import(user.id, validDto);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/credentials'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ polymarketConnected: true }),
        }),
      );
    });

    it('throws SIGNER_ERROR (502) when signer-service returns non-OK', async () => {
      const user = verifiedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(service.import(user.id, validDto)).rejects.toMatchObject({
        response: { code: 'SIGNER_ERROR' },
        status: HttpStatus.BAD_GATEWAY,
      });
    });

    it('throws SIGNER_UNAVAILABLE (503) when signer-service is unreachable', async () => {
      const user = verifiedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.import(user.id, validDto)).rejects.toMatchObject({
        response: { code: 'SIGNER_UNAVAILABLE' },
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws CREDENTIALS_NOT_FOUND (404) when user is not connected', async () => {
      const user = userFactory({ polymarketConnected: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(service.delete(user.id)).rejects.toMatchObject({
        response: { code: 'CREDENTIALS_NOT_FOUND' },
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('stops running strategies before calling signer-service DELETE', async () => {
      const user = connectedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        polymarketConnected: false,
      } as any);

      // First fetch: list running strategies
      // Second fetch: stop strategy
      // Third fetch: delete from signer
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([{ id: 'strat-1' }]),
        })
        .mockResolvedValueOnce({ ok: true }) // stop strategy
        .mockResolvedValueOnce({ ok: true }); // delete from signer

      await service.delete(user.id);

      // Verify strategy engine was called to list running strategies
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `/internal/strategies?userId=${encodeURIComponent(user.id)}&status=RUNNING`,
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer'),
          }),
        }),
      );

      // Verify strategy was stopped
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/internal/strategies/strat-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('calls signer-service DELETE and disconnects user on success', async () => {
      const user = connectedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        polymarketConnected: false,
      } as any);
      // Strategy engine returns empty list, signer returns OK
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({ ok: true });

      await service.delete(user.id);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/credentials/${user.id}`),
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ polymarketConnected: false }),
        }),
      );
    });

    it('succeeds even if strategy engine is unreachable (logs warning)', async () => {
      const user = connectedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);
      // Strategy engine fails, signer succeeds
      fetchSpy
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ ok: true });

      await expect(service.delete(user.id)).resolves.toBeUndefined();
    });

    it('throws SIGNER_ERROR when signer returns 404 so stale routes cannot mask undeleted credentials', async () => {
      const user = connectedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue(user as any);
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(service.delete(user.id)).rejects.toMatchObject({
        response: { code: 'SIGNER_ERROR' },
        status: HttpStatus.BAD_GATEWAY,
      });
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('throws SIGNER_ERROR (502) when signer-service DELETE returns non-OK non-404', async () => {
      const user = connectedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(service.delete(user.id)).rejects.toMatchObject({
        response: { code: 'SIGNER_ERROR' },
        status: HttpStatus.BAD_GATEWAY,
      });
    });

    it('throws SIGNER_UNAVAILABLE (503) when signer-service is unreachable on delete', async () => {
      const user = connectedUser();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(service.delete(user.id)).rejects.toMatchObject({
        response: { code: 'SIGNER_UNAVAILABLE' },
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });
});
