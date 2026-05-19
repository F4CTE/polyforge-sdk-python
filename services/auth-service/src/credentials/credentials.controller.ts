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
import {
  JwtAuthGuard,
  CurrentUser,
  ApiKeyScopeGuard,
  RequireScopes,
} from '@polyforge/shared-auth';
import { JwtPayload } from '@polyforge/shared-types';
import { throttleLimit } from '../common/throttle-limit';
import { CredentialsService } from './credentials.service';
import { ImportCredentialsDto } from './dto/import-credentials.dto';

@ApiTags('Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post()
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: throttleLimit(5),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary:
      'Import Polymarket credentials — forwarded to signer-service for AES-256-GCM storage',
  })
  @ApiResponse({
    status: 204,
    description: 'Credentials stored. User marked as CONNECTED.',
  })
  @ApiResponse({ status: 503, description: 'signer-service unavailable.' })
  async import(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportCredentialsDto,
  ) {
    await this.credentialsService.import(user.sub, dto);
  }

  @Delete()
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Polymarket credentials and disconnect account',
  })
  @ApiResponse({
    status: 204,
    description:
      'Credentials removed. User marked as VERIFIED (or UNVERIFIED).',
  })
  @ApiResponse({ status: 404, description: 'No credentials found.' })
  async delete(@CurrentUser() user: JwtPayload) {
    await this.credentialsService.delete(user.sub);
  }
}
