import {
  Controller,
  Post,
  Delete,
  Body,
  Headers,
  Ip,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { JwtPayload } from '@polyforge/shared-types';
import { throttleLimit } from '../common/throttle-limit';
import { PolymarketUsCredentialsService } from './polymarket-us-credentials.service';
import { ImportPolymarketUsCredentialsDto } from './dto/import-polymarket-us-credentials.dto';

@ApiTags('Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials/polymarket-us')
export class PolymarketUsCredentialsController {
  constructor(private readonly usCredentials: PolymarketUsCredentialsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: throttleLimit(5),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary:
      'Import Polymarket US API credentials (Ed25519 key pair) — forwarded to signer-service for AES-256-GCM storage',
  })
  @ApiHeader({
    name: 'X-Country-Code',
    description: 'ISO 3166-1 alpha-2 country code injected by nginx geoip2',
    required: false,
    example: 'US',
  })
  @ApiResponse({
    status: 204,
    description: 'US credentials stored. User marked as polymarketUsConnected.',
  })
  @ApiResponse({
    status: 502,
    description: 'signer-service returned an error.',
  })
  @ApiResponse({ status: 503, description: 'signer-service unavailable.' })
  async import(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportPolymarketUsCredentialsDto,
    @Headers('x-country-code') countryCode: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ip: string | undefined,
  ): Promise<void> {
    await this.usCredentials.import(
      user.sub,
      dto,
      countryCode,
      ip,
      userAgent,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: throttleLimit(5),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary:
      'Delete Polymarket US credentials, stop US-rail strategies, and disconnect account',
  })
  @ApiResponse({
    status: 204,
    description: 'US credentials removed. User marked as disconnected.',
  })
  @ApiResponse({ status: 404, description: 'No US credentials found.' })
  @ApiResponse({
    status: 502,
    description: 'signer-service returned an error.',
  })
  async delete(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.usCredentials.delete(user.sub);
  }
}
