import { Controller, Post, Get, Body, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { JwtPayload } from '@polyforge/shared-types';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const USER_COOKIE = 'pf_token';

function cookieOpts(maxAge: number) {
    return {
        httpOnly:  true,
        secure:    process.env.NODE_ENV === 'production',
        sameSite:  'lax'  as const,
        path:      '/',
        maxAge,
    };
}

@ApiTags('Auth')
@Controller('')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @Throttle({ default: { limit: 5, ttl: 3600000 } })  // 5 per hour
    @ApiOperation({ summary: 'Register a new user account' })
    @ApiResponse({ status: 201, description: 'Account created. Sets HttpOnly JWT cookie + returns user profile.' })
    @ApiResponse({ status: 409, description: 'EMAIL_TAKEN or USERNAME_TAKEN' })
    @ApiResponse({ status: 400, description: 'Validation error' })
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) reply: FastifyReply,
    ) {
        const result = await this.authService.register(dto);
        reply.setCookie(USER_COOKIE, result.token, cookieOpts(7 * 24 * 60 * 60));
        return result.user;
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 900000 } })  // 10 per 15 min
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiResponse({ status: 200, description: 'Login successful. Sets HttpOnly JWT cookie + returns user profile.' })
    @ApiResponse({ status: 400, description: 'INVALID_CREDENTIALS or TOTP_REQUIRED' })
    @ApiResponse({ status: 403, description: 'ACCOUNT_SUSPENDED' })
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) reply: FastifyReply,
    ) {
        const result = await this.authService.login(dto);
        reply.setCookie(USER_COOKIE, result.token, cookieOpts(7 * 24 * 60 * 60));
        return result.user;
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Returns the authenticated user profile.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async me(@CurrentUser() user: JwtPayload) {
        return this.authService.me(user.sub);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Logout — clears the session cookie' })
    @ApiResponse({ status: 204, description: 'Logged out.' })
    async logout(@Res({ passthrough: true }) reply: FastifyReply) {
        reply.clearCookie(USER_COOKIE, { path: '/' });
    }

    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 3600000 } })  // 10 per hour
    @ApiOperation({ summary: 'Verify email address using token from email link' })
    @ApiResponse({ status: 200, description: 'Email verified successfully.' })
    @ApiResponse({ status: 400, description: 'TOKEN_INVALID, TOKEN_ALREADY_USED, or TOKEN_EXPIRED' })
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 3, ttl: 3600000 } })  // 3 per hour
    @ApiOperation({ summary: 'Request a password reset email (always returns 200 to prevent email enumeration)' })
    @ApiResponse({ status: 200, description: 'Reset email sent if account exists.' })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 3600000 } })  // 10 per hour
    @ApiOperation({ summary: 'Reset password using token from email link' })
    @ApiResponse({ status: 200, description: 'Password reset successfully.' })
    @ApiResponse({ status: 400, description: 'TOKEN_INVALID, TOKEN_ALREADY_USED, or TOKEN_EXPIRED' })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }
}
