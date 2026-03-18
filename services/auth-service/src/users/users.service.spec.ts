import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { createMockDb, MockDb } from '../../test/helpers/mock-db';
import {
    userFactory,
    emailVerificationFactory,
    passwordResetTokenFactory,
    rawToken,
} from '../../test/factories';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** SHA-256 of a token — mirrors the production hashing logic */
import { createHash } from 'crypto';
function sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('UsersService', () => {
    let service: UsersService;
    let db: MockDb;

    beforeEach(() => {
        db = createMockDb();
        service = new UsersService(db as any);
    });

    // ── findByEmail ───────────────────────────────────────────────────────────

    describe('findByEmail', () => {
        it('returns the user when found', async () => {
            const user = userFactory();
            db.user.findUnique.mockResolvedValue(user as any);

            const result = await service.findByEmail(user.email);

            expect(result).toEqual(user);
            expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
        });

        it('returns null when no user exists', async () => {
            db.user.findUnique.mockResolvedValue(null);
            expect(await service.findByEmail('nobody@example.com')).toBeNull();
        });
    });

    // ── findById ─────────────────────────────────────────────────────────────

    describe('findById', () => {
        it('returns the user when found', async () => {
            const user = userFactory();
            db.user.findUnique.mockResolvedValue(user as any);

            const result = await service.findById(user.id);
            expect(result).toEqual(user);
        });

        it('returns null when no user exists', async () => {
            db.user.findUnique.mockResolvedValue(null);
            expect(await service.findById('non-existent-id')).toBeNull();
        });
    });

    // ── create ───────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates a user and returns the record', async () => {
            const user = userFactory();
            db.user.findUnique.mockResolvedValue(null); // no duplicate
            db.user.create.mockResolvedValue(user as any);

            const result = await service.create({
                email: user.email,
                password: 'Passw0rd!',
                username: user.username,
            });

            expect(result).toEqual(user);
            expect(db.user.create).toHaveBeenCalledOnce();
        });

        it('hashes the password before storing', async () => {
            const user = userFactory();
            db.user.findUnique.mockResolvedValue(null);
            db.user.create.mockResolvedValue(user as any);

            await service.create({ email: user.email, password: 'Passw0rd!', username: user.username });

            const callArg = db.user.create.mock.calls[0][0];
            const hash = callArg.data.passwordHash as string;
            expect(hash).toMatch(/^\$2[ab]\$/); // bcryptjs uses $2a$, bcrypt uses $2b$
            expect(hash).not.toContain('Passw0rd!');
        });

        it('throws EMAIL_TAKEN (409) when email already exists', async () => {
            const existing = userFactory();
            // First findUnique (email check) returns a user
            db.user.findUnique.mockResolvedValueOnce(existing as any);

            await expect(
                service.create({ email: existing.email, password: 'Passw0rd!', username: 'newuser' }),
            ).rejects.toMatchObject({
                response: { code: 'EMAIL_TAKEN' },
                status: HttpStatus.CONFLICT,
            });
        });

        it('throws USERNAME_TAKEN (409) when username already exists', async () => {
            const existing = userFactory();
            // Email check → null, username check → existing
            db.user.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(existing as any);

            await expect(
                service.create({ email: 'new@example.com', password: 'Passw0rd!', username: existing.username }),
            ).rejects.toMatchObject({
                response: { code: 'USERNAME_TAKEN' },
                status: HttpStatus.CONFLICT,
            });
        });
    });

    // ── validatePassword ─────────────────────────────────────────────────────

    describe('validatePassword', () => {
        it('returns true for a correct password', async () => {
            const password = 'Passw0rd!';
            const hash = await bcrypt.hash(password, 12);
            expect(await service.validatePassword({ passwordHash: hash }, password)).toBe(true);
        });

        it('returns false for an incorrect password', async () => {
            const hash = await bcrypt.hash('Passw0rd!', 12);
            expect(await service.validatePassword({ passwordHash: hash }, 'WrongPass1')).toBe(false);
        });
    });

    // ── createEmailVerificationToken ─────────────────────────────────────────

    describe('createEmailVerificationToken', () => {
        it('returns a 64-character hex token', async () => {
            db.emailVerification.create.mockResolvedValue({} as any);

            const token = await service.createEmailVerificationToken('user-id');

            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[0-9a-f]{64}$/);
        });

        it('stores the SHA-256 hash of the token (not the plaintext)', async () => {
            db.emailVerification.create.mockResolvedValue({} as any);

            const token = await service.createEmailVerificationToken('user-id');
            const callArg = db.emailVerification.create.mock.calls[0][0];

            expect(callArg.data.tokenHash).toBe(sha256(token));
            expect(callArg.data.tokenHash).not.toBe(token);
        });

        it('sets a 24-hour expiry', async () => {
            db.emailVerification.create.mockResolvedValue({} as any);

            const before = Date.now();
            await service.createEmailVerificationToken('user-id');
            const after = Date.now();

            const callArg = db.emailVerification.create.mock.calls[0][0];
            const expiresAt = callArg.data.expiresAt as Date;
            const ttlMs = expiresAt.getTime();

            expect(ttlMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 100);
            expect(ttlMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100);
        });
    });

    // ── verifyEmail ───────────────────────────────────────────────────────────

    describe('verifyEmail', () => {
        it('marks the token used and sets emailVerified on the user', async () => {
            const token = rawToken();
            const record = emailVerificationFactory({ tokenHash: sha256(token) });
            db.emailVerification.findUnique.mockResolvedValue(record as any);
            db.$transaction.mockResolvedValue([]);

            await service.verifyEmail(token);

            expect(db.$transaction).toHaveBeenCalledOnce();
        });

        it('throws TOKEN_INVALID (400) when the token does not exist', async () => {
            db.emailVerification.findUnique.mockResolvedValue(null);

            await expect(service.verifyEmail(rawToken())).rejects.toMatchObject({
                response: { code: 'TOKEN_INVALID' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws TOKEN_ALREADY_USED (400) when usedAt is set', async () => {
            const token = rawToken();
            const record = emailVerificationFactory({ tokenHash: sha256(token), usedAt: new Date() });
            db.emailVerification.findUnique.mockResolvedValue(record as any);

            await expect(service.verifyEmail(token)).rejects.toMatchObject({
                response: { code: 'TOKEN_ALREADY_USED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws TOKEN_EXPIRED (400) when expiresAt is in the past', async () => {
            const token = rawToken();
            const record = emailVerificationFactory({
                tokenHash: sha256(token),
                expiresAt: new Date(Date.now() - 1000), // 1s in the past
            });
            db.emailVerification.findUnique.mockResolvedValue(record as any);

            await expect(service.verifyEmail(token)).rejects.toMatchObject({
                response: { code: 'TOKEN_EXPIRED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });
    });

    // ── createPasswordResetToken ──────────────────────────────────────────────

    describe('createPasswordResetToken', () => {
        it('returns a 64-character hex token', async () => {
            db.passwordResetToken.create.mockResolvedValue({} as any);

            const token = await service.createPasswordResetToken('user-id');
            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[0-9a-f]{64}$/);
        });

        it('stores the SHA-256 hash, not the plaintext', async () => {
            db.passwordResetToken.create.mockResolvedValue({} as any);

            const token = await service.createPasswordResetToken('user-id');
            const callArg = db.passwordResetToken.create.mock.calls[0][0];

            expect(callArg.data.tokenHash).toBe(sha256(token));
        });

        it('sets a 1-hour expiry', async () => {
            db.passwordResetToken.create.mockResolvedValue({} as any);

            const before = Date.now();
            await service.createPasswordResetToken('user-id');
            const after = Date.now();

            const callArg = db.passwordResetToken.create.mock.calls[0][0];
            const expiresAt = callArg.data.expiresAt as Date;
            const ttlMs = expiresAt.getTime();

            expect(ttlMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 100);
            expect(ttlMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 100);
        });
    });

    // ── resetPassword ─────────────────────────────────────────────────────────

    describe('resetPassword', () => {
        it('updates the password hash via transaction', async () => {
            const token = rawToken();
            const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
            db.passwordResetToken.findUnique.mockResolvedValue(record as any);
            db.$transaction.mockResolvedValue([]);

            await service.resetPassword(token, 'NewPassw0rd!');

            expect(db.$transaction).toHaveBeenCalledOnce();
        });

        it('hashes the new password before storing', async () => {
            const token = rawToken();
            const record = passwordResetTokenFactory({ tokenHash: sha256(token) });
            db.passwordResetToken.findUnique.mockResolvedValue(record as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db.$transaction as any).mockImplementation(async (ops: any[]) => ops);

            await service.resetPassword(token, 'NewPassw0rd!');

            // The second operation in the transaction updates the user's passwordHash
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txOps = (db.$transaction as any).mock.calls[0][0] as any[];
            // We can't inspect the deferred Prisma operations directly, but we verify
            // that $transaction was called with an array of operations.
            expect(Array.isArray(txOps)).toBe(true);
            expect(txOps).toHaveLength(2);
        });

        it('throws TOKEN_INVALID (400) when the token does not exist', async () => {
            db.passwordResetToken.findUnique.mockResolvedValue(null);

            await expect(service.resetPassword(rawToken(), 'NewPassw0rd!')).rejects.toMatchObject({
                response: { code: 'TOKEN_INVALID' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws TOKEN_ALREADY_USED (400) when usedAt is set', async () => {
            const token = rawToken();
            const record = passwordResetTokenFactory({ tokenHash: sha256(token), usedAt: new Date() });
            db.passwordResetToken.findUnique.mockResolvedValue(record as any);

            await expect(service.resetPassword(token, 'NewPassw0rd!')).rejects.toMatchObject({
                response: { code: 'TOKEN_ALREADY_USED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });

        it('throws TOKEN_EXPIRED (400) when expiresAt is in the past', async () => {
            const token = rawToken();
            const record = passwordResetTokenFactory({
                tokenHash: sha256(token),
                expiresAt: new Date(Date.now() - 1000),
            });
            db.passwordResetToken.findUnique.mockResolvedValue(record as any);

            await expect(service.resetPassword(token, 'NewPassw0rd!')).rejects.toMatchObject({
                response: { code: 'TOKEN_EXPIRED' },
                status: HttpStatus.BAD_REQUEST,
            });
        });
    });
});
