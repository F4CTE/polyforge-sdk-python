import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BotLinkController } from './bot-link.controller';
import { BotLinkService } from './bot-link.service';

const REQUIRED_SCOPES = 'requiredScopes';

describe('BotLinkController', () => {
  let controller: BotLinkController;
  let botLinkService: BotLinkService;

  const user = {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'alice@example.com',
    username: 'alice',
  };

  beforeEach(() => {
    botLinkService = {
      generate: vi
        .fn()
        .mockResolvedValue({ code: '123456', expiresInSeconds: 300 }),
    } as unknown as BotLinkService;

    controller = new BotLinkController(botLinkService);
  });

  it('generate delegates to botLinkService.generate with userId', async () => {
    const result = await controller.generate(user);
    expect(botLinkService.generate).toHaveBeenCalledWith(user.sub);
    expect(result).toMatchObject({ code: '123456', expiresInSeconds: 300 });
  });

  it('generate requires a user session rather than a WRITE-scoped API key', () => {
    const method = BotLinkController.prototype.generate;
    const guards = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];

    expect(guards.map((guard: { name?: string }) => guard.name)).toEqual([
      'SessionOnlyGuard',
    ]);
    expect(Reflect.getMetadata(REQUIRED_SCOPES, method)).toBeUndefined();
  });
});
