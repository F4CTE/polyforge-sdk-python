import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@polyforge/shared-auth';
import { CurrentUser } from '@polyforge/shared-auth';
import { JwtPayload } from '@polyforge/shared-types';
import { throttleLimit } from '../common/throttle-limit';
import { TotpService } from './totp.service';
import { TotpConfirmDto, TotpDisableDto } from './dto/totp-setup.dto';

@ApiTags('2FA / TOTP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @Post('setup')
  @ApiOperation({
    summary:
      'Start 2FA setup — returns secret, otpauth URI, and QR code data URL',
  })
  @ApiResponse({
    status: 200,
    description: 'Setup initiated. Confirm with a valid TOTP code.',
  })
  @ApiResponse({ status: 409, description: 'TOTP already enabled.' })
  async setup(@CurrentUser() user: JwtPayload) {
    return this.totpService.setup(user.sub);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirm 2FA setup — verifies the first TOTP code and returns 10 backup codes',
  })
  @ApiResponse({
    status: 200,
    description: '2FA enabled. Returns one-time backup codes.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired TOTP code.' })
  async confirm(@CurrentUser() user: JwtPayload, @Body() dto: TotpConfirmDto) {
    return this.totpService.confirm(user.sub, dto.code);
  }

  @Post('backup-codes')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      ttl: 3600000,
      limit: throttleLimit(5),
    },
  })
  @ApiOperation({
    summary: 'Regenerate backup codes — invalidates previous set',
  })
  @ApiResponse({
    status: 200,
    description: '10 new backup codes. Previous codes are invalidated.',
  })
  @ApiResponse({ status: 400, description: 'TOTP_NOT_ENABLED.' })
  async regenBackupCodes(@CurrentUser() user: JwtPayload) {
    return this.totpService.regenBackupCodes(user.sub);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      ttl: 3600000,
      limit: throttleLimit(10),
    },
  })
  @ApiOperation({
    summary: 'Disable 2FA — requires password and current TOTP code',
  })
  @ApiResponse({ status: 200, description: '2FA disabled.' })
  @ApiResponse({
    status: 400,
    description: 'Wrong password or 2FA not enabled.',
  })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code.' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  async disable(@CurrentUser() user: JwtPayload, @Body() dto: TotpDisableDto) {
    await this.totpService.disable(user.sub, dto.password, dto.totpCode);
    return { message: '2FA has been disabled' };
  }
}
