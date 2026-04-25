import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolymarketUsCredentialsController } from './polymarket-us-credentials.controller';
import { PolymarketUsCredentialsService } from './polymarket-us-credentials.service';
import { faker } from '@faker-js/faker';

describe('PolymarketUsCredentialsController', () => {
  let controller: PolymarketUsCredentialsController;
  let service: PolymarketUsCredentialsService;

  const user = {
    sub: faker.string.uuid(),
    email: 'alice@example.com',
    username: 'alice',
  };

  const validDto = {
    keyId: 'test-key-id-abc123',
    secretKey: 'a'.repeat(64),
  };

  beforeEach(() => {
    service = {
      import: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PolymarketUsCredentialsService;

    controller = new PolymarketUsCredentialsController(service);
  });

  describe('import', () => {
    it('delegates to usCredentials.import with userId, dto, and country code', async () => {
      await controller.import(user as any, validDto, 'US');
      expect(service.import).toHaveBeenCalledWith(user.sub, validDto, 'US');
    });

    it('passes undefined country code when header is absent', async () => {
      await controller.import(user as any, validDto, undefined);
      expect(service.import).toHaveBeenCalledWith(
        user.sub,
        validDto,
        undefined,
      );
    });
  });

  describe('delete', () => {
    it('delegates to usCredentials.delete with userId', async () => {
      await controller.delete(user as any);
      expect(service.delete).toHaveBeenCalledWith(user.sub);
    });
  });
});
