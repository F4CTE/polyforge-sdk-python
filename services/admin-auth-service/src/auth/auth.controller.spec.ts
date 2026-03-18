import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function makeReply() {
    return { setCookie: vi.fn(), clearCookie: vi.fn() } as any;
}

function makeReq(cookie?: string) {
    return { cookies: cookie ? { pf_admin_token: cookie } : {}, headers: {} } as any;
}

describe('AdminAuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    beforeEach(() => {
        authService = {
            login:  vi.fn(),
            logout: vi.fn().mockResolvedValue(undefined),
            getMe:  vi.fn(),
        } as unknown as AuthService;
        controller = new AuthController(authService);
    });

    describe('POST login', () => {
        it('delegates to authService.login, sets cookie, and returns admin profile', async () => {
            const serviceResult = { token: 'admin-jwt', admin: { id: '1', role: 'SUPER_ADMIN' } };
            vi.mocked(authService.login).mockResolvedValue(serviceResult as any);
            const dto = { email: 'admin@polyforge.app', password: 'AdminPass1!' };
            const reply = makeReply();

            const result = await controller.login(dto, reply);
            expect(result).toBe(serviceResult.admin);
            expect(reply.setCookie).toHaveBeenCalledWith('pf_admin_token', 'admin-jwt', expect.any(Object));
            expect(authService.login).toHaveBeenCalledWith(dto);
        });
    });

    describe('GET me', () => {
        it('delegates to authService.getMe with the cookie token', async () => {
            const admin = { id: '1', email: 'admin@polyforge.app', role: 'SUPER_ADMIN', displayName: 'Super Admin' };
            vi.mocked(authService.getMe).mockResolvedValue(admin as any);
            const req = makeReq('admin-jwt');

            const result = await controller.me(req);
            expect(result).toBe(admin);
            expect(authService.getMe).toHaveBeenCalledWith('admin-jwt');
        });

        it('throws UnauthorizedException when no cookie present', async () => {
            const req = makeReq();
            await expect(controller.me(req)).rejects.toThrow('Not authenticated');
        });
    });

    describe('POST logout', () => {
        it('calls authService.logout and clears the cookie', async () => {
            const req = makeReq('admin-jwt');
            const reply = makeReply();

            await controller.logout(req, reply);
            expect(authService.logout).toHaveBeenCalledWith('Bearer admin-jwt');
            expect(reply.clearCookie).toHaveBeenCalledWith('pf_admin_token', { path: '/' });
        });
    });
});
