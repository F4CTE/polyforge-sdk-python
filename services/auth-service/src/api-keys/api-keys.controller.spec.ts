import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let apiKeysService: ApiKeysService;

  const user = {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'alice@example.com',
    username: 'alice',
  };

  beforeEach(() => {
    apiKeysService = {
      create: vi.fn().mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        key: 'pf_abc123',
        prefix: 'pf_abc1',
        scopes: ['READ'],
        expiresAt: null,
        createdAt: new Date(),
      }),
      list: vi.fn().mockResolvedValue([]),
      revoke: vi.fn().mockResolvedValue({ revoked: true }),
    } as unknown as ApiKeysService;

    controller = new ApiKeysController(apiKeysService);
  });

  it('POST /api-keys delegates to service.create with correct userId and dto', async () => {
    const dto = { name: 'My Key', scopes: ['READ', 'TRADE'] };

    await controller.create(user, dto as any);

    expect(apiKeysService.create).toHaveBeenCalledWith(user.sub, dto);
  });

  it('POST /api-keys returns the service result including plaintext key', async () => {
    const dto = { name: 'My Key' };

    const result = await controller.create(user, dto);

    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('id');
  });

  it('GET /api-keys delegates to service.list with correct userId', async () => {
    await controller.list(user);

    expect(apiKeysService.list).toHaveBeenCalledWith(user.sub);
  });

  it('DELETE /api-keys/:id delegates to service.revoke with correct id and userId', async () => {
    const keyId = '00000000-0000-4000-8000-000000000002';

    await controller.revoke(user, keyId);

    expect(apiKeysService.revoke).toHaveBeenCalledWith(keyId, user.sub);
  });
});
