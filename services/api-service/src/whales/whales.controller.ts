import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  ApiKeyScopeGuard,
  CurrentUser,
  JwtAuthGuard,
  RequireScopes,
} from "@polyforge/shared-auth";
import { WhalesService } from "./whales.service";
import { SmartMoneyService } from "./smart-money.service";
import { UpsertWhaleAlertFilterDto } from "./dto/whale-alert-filter.dto";
import {
  WhaleFeedQueryDto,
  WhaleTopQueryDto,
  SmartMoneyLeaderboardDto,
} from "./dto/whale-query.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("whales")
@ApiBearerAuth("jwt")
@Controller("whales")
@UseGuards(JwtAuthGuard)
export class WhalesController {
  constructor(
    private readonly whales: WhalesService,
    private readonly smartMoney: SmartMoneyService,
  ) {}

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

  @Get("leaderboard")
  @Throttle({
    default: {
      ttl: 60000,
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
    },
  })
  getLeaderboard(@Query() query: SmartMoneyLeaderboardDto) {
    return this.smartMoney.getLeaderboard(query.limit, query.period);
  }

  @Get("following")
  getFollowing(@CurrentUser() user: JwtPayload) {
    return this.whales.getFollowing(user.sub);
  }

  @Get("alerts/filter")
  getAlertFilter(@CurrentUser() user: JwtPayload) {
    return this.whales.getAlertFilter(user.sub);
  }

  @Put("alerts/filter")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  upsertAlertFilter(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertWhaleAlertFilterDto,
  ) {
    return this.whales.upsertAlertFilter(user.sub, dto);
  }

  @Delete("alerts/filter")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  deleteAlertFilter(@CurrentUser() user: JwtPayload) {
    return this.whales.deleteAlertFilter(user.sub);
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
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  follow(@CurrentUser() user: JwtPayload, @Param("address") address: string) {
    return this.whales.toggleFollow(user.sub, address);
  }

  @Post(":address/unfollow")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  unfollow(@CurrentUser() user: JwtPayload, @Param("address") address: string) {
    return this.whales.toggleFollow(user.sub, address);
  }
}
