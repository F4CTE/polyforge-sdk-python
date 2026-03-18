import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { TotpService } from './totp.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';
import { userFactory } from '../../test/factories';
import { generateSync, generateSecret } from 'otplib';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockRedisClient() {
    return {
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn().mockResolvedValue(1),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
    };
}

function makeMockRedis() {
    const ioClient = makeMockRedisClient();
    return {
        get: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn().mockResolvedValue(undefined),
        getClient: vi.fn().mockReturnValue(ioClient),
        _ioClient: ioClient,
    };
}

function makeMockConfig(key = '0'.repeat(64)) {
    return { getOrThrow: vi.fn().mockReturnValue(key) };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('TotpService', () => {
    let service: TotpService;
    let db: MockDb;
    let redis: ReturnType<typeof makeMockRedis>;
    let config: ReturnType<typeof makeMockConfig>;

    beforeEach(() => {
        db = createMockDb();
        redis = makeMockRedis();
        config = makeMockConfig();
        service = new TotpService(db as any, redis as any, config as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── constructor ───────────────────────────────────────────────────────────

    describe('constructor', () => {
        it('throws when TOTP_ENCRYPTION_KEY is not 32 bytes (64 hex chars)', () => {
            const badConfig = { getOrThrow: vi.fn().mockReturnValue('deadbeef') }; // 4 bytes
            expect(() => new TotpService(db as any, redis as any, badConfig as any))
                .toThrow('TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
        });
    });

    // ── setup ─────────────────────────────────────────────────────────────────

    describe('setup', () => {
        it('returns a secret, URI, and QR code data URL', async () => {
            const user = userFactory({ totpEnabled: false });
            db.user.findUniqueOrThrow.mockResolvedValue(user as any);

            const result = await service.setup(user.id);

            expect(result.secret).toBeTruthy();
            expect(result.uri).toMatch(/^otpauth:\/\/totp\//);
            expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
        });

        it('stores the pending secret in Redis with 300s TTL', async () => {
            const user = userFactory({ totpEnabled: false });
            db.user.findUniqueOrThrow.mockResolvedValue(user as any);

            const result = await service.setup(user.id);

            expect(redis.set).toHaveBeenCalledWith(
                `totp:pending:${user.id}`,
                result.secret,
                300,
            );
        });

        it('throws TOTP_ALREADY_ENABLED (409) when 2FA is already on', async () => {
            const user = userFactory({ totpEnabled: true });
            db.user.findUniqueOrThrow.mockResolvedValue(user as any);

            await expect(service.setup(user.id)).rejects.toMatchObject({
                response: { code: 'TOTP_ALREADY_ENABLED' },
                status: HttpStatus.CONFLICT,
            });
        });
    });

    // ── confirm ───────────────────────────────────────────────────────────────

    describe('confirm', () => {
        it('throws TOTP_SETUP_EXPIRED (400) when no pending secret in Redis', async () => {
            redis.get.mockResolvedValue(null);

            await expect(service.confirm('user-id', '123456')).rejects.toMatchObject({
                response: { code: 'TOTP_SETUP_EXPIRED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws TOTP_INVALID (400) for a wrong code', async () => {
            // Use a valid Base32 secret so verifySync doesn't throw, but code won't match
            redis.get.mockResolvedValue('JBSWY3DPEHPK3PXP');

            await expect(service.confirm('user-id', '000000')).rejects.toMatchObject({
                response: { code: 'TOTP_INVALID' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('returns 10 backup codes and commits to DB on success', async () => {
            const secret = generateSecret({ length: 20 }); // 160-bit, valid for otplib v13
            const validCode = generateSync({ secret, strategy: 'totp' });
            redis.get.mockResolvedValue(secret);
            (db.$transaction as any).mockResolvedValue([]);

            const result = await service.confirm('user-id', validCode);

            expect(result.backupCodes).toHaveLength(10);
            expect(result.backupCodes[0]).toMatch(/^[0-9A-F]{8}$/);
            expect(db.$transaction).toHaveBeenCalledOnce();
        });

        it('deletes the pending Redis key on success', async () => {
            const secret = generateSecret({ length: 20 });
            const validCode = generateSync({ secret, strategy: 'totp' });
            redis.get.mockResolvedValue(secret);
            (db.$transaction as any).mockResolvedValue([]);

            await service.confirm('user-id', validCode);

            expect(redis.del).toHaveBeenCalledWith('totp:pending:user-id');
        });
    });

    // ── disable ───────────────────────────────────────────────────────────────

    describe('disable', () => {
        it('throws TOTP_NOT_ENABLED (400) when 2FA is off', async () => {
            const user = userFactory({ totpEnabled: false });
            db.user.findUniqueOrThrow.mockResolvedValue(user as any);

            await expect(service.disable(user.id, 'password')).rejects.toMatchObject({
                response: { code: 'TOTP_NOT_ENABLED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws INVALID_CREDENTIALS (400) on wrong password', async () => {
            const user = userFactory({
                totpEnabled: true,
                passwordHash: '$2b$12$hashedbutnotthispass',
            });
            db.user.findUniqueOrThrow.mockResolvedValue(user as any);

            await expect(service.disable(user.id, 'wrong_password')).rejects.toMatchObject({
                response: { code: 'INVALID_CREDENTIALS' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('clears TOTP fields on success', async () => {
            const bcrypt = await import('bcryptjs');
            const hash = await bcrypt.hash('correct_password', 10);
            const user = userFactory({ totpEnabled: true, passwordHash: hash });
            db.user.findUniqueOrThrow.mockResolvedValue(user as any);
            db.user.update.mockResolvedValue(user as any);

            await service.disable(user.id, 'correct_password');

            expect(db.user.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: {
                    totpSecret: null,
                    totpEnabled: false,
                    totpEnabledAt: null,
                    totpBackupCodes: [],
                },
            });
        });
    });

    // ── verify ────────────────────────────────────────────────────────────────

    describe('verify', () => {
        it('returns false when user does not exist', async () => {
            redis._ioClient.get.mockResolvedValue(null);
            db.user.findUnique.mockResolvedValue(null);
            expect(await service.verify('nonexistent', '123456')).toBe(false);
        });

        it('returns false when TOTP is not enabled', async () => {
            redis._ioClient.get.mockResolvedValue(null);
            const user = userFactory({ totpEnabled: false });
            db.user.findUnique.mockResolvedValue(user as any);
            expect(await service.verify(user.id, '123456')).toBe(false);
        });

        it('returns false when TOTP secret is null', async () => {
            redis._ioClient.get.mockResolvedValue(null);
            const user = { ...userFactory({ totpEnabled: true }), totpSecret: null };
            db.user.findUnique.mockResolvedValue(user as any);
            expect(await service.verify(user.id, '123456')).toBe(false);
        });

        it('throws TOTP_LOCKED (429) when fail counter is at or above threshold', async () => {
            redis._ioClient.get.mockResolvedValue('5');

            await expect(service.verify('user-id', '123456')).rejects.toMatchObject({
                response: { code: 'TOTP_LOCKED' },
                status: HttpStatus.TOO_MANY_REQUESTS,
            });
        });

        it('increments fail counter on a bad code and sets TTL on first failure', async () => {
            redis._ioClient.get.mockResolvedValue(null); // no prior failures
            redis._ioClient.incr.mockResolvedValue(1);  // first failure

            const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');
            const user = { ...userFactory({ totpEnabled: true }), totpSecret: encrypted, totpBackupCodes: [] };
            db.user.findUnique.mockResolvedValue(user as any);

            const result = await service.verify(user.id, '000000');
            expect(result).toBe(false);
            expect(redis._ioClient.incr).toHaveBeenCalledWith(`totp:fail:${user.id}`);
            expect(redis._ioClient.expire).toHaveBeenCalledWith(`totp:fail:${user.id}`, 900);
        });

        it('does not reset TTL on subsequent failures (incr > 1)', async () => {
            redis._ioClient.get.mockResolvedValue('2'); // 2 prior failures
            redis._ioClient.incr.mockResolvedValue(3);  // 3rd failure

            const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');
            const user = { ...userFactory({ totpEnabled: true }), totpSecret: encrypted, totpBackupCodes: [] };
            db.user.findUnique.mockResolvedValue(user as any);

            await service.verify(user.id, '000000');
            expect(redis._ioClient.expire).not.toHaveBeenCalled();
        });

        it('returns true and clears fail counter when TOTP code matches', async () => {
            redis._ioClient.get.mockResolvedValue('2'); // had 2 prior failures

            const secret = generateSecret({ length: 20 });
            const validCode = generateSync({ secret, strategy: 'totp' });
            const encrypted = (service as any).encrypt(secret);

            const user = {
                ...userFactory({ totpEnabled: true }),
                totpSecret: encrypted,
                totpBackupCodes: [],
            };
            db.user.findUnique.mockResolvedValue(user as any);

            const result = await service.verify(user.id, validCode);
            expect(result).toBe(true);
            expect(redis._ioClient.del).toHaveBeenCalledWith(`totp:fail:${user.id}`);
        });

        it('burns a backup code on successful backup code usage', async () => {
            redis._ioClient.get.mockResolvedValue(null);
            const { createHash } = await import('crypto');
            const code = 'ABCD1234';
            const hash = createHash('sha256').update(code).digest('hex');

            const encrypted = (service as any).encrypt('JBSWY3DPEHPK3PXP');

            const user = {
                ...userFactory({ totpEnabled: true }),
                totpSecret: encrypted,
                totpBackupCodes: [hash, 'other-hash'],
            };
            db.user.findUnique.mockResolvedValue(user as any);
            db.user.update.mockResolvedValue(user as any);

            const result = await service.verify(user.id, code);
            expect(result).toBe(true);

            expect(db.user.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: { totpBackupCodes: ['other-hash'] },
            });
        });
    });
});
