import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@polyforge/shared-redis';
import { PrismaService } from '@polyforge/shared-db';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TotpService } from '../totp/totp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtPayload } from '@polyforge/shared-types';
import { randomUUID, createHash } from 'crypto';

const INVITE_KEY = (code: string) => `invite:${code.toUpperCase()}`;

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
// R5-02: 15m — balances security with UX (silent refresh should handle rotation transparently)
const ACCESS_TOKEN_EXPIRY = '15m';

/** Redis key for a single refresh token: refresh:{userId}:{sha256(token)} */
const REFRESH_KEY = (userId: string, tokenHash: string) =>
  `refresh:${userId}:${tokenHash}`;

/** Pattern to match all refresh tokens for a user */
const REFRESH_PATTERN = (userId: string) => `refresh:${userId}:*`;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Lua: atomically GET + DEL both refresh keys. Returns the stored value if the
// primary key existed; returns false (nil) if already consumed by another caller.
const ATOMIC_REFRESH_CONSUME_LUA = `
  local val = redis.call('GET', KEYS[1])
  if val then
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[2])
    return val
  end
  return false
`;

function deriveUserStatus(user: {
  emailVerified: boolean;
  polymarketConnected: boolean;
  suspended: boolean;
  approved?: boolean;
}): string {
  if (user.suspended) return 'SUSPENDED';
  if (user.approved === false) return 'PENDING';
  if (user.polymarketConnected) return 'CONNECTED';
  if (user.emailVerified) return 'VERIFIED';
  return 'UNVERIFIED';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly totpService: TotpService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check Redis runtime flag first; fall back to env var
    const redisFlagRaw = await this.redis.get('config:invite_only');
    const inviteOnly =
      redisFlagRaw !== null
        ? redisFlagRaw === 'true'
        : this.config.get<string>('INVITE_ONLY') === 'true';
    // Determine if this registration has a valid invite code
    let hasValidInvite = false;
    if (inviteOnly && dto.inviteCode) {
      const key = INVITE_KEY(dto.inviteCode);
      const client = this.redis.getClient();

      // Atomic invite code redemption via Lua script.
      const redeemScript = `
        local val = redis.call('GET', KEYS[1])
        if val == false then return -1 end
        local remaining = tonumber(val)
        if remaining <= 0 then return -2 end
        if remaining <= 1 then
          redis.call('DEL', KEYS[1])
          return 0
        else
          redis.call('DECRBY', KEYS[1], 1)
          return remaining - 1
        end
      `;
      const result = (await client.eval(redeemScript, 1, key)) as number;

      if (result === -1) {
        throw new HttpException(
          { code: 'INVITE_INVALID', message: 'Invalid or expired invite code' },
          HttpStatus.FORBIDDEN,
        );
      }
      if (result === -2) {
        throw new HttpException(
          {
            code: 'INVITE_INVALID',
            message: 'Invite code has been fully redeemed',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      hasValidInvite = true;
    }

    // Create user — approved immediately if they have a valid invite code,
    // otherwise pending approval (beta waitlist)
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      username: dto.username,
      approved: !inviteOnly || hasValidInvite,
    });

    if (!user.approved) {
      // Pending user — send verification email so they can verify while waiting, do NOT issue JWT
      this.usersService
        .createEmailVerificationToken(user.id)
        .then((verifyToken) =>
          this.mailService.sendVerificationEmail(user.email, verifyToken),
        )
        .catch((err) =>
          this.logger.error('Failed to send verification email', err),
        );

      return {
        pending: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          status: 'PENDING',
          createdAt: user.createdAt,
        },
      };
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    // Send verification email — fire-and-forget, never fail registration
    this.usersService
      .createEmailVerificationToken(user.id)
      .then((verifyToken) =>
        this.mailService.sendVerificationEmail(user.email, verifyToken),
      )
      .catch((err) =>
        this.logger.error('Failed to send verification email', err),
      );

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: deriveUserStatus(user),
        createdAt: user.createdAt,
      },
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────────

  async login(dto: LoginDto & { ip?: string; userAgent?: string }) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || user.deleted) {
      this.logger.warn(
        {
          event: 'LOGIN_FAILED',
          ...(user ? { userId: user.id } : {}),
          ip: dto.ip ?? 'unknown',
          reason: 'unknown_or_deleted_user',
        },
        'User login failed',
      );
      throw new HttpException(
        { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.suspended) {
      throw new HttpException(
        {
          code: 'ACCOUNT_SUSPENDED',
          message: 'This account has been suspended',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.approved === false) {
      throw new HttpException(
        {
          code: 'ACCOUNT_PENDING',
          message:
            'Your account is pending approval. You will receive an email once approved.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // SECURITY: Per-account lockout after 10 failed attempts (15-minute window)
    const lockKey = `login:fail:${user.id}`;
    const failCount = parseInt((await this.redis.get(lockKey)) ?? '0', 10);
    if (failCount >= 10) {
      this.logger.warn(
        {
          event: 'LOGIN_LOCKED',
          userId: user.id,
          ip: dto.ip ?? 'unknown',
          failCount,
        },
        'User login locked',
      );
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed attempts. Try again in 15 minutes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isValid = await this.usersService.validatePassword(
      user,
      dto.password,
    );
    if (!isValid) {
      // Increment per-account failure counter
      const client = this.redis.getClient();
      const newCount = await client.incr(lockKey);
      if (newCount === 1) await client.expire(lockKey, 900); // 15-minute window

      // R5-05: Record failed login attempt
      this.prisma.userLoginHistory
        .create({
          data: {
            userId: user.id,
            ip: dto.ip ?? 'unknown',
            userAgent: dto.userAgent ?? 'unknown',
            success: false,
          },
        })
        .catch(() => {}); // Fire and forget
      this.logger.warn(
        {
          event: 'LOGIN_FAILED',
          userId: user.id,
          ip: dto.ip ?? 'unknown',
          reason: 'invalid_password',
        },
        'User login failed',
      );
      throw new HttpException(
        { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Upgrade weak bcrypt rounds transparently — fire-and-forget
    this.usersService
      .rehashIfNeeded(user.id, dto.password, user.passwordHash)
      .catch((err) => this.logger.error('Failed to rehash password', err));

    if (user.totpEnabled) {
      if (!dto.totpCode) {
        throw new HttpException(
          { code: 'TOTP_REQUIRED', message: '2FA code is required' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const totpValid = await this.totpService.verify(user.id, dto.totpCode);
      if (!totpValid) {
        this.logger.warn(
          {
            event: 'TOTP_FAILED',
            userId: user.id,
            ip: dto.ip ?? 'unknown',
            reason: 'invalid_totp',
          },
          'User TOTP verification failed',
        );
        throw new HttpException(
          { code: 'TOTP_INVALID', message: 'Invalid 2FA code' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    // R5-05: Record successful login in UserLoginHistory
    const ip = dto.ip ?? 'unknown';
    const userAgent = dto.userAgent ?? 'unknown';
    this.prisma.userLoginHistory
      .create({
        data: {
          userId: user.id,
          ip,
          userAgent,
          success: true,
        },
      })
      .catch(() => {}); // Fire and forget — don't fail login if history write fails

    // Record login event for audit trail
    // Clear login lockout counter on success
    await this.redis.del(lockKey).catch(() => {});

    // SECURITY: Do not log email (PII) — userId is sufficient for audit correlation
    this.logger.log(
      {
        event: 'LOGIN_SUCCESS',
        userId: user.id,
        ip,
        timestamp: new Date().toISOString(),
      },
      'User login succeeded',
    );

    // Emit LOGIN event to Redis stream for notification-service / audit consumers
    this.redis
      .getClient()
      .xadd(
        'stream:auth:events',
        '*',
        'event',
        'LOGIN',
        'userId',
        user.id,
        'ip',
        ip,
        'ts',
        Date.now().toString(),
      )
      .catch((err) =>
        this.logger.error('Failed to emit LOGIN event to stream', err),
      );

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        status: deriveUserStatus(user),
        polymarketConnected: user.polymarketConnected,
        emailVerified: user.emailVerified,
      },
      requiresTotp: user.totpEnabled,
    };
  }

  // ─── Me ───────────────────────────────────────────────────────────────────────

  async me(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user || user.deleted) {
      throw new HttpException(
        { code: 'UNAUTHORIZED', message: 'User not found' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Phase 1 (POLA-956) adds polymarketUsConnected + country to User — cast until migration lands
    const u = user as any;
    const polymarketUsConnected: boolean = !!u.polymarketUsConnected;
    const activeRail: 'us' | 'global' =
      u.country === 'US' && polymarketUsConnected ? 'us' : 'global';

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      status: deriveUserStatus(user),
      polymarketConnected: user.polymarketConnected,
      polymarketUsConnected,
      kalshiConnected: user.kalshiConnected,
      emailVerified: user.emailVerified,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      activeRail,
    };
  }

  // ─── Verify email ─────────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    await this.usersService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  // ─── Forgot password ──────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    // Always return 200 — prevents email enumeration
    const user = await this.usersService.findByEmail(dto.email);
    if (user && !user.deleted) {
      this.usersService
        .createPasswordResetToken(user.id)
        .then((token) =>
          this.mailService.sendPasswordResetEmail(user.email, token),
        )
        .catch((err) =>
          this.logger.error('Failed to send password reset email', err),
        );
    }
    return { message: 'If that email exists, a reset link has been sent' };
  }

  // ─── Reset password ───────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    await this.usersService.resetPassword(dto.token, dto.newPassword);

    return { message: 'Password reset successfully' };
  }

  // ─── Refresh token ──────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const lookupKey = `refresh_lookup:${tokenHash}`;

    const userId = await this.redis.get(lookupKey);
    if (!userId) {
      throw new HttpException(
        {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const refreshKey = REFRESH_KEY(userId, tokenHash);

    // Atomic consume via Lua — only the first concurrent caller wins.
    const consumed = await this.atomicConsumeRefreshToken(
      refreshKey,
      lookupKey,
    );

    if (!consumed) {
      this.logger.warn(
        `Refresh token replay detected for user ${userId} — revoking all tokens`,
      );
      await this.revokeAllRefreshTokens(userId);
      throw new HttpException(
        {
          code: 'REFRESH_TOKEN_REPLAY',
          message: 'Refresh token replay detected — please re-authenticate',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user || user.deleted || user.suspended) {
      throw new HttpException(
        {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.createRefreshToken(userId);
    return { token: accessToken, refreshToken: newRefreshToken };
  }

  private async atomicConsumeRefreshToken(
    refreshKey: string,
    lookupKey: string,
  ): Promise<string | null> {
    const client = this.redis.getClient();
    const result = await (client as any).call(
      'EVAL',
      ATOMIC_REFRESH_CONSUME_LUA,
      2,
      refreshKey,
      lookupKey,
    );
    return typeof result === 'string' ? result : null;
  }

  /** Revoke a single refresh token (used on logout) */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    // We don't know the userId from the token alone, so scan for the key
    const result = await this.scanRefreshKeys(refreshToken);
    if (result) {
      await this.redis.del(result.key);
    }
  }

  /** Revoke ALL refresh tokens for a user (used on password change) */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const pattern = REFRESH_PATTERN(userId);
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
      this.logger.log(`Revoked ${count} refresh tokens for user ${userId}`);
    }
  }

  // ─── Resend verification ──────────────────────────────────────────────────────

  async resendVerification(dto: ResendVerificationDto) {
    // Always return 200 — prevents email enumeration
    const user = await this.usersService.findByEmail(dto.email);
    if (user && !user.deleted && !user.emailVerified) {
      this.usersService
        .createEmailVerificationToken(user.id)
        .then((verifyToken) =>
          this.mailService.sendVerificationEmail(user.email, verifyToken),
        )
        .catch((err) =>
          this.logger.error('Failed to resend verification email', err),
        );
    }
    return {
      message:
        'If that email exists and is unverified, a verification link has been sent',
    };
  }

  // ─── Delete account ─────────────────────────────────────────────────────────

  async deleteAccount(userId: string, password: string) {
    const user = await this.usersService.findById(userId);

    if (!user || user.deleted) {
      throw new HttpException(
        { code: 'UNAUTHORIZED', message: 'User not found' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isValid = await this.usersService.validatePassword(user, password);
    if (!isValid) {
      throw new HttpException(
        { code: 'INVALID_PASSWORD', message: 'Password is incorrect' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // SECURITY: Stop all financial operations BEFORE erasing the account.
    // These must be synchronous to prevent strategies from trading after deletion.

    // 1. Stop all running strategies
    await this.prisma.strategy.updateMany({
      where: { userId, status: 'RUNNING' as any },
      data: { status: 'STOPPED' as any },
    });

    // 2. Revoke all API keys
    await this.prisma.apiKey.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    // 3. Revoke all refresh tokens
    await this.revokeAllRefreshTokens(userId).catch((err) =>
      this.logger.error(
        'Failed to revoke refresh tokens on account deletion',
        err,
      ),
    );

    // 4. Deactivate webhooks and bot connections
    await Promise.all([
      this.prisma.webhook.updateMany({
        where: { userId, active: true },
        data: { active: false },
      }),
      this.prisma.botConnection.updateMany({
        where: { userId, active: true },
        data: { active: false },
      }),
    ]);

    // 5. GDPR right-to-erasure: anonymize PII fields
    const anonId = randomUUID().replace(/-/g, '').slice(0, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${anonId}@anon.local`,
        username: `del_${anonId}`,
        passwordHash: '',
        displayName: null,
        bio: null,
        avatarUrl: null,
        twitterHandle: null,
        totpSecret: null,
        totpEnabled: false,
        totpBackupCodes: [],
        polymarketAddress: null,
        polymarketConnected: false,
        kalshiUserId: null,
        kalshiConnected: false,
        polymarketUsConnected: false,
        country: null,
        venuePreferences: undefined,
        deleted: true,
        deletedAt: new Date(),
      },
    });

    // 6. Emit domain event for downstream service purging
    this.redis
      .getClient()
      .xadd(
        'stream:auth:events',
        '*',
        'event',
        'USER_DELETED',
        'userId',
        userId,
        'ts',
        Date.now().toString(),
      )
      .catch((err) =>
        this.logger.error('Failed to emit USER_DELETED event to stream', err),
      );

    this.logger.log(`Account erased (GDPR): userId=${userId}`);
  }

  // ─── Token helpers ──────────────────────────────────────────────────────────

  private generateAccessToken(user: {
    id: string;
    username: string;
    kalshiConnected?: boolean;
  }): string {
    // Email intentionally omitted: JWTs are routinely logged by infra and
    // third-party SDKs. Keep PII out of the signed payload (GDPR).
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      kalshiConnected: user.kalshiConnected ?? false,
    };
    return this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      algorithm: 'HS256',
    });
  }

  /** Create a refresh token (random UUID), store its hash in Redis with TTL.
   *  Also stores a reverse lookup key for O(1) token resolution (avoids SCAN). */
  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomUUID();
    const tokenHash = hashToken(token);
    const key = REFRESH_KEY(userId, tokenHash);
    await this.redis.set(key, userId, REFRESH_TTL_SECONDS);
    // Reverse lookup: tokenHash -> userId (O(1) instead of SCAN)
    await this.redis.set(
      `refresh_lookup:${tokenHash}`,
      userId,
      REFRESH_TTL_SECONDS,
    );
    return token;
  }

  /** Find the Redis key and userId for a given raw refresh token.
   *  Uses O(1) reverse lookup instead of SCAN to avoid timing side channels. */
  private async scanRefreshKeys(
    refreshToken: string,
  ): Promise<{ userId: string; key: string } | null> {
    const tokenHash = hashToken(refreshToken);

    // O(1) reverse lookup — no SCAN needed
    const userId = await this.redis.get(`refresh_lookup:${tokenHash}`);
    if (!userId) return null;

    const key = REFRESH_KEY(userId, tokenHash);
    // Verify the primary key still exists (not revoked)
    const stored = await this.redis.get(key);
    if (!stored) {
      // Clean up orphaned reverse lookup
      await this.redis.del(`refresh_lookup:${tokenHash}`);
      return null;
    }

    return { userId, key };
  }
}
