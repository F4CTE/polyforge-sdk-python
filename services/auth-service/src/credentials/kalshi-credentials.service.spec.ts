import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { KalshiCredentialsService } from './kalshi-credentials.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';
import { userFactory } from '../../test/factories';

describe('KalshiCredentialsService', () => {
  let service: KalshiCredentialsService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new KalshiCredentialsService(db);
  });

  describe('import', () => {
    it('stores kalshi userId and marks user as connected', async () => {
      const user = userFactory();
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        kalshiConnected: true,
        kalshiUserId: 'usr_abc',
      } as any);

      await service.import(user.id, { userId: 'usr_abc' });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { kalshiConnected: true, kalshiUserId: 'usr_abc' },
        }),
      );
    });

    it('throws if user does not exist', async () => {
      db.user.findUniqueOrThrow.mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.import('nonexistent', { userId: 'usr_abc' }),
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('clears kalshi credentials and marks user as disconnected', async () => {
      const user = userFactory({
        kalshiConnected: true,
        kalshiUserId: 'usr_x',
      });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);
      db.user.update.mockResolvedValue({
        ...user,
        kalshiConnected: false,
        kalshiUserId: null,
      } as any);

      await service.delete(user.id);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { kalshiConnected: false, kalshiUserId: null },
        }),
      );
    });

    it('throws CREDENTIALS_NOT_FOUND when user has no kalshi credentials', async () => {
      const user = userFactory({ kalshiConnected: false });
      db.user.findUniqueOrThrow.mockResolvedValue(user as any);

      await expect(service.delete(user.id)).rejects.toMatchObject({
        response: { code: 'CREDENTIALS_NOT_FOUND' },
        status: HttpStatus.NOT_FOUND,
      });
    });
  });
});
