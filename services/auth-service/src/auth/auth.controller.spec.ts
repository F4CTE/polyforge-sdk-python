import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { userFactory } from '../../test/factories';

const REQUIRED_SCOPES = 'requiredScopes';

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeAuthService(): AuthService {
  return {
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
    verifyEmail: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
}

function makeReply() {
  return { setCookie: vi.fn(), clearCookie: vi.fn() } as any;
}

function makeRequest(cookies: Record<string, string> = {}) {
  return { cookies, headers: {}, ip: '127.0.0.1' } as any;
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
      const dto = {
        email: 'a@b.com',
        password: 'Passw0rd!',
        username: 'alice',
        tosAccepted: true,
      };
      const reply = makeReply();

      const result = await controller.register(dto, reply);
      expect(result).toBe(serviceResult.user);
      expect(reply.setCookie).toHaveBeenCalledWith(
        'pf_token',
        'jwt',
        expect.any(Object),
      );
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST login', () => {
    it('delegates to authService.login, sets cookie, and returns user', async () => {
      const serviceResult = {
        token: 'jwt',
        refreshToken: 'rt',
        user: { id: '1' },
        requiresTotp: false,
      };
      vi.mocked(authService.login).mockResolvedValue(serviceResult as any);
      const dto = { email: 'a@b.com', password: 'Passw0rd!' };
      const request = makeRequest();
      const reply = makeReply();

      const result = await controller.login(dto, request, reply);
      expect(result).toBe(serviceResult.user);
      expect(reply.setCookie).toHaveBeenCalledWith(
        'pf_token',
        'jwt',
        expect.any(Object),
      );
      expect(authService.login).toHaveBeenCalled();
    });
  });

  describe('GET me', () => {
    it('calls authService.me with the user id from JWT', async () => {
      const user = userFactory();
      const expected = {
        id: user.id,
        email: user.email,
        username: user.username,
      };
      vi.mocked(authService.me).mockResolvedValue(expected as any);
      const jwtPayload = {
        sub: user.id,
        username: user.username,
      };

      const result = await controller.me(jwtPayload);
      expect(result).toBe(expected);
      expect(authService.me).toHaveBeenCalledWith(user.id);
    });
  });

  describe('DELETE account authz', () => {
    it('runs JwtAuthGuard before ApiKeyScopeGuard and requires WRITE scope', () => {
      const method = AuthController.prototype.deleteAccount;
      const guards = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];

      expect(guards.map((guard: { name?: string }) => guard.name)).toEqual([
        'JwtAuthGuard',
        'ApiKeyScopeGuard',
      ]);
      expect(Reflect.getMetadata(REQUIRED_SCOPES, method)).toEqual(['WRITE']);
    });
  });

  describe('POST logout', () => {
    it('clears both cookies', async () => {
      const reply = makeReply();
      const request = makeRequest();
      await controller.logout({}, request, reply);
      expect(reply.clearCookie).toHaveBeenCalledWith('pf_token', { path: '/' });
      expect(reply.clearCookie).toHaveBeenCalledWith('pf_refresh', {
        path: '/',
      });
    });

    it('revokes refresh token from body when provided (N-H2)', async () => {
      const reply = makeReply();
      const request = makeRequest();
      await controller.logout({ refreshToken: 'body-token' }, request, reply);
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith('body-token');
    });

    it('reads pf_refresh cookie when no body token is provided (N-H2)', async () => {
      const reply = makeReply();
      const request = makeRequest({ pf_refresh: 'cookie-token' });
      await controller.logout({}, request, reply);
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith(
        'cookie-token',
      );
    });

    it('prefers body token over cookie token (N-H2)', async () => {
      const reply = makeReply();
      const request = makeRequest({ pf_refresh: 'cookie-token' });
      await controller.logout({ refreshToken: 'body-token' }, request, reply);
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith('body-token');
      expect(authService.revokeRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('does not call revokeRefreshToken when no token is available (N-H2)', async () => {
      const reply = makeReply();
      const request = makeRequest();
      await controller.logout({}, request, reply);
      expect(authService.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('POST verify-email', () => {
    it('delegates to authService.verifyEmail', async () => {
      const expected = { message: 'Email verified successfully' };
      vi.mocked(authService.verifyEmail).mockResolvedValue(expected);
      const dto = { token: 'a'.repeat(64) };

      const result = await controller.verifyEmail(dto);
      expect(result).toBe(expected);
      expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST forgot-password', () => {
    it('delegates to authService.forgotPassword', async () => {
      const expected = {
        message: 'If that email exists, a reset link has been sent',
      };
      vi.mocked(authService.forgotPassword).mockResolvedValue(expected);
      const dto = { email: 'a@b.com' };

      const result = await controller.forgotPassword(dto);
      expect(result).toBe(expected);
    });
  });

  describe('POST reset-password', () => {
    it('delegates to authService.resetPassword', async () => {
      const expected = { message: 'Password reset successfully' };
      vi.mocked(authService.resetPassword).mockResolvedValue(expected);
      const dto = { token: 'a'.repeat(64), newPassword: 'NewPassw0rd!' };

      const result = await controller.resetPassword(dto);
      expect(result).toBe(expected);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });
});
