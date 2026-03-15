import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { faker } from '@faker-js/faker';

describe('CredentialsController', () => {
    let controller: CredentialsController;
    let credentialsService: CredentialsService;

    const user = { sub: faker.string.uuid(), email: 'alice@example.com', username: 'alice' };
    const dto = {
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        privateKey: '0x' + 'a'.repeat(64),
        sigType: 0 as const,
    };

    beforeEach(() => {
        credentialsService = {
            import: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
        } as unknown as CredentialsService;

        controller = new CredentialsController(credentialsService);
    });

    it('import delegates to credentialsService.import', async () => {
        await controller.import(user as any, dto);
        expect(credentialsService.import).toHaveBeenCalledWith(user.sub, dto);
    });

    it('delete delegates to credentialsService.delete', async () => {
        await controller.delete(user as any);
        expect(credentialsService.delete).toHaveBeenCalledWith(user.sub);
    });
});
