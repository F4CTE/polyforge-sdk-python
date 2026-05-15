import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'crypto';
import * as bcrypt from 'bcrypt';

const PENDING_TOTP_TTL = 300; // 5 minutes
const BACKUP_CODE_COUNT = 10;
const ALGORITHM = 'aes-256-gcm';
const TOTP_FAIL_MAX = 5; // lock after 5 consecutive failures
const TOTP_FAIL_WINDOW = 900; // 15-minute lockout window (seconds)
const MAX_BCRYPT_COMPARISONS = 3; // cap bcrypt ops per verify() call to prevent CPU exhaustion
const TOTP_REPLAY_WINDOW = 90; // covers adjacent valid TOTP steps
const failKey = (userId: string) => `totp:fail:${userId}`;
const usedKey = (userId: string, code: string) => `totp:used:${userId}:${code}`;

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
      throw new Error(
        'TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
      );
    }
  }

  // ─── Setup ────────────────────────────────────────────────────────────────────

  async setup(
    userId: string,
  ): Promise<{ secret: string; uri: string; qrCode: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.totpEnabled) {
      throw new HttpException(
        {
          code: 'TOTP_ALREADY_ENABLED',
          message: '2FA is already enabled on this account',
        },
        HttpStatus.CONFLICT,
      );
    }

    const secret = generateSecret({ length: 20 }); // 160-bit entropy
    const uri = generateURI({
      label: user.email,
      issuer: 'Polyforge',
      secret,
      strategy: 'totp',
    });
    const qrCode = await QRCode.toDataURL(uri);

    // Store pending secret in Redis with TTL — not yet committed to DB
    await this.redis.set(`totp:pending:${userId}`, secret, PENDING_TOTP_TTL);

    return { secret, uri, qrCode };
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────────

  async confirm(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const pendingSecret = await this.redis.get(`totp:pending:${userId}`);

    if (!pendingSecret) {
      throw new HttpException(
        {
          code: 'TOTP_SETUP_EXPIRED',
          message: 'TOTP setup session expired. Please start again.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let isValid = false;
    try {
      isValid = verifySync({
        token: code,
        secret: pendingSecret,
        strategy: 'totp',
      }).valid;
    } catch {
      // malformed secret or code — treat as invalid
    }
    if (!isValid) {
      throw new HttpException(
        { code: 'TOTP_INVALID', message: 'Invalid 2FA code' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Replay protection — fail closed on Redis write errors
    let consumed: string | null;
    try {
      consumed = await this.redis
        .getClient()
        .set(
          usedKey(userId, code),
          '1',
          'EX',
          TOTP_REPLAY_WINDOW,
          'NX',
        );
    } catch (err) {
      this.logger.error(
        { event: 'TOTP_REPLAY_CHECK_FAILED', userId, error: String(err) },
        'Redis replay-key write failed during TOTP confirm',
      );
      throw new HttpException(
        { code: 'TOTP_SETUP_FAILED', message: 'Unable to complete 2FA setup. Please try again.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (consumed !== 'OK') {
      throw new HttpException(
        { code: 'TOTP_INVALID', message: 'TOTP code already used' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Generate 10 backup codes — 80-bit entropy (10 bytes), SHA-256 hashed.
    // 80-bit keyspace (2^80) is computationally infeasible to brute-force even
    // with SHA-256, so bcrypt is unnecessary and enables CPU-exhaustion DoS.
    const backupCodes = Array.from(
      { length: BACKUP_CODE_COUNT },
      () => randomBytes(10).toString('hex').toUpperCase(), // 20-char hex, 2^80 combinations
    );
    const backupCodeHashes = backupCodes.map((c) =>
      createHash('sha256').update(c).digest('hex'),
    );

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

  async disable(
    userId: string,
    password: string,
    totpCode: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.totpEnabled) {
      throw new HttpException(
        {
          code: 'TOTP_NOT_ENABLED',
          message: '2FA is not enabled on this account',
        },
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

    if (!user.totpSecret) {
      throw new HttpException(
        { code: 'INVALID_TOTP', message: 'TOTP secret not found' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const secret = this.decrypt(user.totpSecret);
    let totpValid = false;
    try {
      totpValid = verifySync({
        token: totpCode,
        secret,
        strategy: 'totp',
      }).valid;
    } catch {
      // malformed code — treat as invalid
    }
    if (!totpValid) {
      throw new HttpException(
        { code: 'INVALID_TOTP', message: 'Invalid TOTP code' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Replay protection — fail closed on Redis write errors
    let consumed: string | null;
    try {
      consumed = await this.redis
        .getClient()
        .set(
          usedKey(userId, totpCode),
          '1',
          'EX',
          TOTP_REPLAY_WINDOW,
          'NX',
        );
    } catch (err) {
      this.logger.error(
        { event: 'TOTP_REPLAY_CHECK_FAILED', userId, error: String(err) },
        'Redis replay-key write failed during TOTP disable',
      );
      throw new HttpException(
        { code: 'TOTP_DISABLE_FAILED', message: 'Unable to disable 2FA. Please try again.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (consumed !== 'OK') {
      throw new HttpException(
        { code: 'INVALID_TOTP', message: 'TOTP code already used' },
        HttpStatus.UNAUTHORIZED,
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

  // ─── Regenerate Backup Codes ──────────────────────────────────────────────────

  async regenBackupCodes(userId: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.totpEnabled) {
      throw new HttpException(
        {
          code: 'TOTP_NOT_ENABLED',
          message: '2FA is not enabled on this account',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Generate a fresh set of backup codes — same entropy as original setup, SHA-256 hashed
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(10).toString('hex').toUpperCase(),
    );
    const backupCodeHashes = backupCodes.map((c) =>
      createHash('sha256').update(c).digest('hex'),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodes: backupCodeHashes },
    });

    return { backupCodes };
  }

  // ─── Verify (used during login) ───────────────────────────────────────────────

  async verify(userId: string, code: string): Promise<boolean> {
    const client = this.redis.getClient();

    // Reject immediately if account is locked out
    const failCount = parseInt((await client.get(failKey(userId))) ?? '0', 10);
    if (failCount >= TOTP_FAIL_MAX) {
      this.logger.warn(
        {
          event: 'TOTP_LOCKED',
          userId,
          failCount,
        },
        'TOTP verification locked',
      );
      throw new HttpException(
        {
          code: 'TOTP_LOCKED',
          message:
            '2FA is temporarily locked due to too many failed attempts. Try again in 15 minutes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) return false;

    // Try TOTP code first
    const secret = this.decrypt(user.totpSecret);
    let valid = false;
    try {
      if (verifySync({ token: code, secret, strategy: 'totp' }).valid)
        valid = true;
    } catch {
      // invalid code format — fall through to backup code check
    }

    if (valid) {
      // Replay protection — fail closed on Redis write errors
      let consumed: string | null;
      try {
        consumed = await client.set(
          usedKey(userId, code),
          '1',
          'EX',
          TOTP_REPLAY_WINDOW,
          'NX',
        );
      } catch (err) {
        this.logger.error(
          { event: 'TOTP_REPLAY_CHECK_FAILED', userId, error: String(err) },
          'Redis replay-key write failed during TOTP verify',
        );
        throw new HttpException(
          { code: 'TOTP_VERIFY_FAILED', message: 'Unable to verify 2FA code. Please try again.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (consumed !== 'OK') {
        // Count replay attempts toward the per-account TOTP lockout
        const newCount = await client.incr(failKey(userId));
        if (newCount === 1) await client.expire(failKey(userId), TOTP_FAIL_WINDOW);
        return false;
      }
    }

    // Try backup codes — hybrid: bcrypt for existing codes ($2b$ prefix), SHA-256 for new.
    // New backup codes are 20 uppercase hex chars (10 bytes = 80-bit entropy) and use
    // SHA-256 (fast, constant-time). Existing codes may still use bcrypt ($2b$ prefix).
    if (!valid) {
      const upperCode = code.toUpperCase();
      let matchIdx = -1;
      // Skip the entire backup code loop for codes that cannot possibly be backup codes
      // (e.g. 6-digit TOTP tokens). This prevents CPU-exhaustion attacks that would
      // otherwise trigger up to 10 bcrypt comparisons per request for $2b$-hashed codes.
      const couldBeBackupCode =
        !/^\d{6}$/.test(upperCode) && upperCode.length >= 6;
      if (couldBeBackupCode) {
        let bcryptCount = 0;
        for (let i = 0; i < user.totpBackupCodes.length; i++) {
          const stored = user.totpBackupCodes[i];
          if (stored.startsWith('$2')) {
            bcryptCount++;
            if (bcryptCount > MAX_BCRYPT_COMPARISONS) {
              this.logger.warn(
                {
                  event: 'BCRYPT_LIMIT_HIT',
                  userId,
                  bcryptCount,
                  totalBackupCodes: user.totpBackupCodes.length,
                },
                'Bcrypt comparison limit reached during backup code verification',
              );
              break;
            }
            // bcrypt hash (existing pre-2026-05 codes)
            if (await bcrypt.compare(upperCode, stored)) {
              matchIdx = i;
              break;
            }
          } else {
            // SHA-256 hash — constant-time comparison
            const computedHash = createHash('sha256')
              .update(upperCode)
              .digest('hex');
            const inputBuf = Buffer.from(computedHash, 'hex');
            const storedBuf = Buffer.from(stored, 'hex');
            if (
              storedBuf.length === inputBuf.length &&
              timingSafeEqual(storedBuf, inputBuf)
            ) {
              matchIdx = i;
            }
          }
        }
      }
      if (matchIdx >= 0) {
        const remaining = [...user.totpBackupCodes];
        remaining.splice(matchIdx, 1);
        await this.prisma.user.update({
          where: { id: userId },
          data: { totpBackupCodes: remaining },
        });
        valid = true;
      }
    }

    if (valid) {
      // Clear failure counter on success
      await client.del(failKey(userId));
      this.logger.log(
        {
          event: 'TOTP_SUCCESS',
          userId,
          method: 'totp',
        },
        'TOTP verification succeeded',
      );
      return true;
    }

    // Increment failure counter; set TTL only on first failure so the
    // window starts at the first bad attempt and doesn't keep sliding
    const newCount = await client.incr(failKey(userId));
    if (newCount === 1) {
      await client.expire(failKey(userId), TOTP_FAIL_WINDOW);
    }
    this.logger.warn(
      {
        event: 'TOTP_FAILED',
        userId,
        failCount: newCount,
      },
      'TOTP verification failed',
    );
    return false;
  }

  // ─── Encryption helpers ───────────────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Format: iv:tag:ciphertext (all hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(stored: string): string {
    const [ivHex, tagHex, ciphertextHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    if (tag.length !== 16) {
      throw new Error('Invalid auth tag length');
    }
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv, {
      authTagLength: 16,
    });
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString() + decipher.final('utf8');
  }
}
