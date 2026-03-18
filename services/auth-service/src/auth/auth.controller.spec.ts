import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { userFactory } from '../../test/factories';

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeAuthService(): AuthService {
    return {
        register: vi.fn(),
        login: vi.fn(),
        me: vi.fn(),
        verifyEmail: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
    } as unknown as AuthService;
}

function makeReply() {
    return { setCookie: vi.fn(), clearCookie: vi.fn() } as any;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    beforeEach(() => {
        authService = makeAuthService();
        controller = new AuthController(authService);
    });

    describe('POST register', () => {
        it('delegates to authService.register, sets cookie, and returns user', async () => {
            const serviceResult = { token: 'jwt', user: { id: '1' } };
            vi.mocked(authService.register).mockResolvedValue(serviceResult as any);
            const dto = { email: 'a@b.com', password: 'Passw0rd!', username: 'alice', tosAccepted: true };
            const reply = makeReply();

            const result = await controller.register(dto as any, reply);
            expect(result).toBe(serviceResult.user);
            expect(reply.setCookie).toHaveBeenCalledWith('pf_token', 'jwt', expect.any(Object));
            expect(authService.register).toHaveBeenCalledWith(dto);
        });
    });

    describe('POST login', () => {
        it('delegates to authService.login, sets cookie, and returns user', async () => {
            const serviceResult = { token: 'jwt', user: { id: '1' }, requiresTotp: false };
            vi.mocked(authService.login).mockResolvedValue(serviceResult as any);
            const dto = { email: 'a@b.com', password: 'Passw0rd!' };
            const reply = makeReply();

            const result = await controller.login(dto as any, reply);
            expect(result).toBe(serviceResult.user);
            expect(reply.setCookie).toHaveBeenCalledWith('pf_token', 'jwt', expect.any(Object));
            expect(authService.login).toHaveBeenCalledWith(dto);
        });
    });

    describe('GET me', () => {
        it('calls authService.me with the user id from JWT', async () => {
            const user = userFactory();
            const expected = { id: user.id, email: user.email, username: user.username };
            vi.mocked(authService.me).mockResolvedValue(expected as any);
            const jwtPayload = { sub: user.id, email: user.email, username: user.username };

            const result = await controller.me(jwtPayload as any);
            expect(result).toBe(expected);
            expect(authService.me).toHaveBeenCalledWith(user.id);
        });
    });

    describe('POST logout', () => {
        it('clears the cookie', async () => {
            const reply = makeReply();
            await controller.logout(reply);
            expect(reply.clearCookie).toHaveBeenCalledWith('pf_token', { path: '/' });
        });
    });

    describe('POST verify-email', () => {
        it('delegates to authService.verifyEmail', async () => {
            const expected = { message: 'Email verified successfully' };
            vi.mocked(authService.verifyEmail).mockResolvedValue(expected);
            const dto = { token: 'a'.repeat(64) };

            const result = await controller.verifyEmail(dto as any);
            expect(result).toBe(expected);
            expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
        });
    });

    describe('POST forgot-password', () => {
        it('delegates to authService.forgotPassword', async () => {
            const expected = { message: 'If that email exists, a reset link has been sent' };
            vi.mocked(authService.forgotPassword).mockResolvedValue(expected);
            const dto = { email: 'a@b.com' };

            const result = await controller.forgotPassword(dto as any);
            expect(result).toBe(expected);
        });
    });

    describe('POST reset-password', () => {
        it('delegates to authService.resetPassword', async () => {
            const expected = { message: 'Password reset successfully' };
            vi.mocked(authService.resetPassword).mockResolvedValue(expected);
            const dto = { token: 'a'.repeat(64), newPassword: 'NewPassw0rd!' };

            const result = await controller.resetPassword(dto as any);
            expect(result).toBe(expected);
            expect(authService.resetPassword).toHaveBeenCalledWith(dto);
        });
    });
});
