import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@polyforge/shared-redis';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TotpService } from '../totp/totp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from '@polyforge/shared-types';
import { randomUUID, createHash } from 'crypto';

const INVITE_KEY = (code: string) => `invite:${code.toUpperCase()}`;

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ACCESS_TOKEN_EXPIRY = '15m';

/** Redis key for a single refresh token: refresh:{userId}:{sha256(token)} */
const REFRESH_KEY = (userId: string, tokenHash: string) =>
  `refresh:${userId}:${tokenHash}`;

/** Pattern to match all refresh tokens for a user */
const REFRESH_PATTERN = (userId: string) => `refresh:${userId}:*`;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function deriveUserStatus(user: {
  emailVerified: boolean;
  polymarketConnected: boolean;
  suspended: boolean;
}): string {
  if (user.suspended) return 'SUSPENDED';
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
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check Redis runtime flag first; fall back to env var
    const redisFlagRaw = await this.redis.get('config:invite_only');
    const inviteOnly =
      redisFlagRaw !== null
        ? redisFlagRaw === 'true'
        : this.config.get<string>('INVITE_ONLY') === 'true';
    if (inviteOnly) {
      if (!dto.inviteCode) {
        throw new HttpException(
          {
            code: 'INVITE_REQUIRED',
            message: 'An invite code is required to register',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      const key = INVITE_KEY(dto.inviteCode);
      const client = this.redis.getClient();

      // Atomic invite code redemption via Lua script.
      // For single-use codes (value "1"): atomically fetches and deletes.
      // For multi-use codes: atomically decrements and rejects if exhausted.
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
    }

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      username: dto.username,
    });

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

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || user.deleted) {
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

    const isValid = await this.usersService.validatePassword(
      user,
      dto.password,
    );
    if (!isValid) {
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
        throw new HttpException(
          { code: 'TOTP_INVALID', message: 'Invalid 2FA code' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

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

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      status: deriveUserStatus(user),
      polymarketConnected: user.polymarketConnected,
      emailVerified: user.emailVerified,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
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

    // Look up the stored refresh token across all users by checking the token's embedded userId
    // We stored the userId inside the value, so we need to find the key first
    const keys = await this.scanRefreshKeys(refreshToken);
    if (!keys) {
      throw new HttpException(
        {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { userId, key } = keys;

    // Validate the user still exists and is active
    const user = await this.usersService.findById(userId);
    if (!user || user.deleted || user.suspended) {
      await this.redis.del(key);
      throw new HttpException(
        {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Issue a new access token (refresh token stays the same until expiry)
    const accessToken = this.generateAccessToken(user);
    return { token: accessToken };
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

  // ─── Token helpers ──────────────────────────────────────────────────────────

  private generateAccessToken(user: {
    id: string;
    email: string;
    username: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  /** Create a refresh token (random UUID), store its hash in Redis with TTL */
  private async createRefreshToken(userId: string): Promise<string> {
    const token = randomUUID();
    const tokenHash = hashToken(token);
    const key = REFRESH_KEY(userId, tokenHash);
    await this.redis.set(key, userId, REFRESH_TTL_SECONDS);
    return token;
  }

  /** Find the Redis key and userId for a given raw refresh token */
  private async scanRefreshKeys(
    refreshToken: string,
  ): Promise<{ userId: string; key: string } | null> {
    const tokenHash = hashToken(refreshToken);
    // Try all possible userId prefixes — but since we store userId as the value,
    // we can use a wildcard scan for the hash suffix
    const client = this.redis.getClient();
    const pattern = `refresh:*:${tokenHash}`;
    const keys = await new Promise<string[]>((resolve, reject) => {
      const found: string[] = [];
      const stream = client.scanStream({ match: pattern, count: 100 });
      stream.on('data', (batch: string[]) => found.push(...batch));
      stream.on('end', () => resolve(found));
      stream.on('error', (err) => reject(err));
    });

    if (keys.length === 0) return null;

    const key = keys[0];
    const userId = await this.redis.get(key);
    if (!userId) return null;

    return { userId, key };
  }
}
