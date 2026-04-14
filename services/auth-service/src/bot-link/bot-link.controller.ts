import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
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
import { BotLinkService } from './bot-link.service';

@ApiTags('Bot Link')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bot-link')
export class BotLinkController {
  constructor(private readonly botLinkService: BotLinkService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(10),
      ttl: 3600000,
    },
  })
  @ApiOperation({
    summary: 'Generate a 6-digit bot link code (TTL 5 min)',
    description:
      'Enter this code in the Telegram or Discord bot to link your account and receive a bot JWT.',
  })
  @ApiResponse({ status: 200, description: 'Returns code and expiry.' })
  async generate(@CurrentUser() user: JwtPayload) {
    return this.botLinkService.generate(user.sub);
  }
}
