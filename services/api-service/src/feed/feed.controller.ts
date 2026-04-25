import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { WhalesService } from "../whales/whales.service";
import { WhaleFeedQueryDto } from "../whales/dto/whale-query.dto";

@ApiTags("feed")
@ApiBearerAuth("jwt")
@Controller("feed")
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly whales: WhalesService) {}

  @Get()
  getFeed(@Query() query: WhaleFeedQueryDto) {
    return this.whales.getFeed(query);
  }
}
