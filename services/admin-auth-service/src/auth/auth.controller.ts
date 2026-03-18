import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/login.dto';

const ADMIN_COOKIE = 'pf_admin_token';

function cookieOpts() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   60 * 60, // 1 hour — matches JWT expiry
  };
}

@ApiTags('Admin Auth')
@Controller('')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } })  // 10 per 15 min
  @ApiOperation({ summary: 'Admin login — sets HttpOnly JWT cookie + returns admin profile' })
  @ApiResponse({ status: 200, description: 'Login successful.' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_INACTIVE' })
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(dto);
    reply.setCookie(ADMIN_COOKIE, result.token, cookieOpts());
    return result.admin;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current admin profile (requires valid session cookie)' })
  @ApiResponse({ status: 200, description: 'Returns the authenticated admin profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Req() req: FastifyRequest) {
    const token = (req as any).cookies?.[ADMIN_COOKIE];
    if (!token) throw new UnauthorizedException('Not authenticated');
    return this.authService.getMe(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin logout — clears session cookie and revokes Redis session' })
  @ApiResponse({ status: 204, description: 'Session revoked.' })
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookieToken = (req as any).cookies?.[ADMIN_COOKIE];
    const bearerHeader = req.headers['authorization'];
    await this.authService.logout(cookieToken ? `Bearer ${cookieToken}` : bearerHeader);
    reply.clearCookie(ADMIN_COOKIE, { path: '/' });
  }
}
