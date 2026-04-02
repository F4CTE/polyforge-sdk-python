import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SentimentService } from './sentiment.service';
import { AdminJwtGuard } from '../common/guard/admin-jwt.guard';

@UseGuards(AdminJwtGuard)
@Controller('sentiment')
export class SentimentController {
  constructor(private readonly sentiment: SentimentService) {}

  @Get()
  getOverview(@Query('limit') limit?: string) {
    return this.sentiment.getOverview(limit ? parseInt(limit) : 20);
  }
}
