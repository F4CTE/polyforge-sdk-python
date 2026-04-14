import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { JwtPayload } from '@polyforge/shared-types';
import { throttleLimit } from '../common/throttle-limit';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

const USER_COOKIE = 'pf_token';
const REFRESH_COOKIE = 'pf_refresh';

const ACCESS_COOKIE_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// COOKIE_SECURE defaults to true so staging deployments over HTTPS always send Secure cookies.
// Set COOKIE_SECURE=false only for local HTTP dev (see .env.example).
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false';

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

@ApiTags('Auth')
@Controller('')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({
    default: {
      limit: throttleLimit(5),
      ttl: 3600000,
    },
  })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description:
      'Account created. Sets HttpOnly JWT cookie + returns user profile.',
  })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN or USERNAME_TAKEN' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.register(dto);
    if (result.pending) {
      // Pending approval — don't issue JWT cookies
      return { pending: true, user: result.user };
    }
    reply.setCookie(
      USER_COOKIE,
      result.token!,
      cookieOpts(ACCESS_COOKIE_MAX_AGE),
    );
    reply.setCookie(
      REFRESH_COOKIE,
      result.refreshToken!,
      cookieOpts(REFRESH_COOKIE_MAX_AGE),
    );
    return result.user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(10),
      ttl: 900000,
    },
  })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description:
      'Login successful. Sets HttpOnly JWT cookie + returns user profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_CREDENTIALS or TOTP_REQUIRED',
  })
  @ApiResponse({ status: 403, description: 'ACCOUNT_SUSPENDED' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Use request.ip — nginx overwrites X-Forwarded-For with $remote_addr so
    // this always reflects the real client IP rather than a spoofed header.
    const clientIp = request.ip ?? 'unknown';
    // R5-05: Pass userAgent for login history recording
    const userAgent = (request.headers['user-agent'] as string) ?? 'unknown';
    const result = await this.authService.login({
      ...dto,
      ip: clientIp,
      userAgent,
    });
    reply.setCookie(
      USER_COOKIE,
      result.token,
      cookieOpts(ACCESS_COOKIE_MAX_AGE),
    );
    reply.setCookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOpts(REFRESH_COOKIE_MAX_AGE),
    );
    return result.user;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the authenticated user profile.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout — clears session cookies and revokes refresh token',
  })
  @ApiResponse({ status: 204, description: 'Logged out.' })
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Revoke refresh token from body (API clients) or cookie (browser clients)
    const tokenToRevoke =
      body?.refreshToken ??
      (request.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (tokenToRevoke) {
      await this.authService.revokeRefreshToken(tokenToRevoke);
    }
    reply.clearCookie(USER_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(30),
      ttl: 900000,
    },
  })
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({
    status: 200,
    description: 'New access token issued. Sets HttpOnly JWT cookie.',
  })
  @ApiResponse({ status: 401, description: 'INVALID_REFRESH_TOKEN' })
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Accept refresh token from body (API clients) or cookie (browser clients)
    const token =
      body?.refreshToken ??
      (request.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'No refresh token provided',
      });
    }
    const result = await this.authService.refresh(token);
    reply.setCookie(
      USER_COOKIE,
      result.token,
      cookieOpts(ACCESS_COOKIE_MAX_AGE),
    );
    reply.setCookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOpts(REFRESH_COOKIE_MAX_AGE),
    );
    return { token: result.token };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(10),
      ttl: 3600000,
    },
  })
  @ApiOperation({ summary: 'Verify email address using token from email link' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({
    status: 400,
    description: 'TOKEN_INVALID, TOKEN_ALREADY_USED, or TOKEN_EXPIRED',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(3),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary:
      'Request a password reset email (always returns 200 to prevent email enumeration)',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent if account exists.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(10),
      ttl: 3600000,
    },
  })
  @ApiOperation({ summary: 'Reset password using token from email link' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({
    status: 400,
    description: 'TOKEN_INVALID, TOKEN_ALREADY_USED, or TOKEN_EXPIRED',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(3),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary:
      'Resend verification email (always returns 200 to prevent email enumeration)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Verification email resent if account exists and is unverified.',
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account (soft-delete)' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully.' })
  @ApiResponse({ status: 400, description: 'INVALID_PASSWORD' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.authService.deleteAccount(user.sub, dto.password);
    reply.clearCookie(USER_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { message: 'Account deleted successfully' };
  }
}
