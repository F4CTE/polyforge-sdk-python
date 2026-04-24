import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KalshiCredentialsController } from './kalshi-credentials.controller';
import { KalshiCredentialsService } from './kalshi-credentials.service';
import { faker } from '@faker-js/faker';

describe('KalshiCredentialsController', () => {
  let controller: KalshiCredentialsController;
  let service: KalshiCredentialsService;

  const user = {
    sub: faker.string.uuid(),
    email: 'alice@example.com',
    username: 'alice',
  };

  beforeEach(() => {
    service = {
      import: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as KalshiCredentialsService;

    controller = new KalshiCredentialsController(service);
  });

  it('import delegates to kalshiCreds.import with userId', async () => {
    const dto = { userId: 'usr_abc123' };
    await controller.import(user as any, dto);
    expect(service.import).toHaveBeenCalledWith(user.sub, dto);
  });

  it('delete delegates to kalshiCreds.delete', async () => {
    await controller.delete(user as any);
    expect(service.delete).toHaveBeenCalledWith(user.sub);
  });
});
