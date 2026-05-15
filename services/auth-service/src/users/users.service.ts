import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { PosthogService } from '@polyforge/shared-posthog';
import * as bcrypt from 'bcrypt';
import { hashPassword, comparePassword } from '../auth/bcrypt.util';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly posthog: PosthogService,
  ) {}

  // ─── Finders ─────────────────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByEmailInsensitive(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
  }

  /**
   * Deterministic indexed canonical lookup: normalizes the input, hits the
   * unique index on email first, and falls back to a case-insensitive scan
   * only for legacy accounts that the migration could not safely normalize.
   * When exactly one legacy account is found, its stored email is
   * transparently normalized so subsequent lookups use the index.
   *
   * Case-colliding legacy emails (two accounts differing only in case) are
   * handled safely: the lookup returns the exact case-sensitive match with
   * the input if one exists, otherwise null.
   *
   * Soft-deleted rows at the canonical email are skipped; the insensitive
   * fallback searches for a non-deleted alternative. Manual remediation is
   * required for colliding accounts.
   */
  async findByEmailCanonical(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    // When a canonical hit exists and the input differs from the
    // normalized form (e.g. "Alice@Example.com" → "alice@example.com"),
    // verify there are no case-colliding legacy accounts.  Without
    // this check a user logging in with mixed-case input could be
    // mapped to a different row whose email happens to match the
    // normalized form.
    if (user && !user.deleted && user.email === normalized) {
      if (email !== normalized) {
        const colliding = await this.prisma.user.findMany({
          where: { email: { equals: normalized, mode: 'insensitive' } },
          select: { id: true, email: true, deleted: true },
        });
        const activeColliding = colliding.filter(
          (m) => !m.deleted && m.id !== user.id,
        );
        if (activeColliding.length > 0) {
          const exact = colliding.find((m) => m.email === email && !m.deleted);
          if (exact) {
            return this.prisma.user.findUnique({ where: { id: exact.id } });
          }
          return null;
        }
      }
      return user;
    }

    const matches = await this.prisma.user.findMany({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });

    const active = matches.filter((m) => !m.deleted);

    if (active.length === 0) return null;

    if (active.length === 1) {
      const legacy = active[0];
      if (legacy.email !== normalized) {
        const deletedWithCanonical = matches.find(
          (m) => m.deleted && m.email === normalized,
        );
        if (!deletedWithCanonical) {
          this.prisma.user
            .update({ where: { id: legacy.id }, data: { email: normalized } })
            .catch(() => {});
        }
      }
      return legacy;
    }

    this.logger.warn(
      `Email collision detected for normalized "${normalized}": ${active.length} active accounts. ` +
        'None will be auto-normalized. Manual remediation required.',
    );

    const exact = active.find((m) => m.email === email);
    return exact ?? null;
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── Create ───────────────────────────────────────────────────────────────────

  async create(data: {
    email: string;
    password: string;
    username: string;
    approved?: boolean;
  }) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingEmail = await this.findByEmailInsensitive(normalizedEmail);
    if (existingEmail) {
      throw new HttpException(
        { code: 'EMAIL_TAKEN', message: 'Email is already registered' },
        HttpStatus.CONFLICT,
      );
    }

    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new HttpException(
        { code: 'USERNAME_TAKEN', message: 'Username is already taken' },
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await hashPassword(data.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        username: data.username,
        tosAcceptedAt: new Date(),
        approved: data.approved ?? true,
        approvedAt: (data.approved ?? true) ? new Date() : undefined,
      },
    });

    this.posthog.capture(user.id, 'user_registered', { source: 'web' });
    this.posthog.identify(user.id, {
      email: user.email,
      username: user.username,
    });

    return user;
  }

  async validatePassword(
    user: { passwordHash: string },
    password: string,
  ): Promise<boolean> {
    return comparePassword(password, user.passwordHash);
  }

  /**
   * If the stored hash was created with fewer than MIN_ROUNDS, rehash transparently.
   * Call this after a successful password verification.
   */
  async rehashIfNeeded(
    userId: string,
    password: string,
    currentHash: string,
  ): Promise<void> {
    const MIN_ROUNDS = 12;
    const rounds = bcrypt.getRounds(currentHash);
    if (rounds < MIN_ROUNDS) {
      const newHash = await hashPassword(password, MIN_ROUNDS);
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });
    }
  }

  // ─── Email verification ───────────────────────────────────────────────────────

  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex'); // 64-char hex
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.emailVerification.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  }

  async verifyEmail(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const record = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new HttpException(
        { code: 'TOKEN_INVALID', message: 'Verification token is invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (record.usedAt) {
      throw new HttpException(
        {
          code: 'TOKEN_ALREADY_USED',
          message: 'Verification token has already been used',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (record.expiresAt < new Date()) {
      throw new HttpException(
        { code: 'TOKEN_EXPIRED', message: 'Verification token has expired' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);
  }

  // ─── Password reset ───────────────────────────────────────────────────────────

  async createPasswordResetToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new HttpException(
        { code: 'TOKEN_INVALID', message: 'Reset token is invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (record.usedAt) {
      throw new HttpException(
        {
          code: 'TOKEN_ALREADY_USED',
          message: 'Reset token has already been used',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (record.expiresAt < new Date()) {
      throw new HttpException(
        { code: 'TOKEN_EXPIRED', message: 'Reset token has expired' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark the password change timestamp before mutating credentials so
    // stale access tokens are fail-closed if Redis is unavailable. The
    // marker auto-expires after 5 minutes; if the DB transaction below
    // fails, the user can retry and the marker will correct itself.
    await this.redis.set(
      `pwchange:${record.userId}`,
      Math.floor(Date.now() / 1000).toString(),
      300,
    );

    const passwordHash = await hashPassword(newPassword, 12);

    try {
      await this.prisma.$transaction([
        this.prisma.passwordResetToken.update({
          where: { tokenHash },
          data: { usedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: record.userId },
          data: { passwordHash },
        }),
      ]);
    } catch (err) {
      void this.redis.del(`pwchange:${record.userId}`).catch(() => {});
      throw err;
    }

    // Revoke sessions only after the DB transaction succeeds so a
    // failing password write does not orphan active sessions.
    await this.revokeAllRefreshTokens(record.userId);

    return record.userId;
  }

  /** Revoke ALL refresh tokens for a user via Redis SCAN + DEL */
  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const pattern = `refresh:${userId}:*`;
    const stream = client.scanStream({ match: pattern, count: 100 });
    const pipeline = client.pipeline();
    let count = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        for (const key of keys) {
          pipeline.del(key);
          count++;
        }
      });
      stream.on('end', () => resolve());

      stream.on('error', (err) => reject(err));
    });

    if (count > 0) {
      await pipeline.exec();
    }
  }
}
