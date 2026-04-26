import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { WatchlistService } from "./watchlist.service";
import { IsString } from "class-validator";
import { JwtPayload } from "@polyforge/shared-types";

class AddWatchlistDto {
  @IsString() marketId!: string;
}

@ApiTags("watchlist")
@ApiBearerAuth("jwt")
@Controller("watchlist")
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.watchlist.list(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@CurrentUser() user: JwtPayload, @Body() dto: AddWatchlistDto) {
    return this.watchlist.add(user.sub, dto.marketId);
  }

  @Delete(":marketId")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 60 : 10000,
      ttl: 60_000,
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param("marketId") marketId: string) {
    return this.watchlist.remove(user.sub, marketId);
  }

  @Get(":marketId/status")
  status(@CurrentUser() user: JwtPayload, @Param("marketId") marketId: string) {
    return this.watchlist.isWatched(user.sub, marketId);
  }
}
