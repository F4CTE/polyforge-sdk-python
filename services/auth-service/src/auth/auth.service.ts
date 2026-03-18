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

const INVITE_KEY = (code: string) => `invite:${code.toUpperCase()}`;

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
    ) { }

    // ─── Register ─────────────────────────────────────────────────────────────────

    async register(dto: RegisterDto) {
        // Check Redis runtime flag first; fall back to env var
        const redisFlagRaw = await this.redis.get('config:invite_only');
        const inviteOnly = redisFlagRaw !== null
            ? redisFlagRaw === 'true'
            : this.config.get<string>('INVITE_ONLY') === 'true';
        if (inviteOnly) {
            if (!dto.inviteCode) {
                throw new HttpException(
                    { code: 'INVITE_REQUIRED', message: 'An invite code is required to register' },
                    HttpStatus.FORBIDDEN,
                );
            }
            const key = INVITE_KEY(dto.inviteCode);
            const uses = await this.redis.get(key);
            if (uses === null) {
                throw new HttpException(
                    { code: 'INVITE_INVALID', message: 'Invalid or expired invite code' },
                    HttpStatus.FORBIDDEN,
                );
            }
            const remaining = parseInt(uses, 10);
            if (remaining <= 1) {
                await this.redis.del(key);
            } else {
                await this.redis.getClient().decr(key);
            }
        }

        const user = await this.usersService.create({
            email: dto.email,
            password: dto.password,
            username: dto.username,
        });

        const token = this.generateToken(user);

        // Send verification email — fire-and-forget, never fail registration
        this.usersService.createEmailVerificationToken(user.id)
            .then(verifyToken => this.mailService.sendVerificationEmail(user.email, verifyToken))
            .catch(err => this.logger.error('Failed to send verification email', err));

        return {
            token,
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
                { code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended' },
                HttpStatus.FORBIDDEN,
            );
        }

        const isValid = await this.usersService.validatePassword(user, dto.password);
        if (!isValid) {
            throw new HttpException(
                { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
                HttpStatus.BAD_REQUEST,
            );
        }

        // Upgrade weak bcrypt rounds transparently — fire-and-forget
        this.usersService.rehashIfNeeded(user.id, dto.password, user.passwordHash)
            .catch(err => this.logger.error('Failed to rehash password', err));

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

        const token = this.generateToken(user);

        return {
            token,
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
            this.usersService.createPasswordResetToken(user.id)
                .then(token => this.mailService.sendPasswordResetEmail(user.email, token))
                .catch(err => this.logger.error('Failed to send password reset email', err));
        }
        return { message: 'If that email exists, a reset link has been sent' };
    }

    // ─── Reset password ───────────────────────────────────────────────────────────

    async resetPassword(dto: ResetPasswordDto) {
        await this.usersService.resetPassword(dto.token, dto.newPassword);
        return { message: 'Password reset successfully' };
    }

    // ─── Token ────────────────────────────────────────────────────────────────────

    private generateToken(user: { id: string; email: string; username: string }): string {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
        };
        return this.jwtService.sign(payload);
    }
}
