import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TotpService } from '../totp/totp.service';
import { RedisService } from '@polyforge/shared-redis';
import { createMockMailService } from '../../test/helpers/mock-mail';
import { userFactory } from '../../test/factories';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeRegisterDto(overrides: Record<string, unknown> = {}) {
    return { email: 'alice@example.com', password: 'Passw0rd!', username: 'alice', tosAccepted: true, ...overrides };
}

function makeLoginDto(overrides: Record<string, unknown> = {}) {
    return { email: 'alice@example.com', password: 'Passw0rd!', ...overrides };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
    let service: AuthService;
    let usersService: UsersService;
    let jwtService: JwtService;
    let mailService: MailService;
    let totpService: TotpService;
    let config: ConfigService;
    let redis: RedisService;

    beforeEach(() => {
        usersService = {
            create: vi.fn(),
            findByEmail: vi.fn(),
            findById: vi.fn(),
            validatePassword: vi.fn(),
            rehashIfNeeded: vi.fn().mockResolvedValue(undefined),
            createEmailVerificationToken: vi.fn().mockResolvedValue('a'.repeat(64)),
            verifyEmail: vi.fn(),
            createPasswordResetToken: vi.fn().mockResolvedValue('b'.repeat(64)),
            resetPassword: vi.fn(),
            findByUsername: vi.fn(),
        } as unknown as UsersService;

        jwtService = {
            sign: vi.fn().mockReturnValue('signed-jwt-token'),
        } as unknown as JwtService;

        mailService = createMockMailService() as MailService;

        totpService = {
            verify: vi.fn().mockResolvedValue(true),
        } as unknown as TotpService;

        config = {
            get: vi.fn().mockReturnValue(undefined),
        } as unknown as ConfigService;

        redis = {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            del: vi.fn().mockResolvedValue(undefined),
            getClient: vi.fn().mockReturnValue({ decr: vi.fn() }),
        } as unknown as RedisService;

        service = new AuthService(usersService, jwtService, mailService, totpService, config, redis);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── register ──────────────────────────────────────────────────────────────

    describe('register', () => {
        it('returns a JWT and user profile on success', async () => {
            const user = userFactory({ emailVerified: false, polymarketConnected: false });
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            const result = await service.register(makeRegisterDto() as any);

            expect(result.token).toBe('signed-jwt-token');
            expect(result.user.id).toBe(user.id);
            expect(result.user.email).toBe(user.email);
            expect(result.user.username).toBe(user.username);
            expect(result.user.status).toBe('UNVERIFIED');
        });

        it('never exposes passwordHash in the response', async () => {
            const user = userFactory();
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            const result = await service.register(makeRegisterDto() as any);

            expect(JSON.stringify(result)).not.toContain('passwordHash');
            expect(JSON.stringify(result)).not.toContain('$2b$');
        });

        it('sends a verification email fire-and-forget', async () => {
            const user = userFactory();
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            await service.register(makeRegisterDto() as any);

            // Fire-and-forget: email is queued but may not be awaited yet
            await vi.waitFor(() => {
                expect(usersService.createEmailVerificationToken).toHaveBeenCalledWith(user.id);
            });
        });

        it('does NOT fail registration when email sending throws', async () => {
            const user = userFactory();
            vi.mocked(usersService.create).mockResolvedValue(user as any);
            vi.mocked(usersService.createEmailVerificationToken).mockRejectedValue(new Error('SMTP down'));

            // Registration should succeed even if email fails
            await expect(service.register(makeRegisterDto() as any)).resolves.toBeDefined();
        });

        it('derives SUSPENDED status when user is suspended', async () => {
            const user = userFactory({ suspended: true, emailVerified: true });
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            const result = await service.register(makeRegisterDto() as any);
            expect(result.user.status).toBe('SUSPENDED');
        });

        it('derives CONNECTED status when polymarketConnected is true', async () => {
            const user = userFactory({ polymarketConnected: true, emailVerified: true });
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            const result = await service.register(makeRegisterDto() as any);
            expect(result.user.status).toBe('CONNECTED');
        });

        it('derives VERIFIED status when emailVerified is true', async () => {
            const user = userFactory({ emailVerified: true, polymarketConnected: false });
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            const result = await service.register(makeRegisterDto() as any);
            expect(result.user.status).toBe('VERIFIED');
        });
    });

    // ── register — invite-only mode ───────────────────────────────────────────

    describe('register (invite-only mode)', () => {
        beforeEach(() => {
            // Enable invite-only via Redis flag
            vi.mocked(redis.get).mockImplementation((key: string) =>
                key === 'config:invite_only' ? Promise.resolve('true') : Promise.resolve(null),
            );
        });

        it('throws INVITE_REQUIRED (403) when no invite code is provided', async () => {
            await expect(service.register(makeRegisterDto() as any)).rejects.toMatchObject({
                response: { code: 'INVITE_REQUIRED' },
                status: 403,
            });
        });

        it('throws INVITE_INVALID (403) when invite code is not in Redis', async () => {
            // redis.get returns null for the invite key (already mocked above)
            await expect(
                service.register(makeRegisterDto({ inviteCode: 'POLY-AAAAAA' }) as any),
            ).rejects.toMatchObject({
                response: { code: 'INVITE_INVALID' },
                status: 403,
            });
        });

        it('deletes the invite key when only 1 use remains', async () => {
            vi.mocked(redis.get).mockImplementation((key: string) => {
                if (key === 'config:invite_only') return Promise.resolve('true');
                if (key === 'invite:POLY-AAAAAA') return Promise.resolve('1');
                return Promise.resolve(null);
            });
            const user = userFactory();
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            await service.register(makeRegisterDto({ inviteCode: 'POLY-AAAAAA' }) as any);

            expect(redis.del).toHaveBeenCalledWith('invite:POLY-AAAAAA');
        });

        it('decrements the invite key when more than 1 use remains', async () => {
            const decrMock = vi.fn().mockResolvedValue(2);
            vi.mocked(redis.getClient).mockReturnValue({ decr: decrMock } as any);
            vi.mocked(redis.get).mockImplementation((key: string) => {
                if (key === 'config:invite_only') return Promise.resolve('true');
                if (key === 'invite:POLY-AAAAAA') return Promise.resolve('3');
                return Promise.resolve(null);
            });
            const user = userFactory();
            vi.mocked(usersService.create).mockResolvedValue(user as any);

            await service.register(makeRegisterDto({ inviteCode: 'POLY-AAAAAA' }) as any);

            expect(decrMock).toHaveBeenCalledWith('invite:POLY-AAAAAA');
        });

        it('respects env-var fallback when Redis flag is absent', async () => {
            vi.mocked(redis.get).mockResolvedValue(null); // no Redis flag
            vi.mocked(config.get).mockReturnValue('true'); // env var is true

            await expect(service.register(makeRegisterDto() as any)).rejects.toMatchObject({
                response: { code: 'INVITE_REQUIRED' },
                status: 403,
            });
        });
    });

    // ── login ─────────────────────────────────────────────────────────────────

    describe('login', () => {
        it('returns a JWT and user profile on valid credentials', async () => {
            const user = userFactory({ totpEnabled: false });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);

            const result = await service.login(makeLoginDto() as any);

            expect(result.token).toBe('signed-jwt-token');
            expect(result.user.id).toBe(user.id);
            expect(result.requiresTotp).toBe(false);
        });

        it('throws INVALID_CREDENTIALS (400) when user does not exist', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(null);

            await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws INVALID_CREDENTIALS (400) when user is soft-deleted', async () => {
            const user = userFactory({ deleted: true });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);

            await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws ACCOUNT_SUSPENDED (403) when user is suspended', async () => {
            const user = userFactory({ suspended: true });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);

            await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
                response: { code: 'ACCOUNT_SUSPENDED' },
                status: HttpStatus.FORBIDDEN,
            });
        });

        it('throws INVALID_CREDENTIALS (400) on wrong password', async () => {
            const user = userFactory({ suspended: false });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(false);

            await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws TOTP_REQUIRED (400) when 2FA is enabled but no code provided', async () => {
            const user = userFactory({ totpEnabled: true });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);

            await expect(service.login(makeLoginDto() as any)).rejects.toMatchObject({
                response: { code: 'TOTP_REQUIRED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('sets requiresTotp=true when totpEnabled', async () => {
            const user = userFactory({ totpEnabled: true });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);
            vi.mocked(totpService.verify).mockResolvedValue(true);

            // Provide a totpCode so the TOTP_REQUIRED guard passes
            const result = await service.login(makeLoginDto({ totpCode: '123456' }) as any);
            expect(result.requiresTotp).toBe(true);
        });

        it('throws TOTP_INVALID (400) when 2FA code is wrong', async () => {
            const user = userFactory({ totpEnabled: true });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);
            vi.mocked(totpService.verify).mockResolvedValue(false);

            await expect(service.login(makeLoginDto({ totpCode: '999999' }) as any)).rejects.toMatchObject({
                response: { code: 'TOTP_INVALID' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('never exposes passwordHash in the response', async () => {
            const user = userFactory();
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);

            const result = await service.login(makeLoginDto() as any);
            expect(JSON.stringify(result)).not.toContain('passwordHash');
        });

        it('does not throw when rehashIfNeeded fails (fire-and-forget catch)', async () => {
            const user = userFactory({ totpEnabled: false });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);
            vi.mocked(usersService.rehashIfNeeded).mockRejectedValue(new Error('db error'));

            await expect(service.login(makeLoginDto() as any)).resolves.toBeDefined();
        });

        it('includes status, polymarketConnected, emailVerified in response', async () => {
            const user = userFactory({ emailVerified: true, polymarketConnected: false });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.validatePassword).mockResolvedValue(true);

            const result = await service.login(makeLoginDto() as any);
            expect(result.user.status).toBeDefined();
            expect(result.user.polymarketConnected).toBe(false);
            expect(result.user.emailVerified).toBe(true);
        });
    });

    // ── me ────────────────────────────────────────────────────────────────────

    describe('me', () => {
        it('returns the full user profile', async () => {
            const user = userFactory();
            vi.mocked(usersService.findById).mockResolvedValue(user as any);

            const result = await service.me(user.id);

            expect(result.id).toBe(user.id);
            expect(result.email).toBe(user.email);
            expect(result.bio).toBeDefined();
            expect(result.totpEnabled).toBeDefined();
        });

        it('throws UNAUTHORIZED (401) when user is not found', async () => {
            vi.mocked(usersService.findById).mockResolvedValue(null);

            await expect(service.me('non-existent-id')).rejects.toMatchObject({
                response: { code: 'UNAUTHORIZED' },
                status: HttpStatus.UNAUTHORIZED,
            });
        });

        it('throws UNAUTHORIZED (401) when user is soft-deleted', async () => {
            const user = userFactory({ deleted: true });
            vi.mocked(usersService.findById).mockResolvedValue(user as any);

            await expect(service.me(user.id)).rejects.toMatchObject({
                response: { code: 'UNAUTHORIZED' },
                status: HttpStatus.UNAUTHORIZED,
            });
        });

        it('never exposes passwordHash in the profile', async () => {
            const user = userFactory();
            vi.mocked(usersService.findById).mockResolvedValue(user as any);

            const result = await service.me(user.id);
            expect(JSON.stringify(result)).not.toContain('passwordHash');
        });
    });

    // ── verifyEmail ───────────────────────────────────────────────────────────

    describe('verifyEmail', () => {
        it('delegates to usersService.verifyEmail and returns success message', async () => {
            vi.mocked(usersService.verifyEmail).mockResolvedValue(undefined);
            const token = 'a'.repeat(64);

            const result = await service.verifyEmail({ token });
            expect(result.message).toContain('verified');
            expect(usersService.verifyEmail).toHaveBeenCalledWith(token);
        });

        it('propagates errors from usersService.verifyEmail', async () => {
            vi.mocked(usersService.verifyEmail).mockRejectedValue(
                Object.assign(new Error(), { response: { code: 'TOKEN_EXPIRED' }, status: 400 }),
            );

            await expect(service.verifyEmail({ token: 'a'.repeat(64) })).rejects.toMatchObject({
                response: { code: 'TOKEN_EXPIRED' },
            });
        });
    });

    // ── forgotPassword ────────────────────────────────────────────────────────

    describe('forgotPassword', () => {
        it('returns a generic message when user exists (no enumeration)', async () => {
            const user = userFactory();
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);

            const result = await service.forgotPassword({ email: user.email });
            expect(result.message).toBeTruthy();
        });

        it('returns the same message when user does NOT exist (prevents enumeration)', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(null);

            const result = await service.forgotPassword({ email: 'ghost@example.com' });
            expect(result.message).toBeTruthy();
        });

        it('triggers a password reset email when user exists', async () => {
            const user = userFactory({ deleted: false });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);

            await service.forgotPassword({ email: user.email });

            await vi.waitFor(() => {
                expect(usersService.createPasswordResetToken).toHaveBeenCalledWith(user.id);
            });
        });

        it('does NOT trigger an email for deleted users', async () => {
            const user = userFactory({ deleted: true });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);

            await service.forgotPassword({ email: user.email });

            await new Promise(r => setTimeout(r, 50)); // let fire-and-forget settle
            expect(usersService.createPasswordResetToken).not.toHaveBeenCalled();
        });

        it('does not throw when the reset email fails (fire-and-forget catch)', async () => {
            const user = userFactory({ deleted: false });
            vi.mocked(usersService.findByEmail).mockResolvedValue(user as any);
            vi.mocked(usersService.createPasswordResetToken).mockRejectedValue(new Error('db error'));

            await expect(service.forgotPassword({ email: user.email })).resolves.toBeDefined();
        });
    });

    // ── resetPassword ─────────────────────────────────────────────────────────

    describe('resetPassword', () => {
        it('delegates to usersService.resetPassword and returns success message', async () => {
            vi.mocked(usersService.resetPassword).mockResolvedValue(undefined);
            const dto = { token: 'a'.repeat(64), newPassword: 'NewPassw0rd!' };

            const result = await service.resetPassword(dto as any);
            expect(result.message).toContain('reset');
            expect(usersService.resetPassword).toHaveBeenCalledWith(dto.token, dto.newPassword);
        });

        it('propagates errors from usersService.resetPassword', async () => {
            vi.mocked(usersService.resetPassword).mockRejectedValue(
                Object.assign(new Error(), { response: { code: 'TOKEN_INVALID' }, status: 400 }),
            );

            await expect(
                service.resetPassword({ token: 'a'.repeat(64), newPassword: 'NewPassw0rd!' } as any),
            ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
        });
    });

    // ── status derivation (edge cases) ────────────────────────────────────────

    describe('deriveUserStatus (priority order)', () => {
        const statuses = [
            { desc: 'SUSPENDED beats CONNECTED and VERIFIED', user: { suspended: true, polymarketConnected: true, emailVerified: true }, expected: 'SUSPENDED' },
            { desc: 'CONNECTED beats VERIFIED when not suspended', user: { suspended: false, polymarketConnected: true, emailVerified: true }, expected: 'CONNECTED' },
            { desc: 'VERIFIED when email verified but not connected', user: { suspended: false, polymarketConnected: false, emailVerified: true }, expected: 'VERIFIED' },
            { desc: 'UNVERIFIED when nothing set', user: { suspended: false, polymarketConnected: false, emailVerified: false }, expected: 'UNVERIFIED' },
        ];

        statuses.forEach(({ desc, user: overrides, expected }) => {
            it(desc, async () => {
                const user = userFactory(overrides);
                vi.mocked(usersService.create).mockResolvedValue(user as any);

                const result = await service.register(makeRegisterDto() as any);
                expect(result.user.status).toBe(expected);
            });
        });
    });
});
