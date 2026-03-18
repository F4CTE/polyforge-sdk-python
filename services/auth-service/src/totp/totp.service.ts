import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';

const PENDING_TOTP_TTL = 300; // 5 minutes
const BACKUP_CODE_COUNT = 10;
const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class TotpService {
    private readonly logger = new Logger(TotpService.name);
    private readonly encryptionKey: Buffer;

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly config: ConfigService,
    ) {
        const keyHex = this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
        this.encryptionKey = Buffer.from(keyHex, 'hex');
        if (this.encryptionKey.length !== 32) {
            throw new Error('TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
        }
    }

    // ─── Setup ────────────────────────────────────────────────────────────────────

    async setup(userId: string): Promise<{ secret: string; uri: string; qrCode: string }> {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

        if (user.totpEnabled) {
            throw new HttpException(
                { code: 'TOTP_ALREADY_ENABLED', message: '2FA is already enabled on this account' },
                HttpStatus.CONFLICT,
            );
        }

        const secret = generateSecret({ length: 20 }); // 160-bit entropy
        const uri = generateURI({ label: user.email, issuer: 'Polyforge', secret, strategy: 'totp' });
        const qrCode = await QRCode.toDataURL(uri);

        // Store pending secret in Redis with TTL — not yet committed to DB
        await this.redis.set(`totp:pending:${userId}`, secret, PENDING_TOTP_TTL);

        return { secret, uri, qrCode };
    }

    // ─── Confirm ──────────────────────────────────────────────────────────────────

    async confirm(userId: string, code: string): Promise<{ backupCodes: string[] }> {
        const pendingSecret = await this.redis.get(`totp:pending:${userId}`);

        if (!pendingSecret) {
            throw new HttpException(
                { code: 'TOTP_SETUP_EXPIRED', message: 'TOTP setup session expired. Please start again.' },
                HttpStatus.BAD_REQUEST,
            );
        }

        let isValid = false;
        try {
            isValid = verifySync({ token: code, secret: pendingSecret, strategy: 'totp' }).valid;
        } catch {
            // malformed secret or code — treat as invalid
        }
        if (!isValid) {
            throw new HttpException(
                { code: 'TOTP_INVALID', message: 'Invalid 2FA code' },
                HttpStatus.BAD_REQUEST,
            );
        }

        // Generate 10 backup codes
        const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
            randomBytes(4).toString('hex').toUpperCase(), // 8-char hex codes
        );
        const backupCodeHashes = backupCodes.map(c => createHash('sha256').update(c).digest('hex'));

        // Encrypt the TOTP secret for storage
        const encryptedSecret = this.encrypt(pendingSecret);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: {
                    totpSecret: encryptedSecret,
                    totpEnabled: true,
                    totpEnabledAt: new Date(),
                    totpBackupCodes: backupCodeHashes,
                },
            }),
        ]);

        await this.redis.del(`totp:pending:${userId}`);

        return { backupCodes };
    }

    // ─── Disable ──────────────────────────────────────────────────────────────────

    async disable(userId: string, password: string): Promise<void> {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

        if (!user.totpEnabled) {
            throw new HttpException(
                { code: 'TOTP_NOT_ENABLED', message: '2FA is not enabled on this account' },
                HttpStatus.BAD_REQUEST,
            );
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            throw new HttpException(
                { code: 'INVALID_CREDENTIALS', message: 'Invalid password' },
                HttpStatus.BAD_REQUEST,
            );
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                totpSecret: null,
                totpEnabled: false,
                totpEnabledAt: null,
                totpBackupCodes: [],
            },
        });
    }

    // ─── Verify (used during login) ───────────────────────────────────────────────

    async verify(userId: string, code: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user || !user.totpEnabled || !user.totpSecret) return false;

        // Try TOTP code first
        const secret = this.decrypt(user.totpSecret);
        try {
            if (verifySync({ token: code, secret, strategy: 'totp' }).valid) return true;
        } catch {
            // invalid code format — fall through to backup code check
        }

        // Try backup codes (constant-time comparison via hash)
        const codeHash = createHash('sha256').update(code.toUpperCase()).digest('hex');
        const matchIdx = user.totpBackupCodes.indexOf(codeHash);

        if (matchIdx >= 0) {
            // Burn the backup code
            const remaining = [...user.totpBackupCodes];
            remaining.splice(matchIdx, 1);
            await this.prisma.user.update({
                where: { id: userId },
                data: { totpBackupCodes: remaining },
            });
            return true;
        }

        return false;
    }

    // ─── Encryption helpers ───────────────────────────────────────────────────────

    private encrypt(plaintext: string): string {
        const iv = randomBytes(12); // 96-bit IV for GCM
        const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        // Format: iv:tag:ciphertext (all hex)
        return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    }

    private decrypt(stored: string): string {
        const [ivHex, tagHex, ciphertextHex] = stored.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const ciphertext = Buffer.from(ciphertextHex, 'hex');

        const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
        decipher.setAuthTag(tag);
        return decipher.update(ciphertext) + decipher.final('utf8');
    }
}
