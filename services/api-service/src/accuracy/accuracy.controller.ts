import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { IsOptional, IsIn } from "class-validator";
import {
  JwtAuthGuard,
  ApiKeyScopeGuard,
  RequireScopes,
  CurrentUser,
} from "@polyforge/shared-auth";
import { AccuracyService } from "./accuracy.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { JwtPayload } from "@polyforge/shared-types";

class AccuracyLeaderboardQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(["7d", "30d", "allTime"])
  period: string = "30d";
}

@ApiTags("accuracy")
@ApiBearerAuth("jwt")
@Controller("accuracy")
@UseGuards(JwtAuthGuard)
export class AccuracyController {
  constructor(private readonly accuracy: AccuracyService) {}

  @Get()
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  getAccuracy(@CurrentUser() user: JwtPayload) {
    return this.accuracy.getMyAccuracy(user.sub);
  }

  @Get("me")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  getMyAccuracy(@CurrentUser() user: JwtPayload) {
    return this.accuracy.getMyAccuracy(user.sub);
  }

  @Get("leaderboard")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  getLeaderboard(@Query() query: AccuracyLeaderboardQueryDto) {
    return this.accuracy.getLeaderboard(query);
  }
}
