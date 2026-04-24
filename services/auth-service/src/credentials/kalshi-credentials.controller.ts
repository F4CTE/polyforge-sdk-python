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
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { JwtPayload } from '@polyforge/shared-types';
import { throttleLimit } from '../common/throttle-limit';
import { KalshiCredentialsService } from './kalshi-credentials.service';
import { ImportKalshiCredentialsDto } from './dto/import-kalshi-credentials.dto';

@ApiTags('Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials/kalshi')
export class KalshiCredentialsController {
  constructor(private readonly kalshiCreds: KalshiCredentialsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: throttleLimit(5),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary: 'Connect Kalshi account by storing the Kalshi user ID',
  })
  @ApiResponse({
    status: 204,
    description: 'Kalshi credentials stored. User marked as connected.',
  })
  async import(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportKalshiCredentialsDto,
  ) {
    await this.kalshiCreds.import(user.sub, dto);
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
    summary: 'Disconnect Kalshi account and remove credentials',
  })
  @ApiResponse({
    status: 204,
    description: 'Kalshi credentials removed. User marked as disconnected.',
  })
  @ApiResponse({ status: 404, description: 'No Kalshi credentials found.' })
  async delete(@CurrentUser() user: JwtPayload) {
    await this.kalshiCreds.delete(user.sub);
  }
}
