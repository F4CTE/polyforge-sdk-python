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
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("whales")
@ApiBearerAuth("jwt")
@Controller("whales")
@UseGuards(JwtAuthGuard)
export class WhalesController {
  constructor(private readonly whales: WhalesService) {}

  @Get("feed")
  @Throttle({
    default: {
      ttl: 60000,
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
    },
  })
  getFeed(@Query() query: WhaleFeedQueryDto) {
    return this.whales.getFeed(query);
  }

  @Get("top")
  @Throttle({
    default: {
      ttl: 60000,
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
    },
  })
  getTopWhales(@Query() query: WhaleTopQueryDto) {
    return this.whales.getTopWhales(query);
  }

  @Get("following")
  getFollowing(@CurrentUser() user: JwtPayload) {
    return this.whales.getFollowing(user.sub);
  }

  @Get(":address")
  getProfile(
    @CurrentUser() user: JwtPayload,
    @Param("address") address: string,
  ) {
    return this.whales.getProfile(address, user?.sub);
  }

  @Post(":address/follow")
  @HttpCode(HttpStatus.OK)
  follow(@CurrentUser() user: JwtPayload, @Param("address") address: string) {
    return this.whales.toggleFollow(user.sub, address);
  }

  @Post(":address/unfollow")
  @HttpCode(HttpStatus.OK)
  unfollow(@CurrentUser() user: JwtPayload, @Param("address") address: string) {
    return this.whales.toggleFollow(user.sub, address);
  }
}
