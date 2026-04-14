import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { throttleLimit } from '../common/throttle-limit';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: throttleLimit(3),
      ttl: 3600000,
    },
  })
  @ApiOperation({ summary: 'Join the early-access waitlist' })
  @ApiResponse({ status: 200, description: 'Added to waitlist.' })
  async join(@Body() dto: JoinWaitlistDto) {
    return this.waitlist.join(dto);
  }
}
