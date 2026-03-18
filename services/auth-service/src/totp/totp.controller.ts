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
import { TotpService } from './totp.service';
import { TotpConfirmDto, TotpDisableDto } from './dto/totp-setup.dto';

@ApiTags('2FA / TOTP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('totp')
export class TotpController {
    constructor(private readonly totpService: TotpService) {}

    @Post('setup')
    @ApiOperation({ summary: 'Start 2FA setup — returns secret, otpauth URI, and QR code data URL' })
    @ApiResponse({ status: 200, description: 'Setup initiated. Confirm with a valid TOTP code.' })
    @ApiResponse({ status: 409, description: 'TOTP already enabled.' })
    async setup(@CurrentUser() user: JwtPayload) {
        return this.totpService.setup(user.sub);
    }

    @Post('confirm')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirm 2FA setup — verifies the first TOTP code and returns 10 backup codes' })
    @ApiResponse({ status: 200, description: '2FA enabled. Returns one-time backup codes.' })
    @ApiResponse({ status: 400, description: 'Invalid or expired TOTP code.' })
    async confirm(@CurrentUser() user: JwtPayload, @Body() dto: TotpConfirmDto) {
        return this.totpService.confirm(user.sub, dto.code);
    }

    @Delete()
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 3600000, limit: 10 } })
    @ApiOperation({ summary: 'Disable 2FA — requires password confirmation' })
    @ApiResponse({ status: 200, description: '2FA disabled.' })
    @ApiResponse({ status: 400, description: 'Wrong password or 2FA not enabled.' })
    @ApiResponse({ status: 429, description: 'Too many attempts.' })
    async disable(@CurrentUser() user: JwtPayload, @Body() dto: TotpDisableDto) {
        await this.totpService.disable(user.sub, dto.password);
        return { message: '2FA has been disabled' };
    }
}
