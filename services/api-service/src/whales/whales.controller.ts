import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { WhalesService } from "./whales.service";
import { WhaleFeedQueryDto, WhaleTopQueryDto } from "./dto/whale-query.dto";

@ApiTags("whales")
@ApiBearerAuth("jwt")
@Controller("whales")
@UseGuards(JwtAuthGuard)
export class WhalesController {
  constructor(private readonly whales: WhalesService) {}

  @Get("feed")
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  getFeed(@Query() query: WhaleFeedQueryDto) {
    return this.whales.getFeed(query);
  }

  @Get("top")
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  getTopWhales(@Query() query: WhaleTopQueryDto) {
    return this.whales.getTopWhales(query);
  }

  @Get("following")
  getFollowing(@CurrentUser() user: any) {
    return this.whales.getFollowing(user.sub);
  }

  @Get(":address")
  getProfile(@Param("address") address: string) {
    return this.whales.getProfile(address);
  }

  @Post(":address/follow")
  @HttpCode(HttpStatus.OK)
  toggleFollow(
    @CurrentUser() user: any,
    @Param("address") address: string,
  ) {
    return this.whales.toggleFollow(user.sub, address);
  }
}
