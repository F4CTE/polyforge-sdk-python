import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolymarketUsCredentialsController } from './polymarket-us-credentials.controller';
import { PolymarketUsCredentialsService } from './polymarket-us-credentials.service';

describe('PolymarketUsCredentialsController', () => {
  let controller: PolymarketUsCredentialsController;
  let service: PolymarketUsCredentialsService;

  const user = {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'alice@example.com',
    username: 'alice',
  };

  const validDto = {
    keyId: 'test-key-id-abc123',
    secretKey: 'a'.repeat(64),
    usRailTermsAccepted: true,
    usRailTermsVersion: 'us-rail-2026-04-29',
  };

  beforeEach(() => {
    service = {
      import: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PolymarketUsCredentialsService;

    controller = new PolymarketUsCredentialsController(service);
  });

  describe('import', () => {
    it('delegates to usCredentials.import with userId, dto, country code, and request metadata', async () => {
      await controller.import(
        user,
        validDto,
        'US',
        'Mozilla/5.0',
        '203.0.113.10, 10.0.0.1',
        '10.0.0.2',
      );
      expect(service.import).toHaveBeenCalledWith(
        user.sub,
        validDto,
        'US',
        '203.0.113.10',
        'Mozilla/5.0',
      );
    });

    it('passes undefined country code when header is absent', async () => {
      await controller.import(
        user,
        validDto,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(service.import).toHaveBeenCalledWith(
        user.sub,
        validDto,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('delete', () => {
    it('delegates to usCredentials.delete with userId', async () => {
      await controller.delete(user);
      expect(service.delete).toHaveBeenCalledWith(user.sub);
    });
  });
});
