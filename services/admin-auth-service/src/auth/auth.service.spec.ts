import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { faker } from '@faker-js/faker';

// ─── Factories ────────────────────────────────────────────────────────────────

interface AdminLike {
    id: string;
    email: string;
    displayName: string | null;
    passwordHash: string;
    role: string;
    active: boolean;
    createdAt: Date;
}

async function adminFactory(overrides: Partial<AdminLike> = {}): Promise<AdminLike> {
    return {
        id: faker.string.uuid(),
        email: faker.internet.email().toLowerCase(),
        displayName: faker.person.fullName(),
        passwordHash: await bcrypt.hash('Passw0rd!', 10),
        role: 'SUPER_ADMIN',
        active: true,
        createdAt: new Date(),
        ...overrides,
    };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AdminAuthService', () => {
    let service: AuthService;
    let adminDb: any;
    let redis: any;
    let jwtService: any;

    beforeEach(() => {
        adminDb = { admin: { findUnique: vi.fn() } };
        redis = { set: vi.fn().mockResolvedValue('OK'), del: vi.fn().mockResolvedValue(1), get: vi.fn().mockResolvedValue(null) };
        jwtService = {
            sign: vi.fn().mockReturnValue('signed-admin-jwt'),
            verify: vi.fn(),
        };
        service = new AuthService(adminDb, redis, jwtService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── login ─────────────────────────────────────────────────────────────────

    describe('login', () => {
        it('returns a JWT and admin profile on valid credentials', async () => {
            const admin = await adminFactory();
            adminDb.admin.findUnique.mockResolvedValue(admin);

            const result = await service.login({ email: admin.email, password: 'Passw0rd!' });

            expect(result.token).toBe('signed-admin-jwt');
            expect(result.admin.id).toBe(admin.id);
            expect(result.admin.email).toBe(admin.email);
            expect(result.admin.role).toBe(admin.role);
        });

        it('stores a Redis session with 1-hour TTL', async () => {
            const admin = await adminFactory();
            adminDb.admin.findUnique.mockResolvedValue(admin);

            await service.login({ email: admin.email, password: 'Passw0rd!' });

            const [key, , ttl] = redis.set.mock.calls[0];
            expect(key).toMatch(/^admin:session:/);
            expect(ttl).toBe(3600);
        });

        it('includes the sessionId in the JWT payload', async () => {
            const admin = await adminFactory();
            adminDb.admin.findUnique.mockResolvedValue(admin);

            await service.login({ email: admin.email, password: 'Passw0rd!' });

            const jwtPayload = jwtService.sign.mock.calls[0][0];
            expect(jwtPayload.sessionId).toBeTruthy();
            expect(jwtPayload.sub).toBe(admin.id);
            expect(jwtPayload.email).toBe(admin.email);
            expect(jwtPayload.role).toBe(admin.role);
        });

        it('throws INVALID_CREDENTIALS (400) when admin does not exist', async () => {
            adminDb.admin.findUnique.mockResolvedValue(null);

            await expect(
                service.login({ email: 'ghost@admin.com', password: 'Passw0rd!' }),
            ).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws INVALID_CREDENTIALS (400) when admin is inactive', async () => {
            const admin = await adminFactory({ active: false });
            adminDb.admin.findUnique.mockResolvedValue(admin);

            await expect(
                service.login({ email: admin.email, password: 'Passw0rd!' }),
            ).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws INVALID_CREDENTIALS (400) on wrong password', async () => {
            const admin = await adminFactory();
            adminDb.admin.findUnique.mockResolvedValue(admin);

            await expect(
                service.login({ email: admin.email, password: 'WrongPass1!' }),
            ).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('never exposes passwordHash in the response', async () => {
            const admin = await adminFactory();
            adminDb.admin.findUnique.mockResolvedValue(admin);

            const result = await service.login({ email: admin.email, password: 'Passw0rd!' });
            expect(JSON.stringify(result)).not.toContain('passwordHash');
            expect(JSON.stringify(result)).not.toContain('$2b$');
        });

        it('uses a unique sessionId on every login', async () => {
            const admin = await adminFactory();
            adminDb.admin.findUnique.mockResolvedValue(admin);

            await service.login({ email: admin.email, password: 'Passw0rd!' });
            await service.login({ email: admin.email, password: 'Passw0rd!' });

            const session1 = redis.set.mock.calls[0][0] as string;
            const session2 = redis.set.mock.calls[1][0] as string;
            expect(session1).not.toBe(session2);
        });
    });

    // ── getMe ─────────────────────────────────────────────────────────────────

    describe('getMe', () => {
        it('returns admin profile when token and session are valid', async () => {
            const admin = await adminFactory();
            const sessionId = faker.string.uuid();
            jwtService.verify.mockReturnValue({ sub: admin.id, email: admin.email, role: admin.role, sessionId });
            redis.get.mockResolvedValue(admin.id);
            adminDb.admin.findUnique.mockResolvedValue(admin);

            const result = await service.getMe('valid-token');

            expect(result.id).toBe(admin.id);
            expect(result.email).toBe(admin.email);
            expect(result.role).toBe(admin.role);
            expect(result.displayName).toBe(admin.displayName);
        });

        it('throws UNAUTHORIZED (401) when JWT is invalid', async () => {
            jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

            await expect(service.getMe('bad-token')).rejects.toMatchObject({
                response: { code: 'UNAUTHORIZED' },
                status: 401,
            });
        });

        it('throws UNAUTHORIZED (401) when Redis session does not exist', async () => {
            const sessionId = faker.string.uuid();
            jwtService.verify.mockReturnValue({ sub: 'admin-id', sessionId });
            redis.get.mockResolvedValue(null);

            await expect(service.getMe('token')).rejects.toMatchObject({
                response: { code: 'SESSION_EXPIRED' },
                status: 401,
            });
        });

        it('throws ACCOUNT_INACTIVE (403) when admin is inactive', async () => {
            const admin = await adminFactory({ active: false });
            const sessionId = faker.string.uuid();
            jwtService.verify.mockReturnValue({ sub: admin.id, sessionId });
            redis.get.mockResolvedValue(admin.id);
            adminDb.admin.findUnique.mockResolvedValue(admin);

            await expect(service.getMe('token')).rejects.toMatchObject({
                response: { code: 'ACCOUNT_INACTIVE' },
                status: 403,
            });
        });

        it('throws ACCOUNT_INACTIVE (403) when admin is not found', async () => {
            const sessionId = faker.string.uuid();
            jwtService.verify.mockReturnValue({ sub: faker.string.uuid(), sessionId });
            redis.get.mockResolvedValue('some-admin-id');
            adminDb.admin.findUnique.mockResolvedValue(null);

            await expect(service.getMe('token')).rejects.toMatchObject({
                response: { code: 'ACCOUNT_INACTIVE' },
                status: 403,
            });
        });
    });

    // ── logout ────────────────────────────────────────────────────────────────

    describe('logout', () => {
        it('deletes the Redis session for a valid Bearer token', async () => {
            const sessionId = faker.string.uuid();
            jwtService.verify.mockReturnValue({ sessionId, sub: 'admin-id', email: 'a@b.com' });

            await service.logout(`Bearer valid-token`);

            expect(redis.del).toHaveBeenCalledWith(`admin:session:${sessionId}`);
        });

        it('does nothing when no Authorization header is provided', async () => {
            await service.logout(undefined);
            expect(redis.del).not.toHaveBeenCalled();
        });

        it('does nothing when the header is not a Bearer token', async () => {
            await service.logout('Basic abc123');
            expect(redis.del).not.toHaveBeenCalled();
        });

        it('silently ignores an expired or invalid JWT (already revoked)', async () => {
            jwtService.verify.mockImplementation(() => { throw new Error('Token expired'); });

            // Should not throw
            await expect(service.logout('Bearer expired-token')).resolves.toBeUndefined();
            expect(redis.del).not.toHaveBeenCalled();
        });
    });
});
