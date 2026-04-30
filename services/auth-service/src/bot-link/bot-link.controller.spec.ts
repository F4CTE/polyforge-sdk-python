import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotLinkController } from './bot-link.controller';
import { BotLinkService } from './bot-link.service';

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
    const result = await controller.generate(user as any);
    expect(botLinkService.generate).toHaveBeenCalledWith(user.sub);
    expect(result).toMatchObject({ code: '123456', expiresInSeconds: 300 });
  });
});
