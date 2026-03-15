import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/login.dto';

@ApiTags('Admin Auth')
@Controller('')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @ApiOperation({ summary: 'Admin login — returns JWT + Redis session' })
  @ApiResponse({ status: 201, description: 'Login successful. Returns JWT (1h) + admin profile.' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  @ApiResponse({ status: 403, description: 'ACCOUNT_INACTIVE' })
  async login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin logout — revokes Redis session' })
  @ApiResponse({ status: 204, description: 'Session revoked.' })
  async logout(@Headers('authorization') authHeader: string) {
    await this.authService.logout(authHeader);
  }
}
