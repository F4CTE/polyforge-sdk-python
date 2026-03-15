import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { faker } from '@faker-js/faker';

describe('AdminAuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    beforeEach(() => {
        authService = {
            login: vi.fn(),
            logout: vi.fn().mockResolvedValue(undefined),
        } as unknown as AuthService;
        controller = new AuthController(authService);
    });

    describe('POST login', () => {
        it('delegates to authService.login and returns the result', async () => {
            const expected = { token: 'admin-jwt', admin: { id: '1', role: 'SUPER_ADMIN' } };
            vi.mocked(authService.login).mockResolvedValue(expected as any);
            const dto = { email: 'admin@polyforge.app', password: 'AdminPass1!' };

            const result = await controller.login(dto);
            expect(result).toBe(expected);
            expect(authService.login).toHaveBeenCalledWith(dto);
        });
    });

    describe('POST logout', () => {
        it('calls authService.logout with the Authorization header', async () => {
            const header = `Bearer ${faker.string.alphanumeric(32)}`;

            await controller.logout(header);
            expect(authService.logout).toHaveBeenCalledWith(header);
        });

        it('calls authService.logout with undefined when no header provided', async () => {
            await controller.logout(undefined as any);
            expect(authService.logout).toHaveBeenCalledWith(undefined);
        });
    });
});
