import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import * as bcrypt from "bcrypt";
import { hashPassword, comparePassword } from '../auth/bcrypt.util';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Finders ─────────────────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── Create ───────────────────────────────────────────────────────────────────

  async create(data: { email: string; password: string; username: string }) {
    const existingEmail = await this.findByEmail(data.email);
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

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        username: data.username,
        tosAcceptedAt: new Date(),
      },
    });
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

    const passwordHash = await hashPassword(newPassword, 12);

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

    // Revoke all refresh tokens for this user (same as password change flow)
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
