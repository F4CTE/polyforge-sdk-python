import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { ScoresService } from "./scores.service";

@ApiTags("scores")
@ApiBearerAuth("jwt")
@Controller("scores")
@UseGuards(JwtAuthGuard)
export class ScoresController {
  constructor(private readonly scores: ScoresService) {}

  @Get("me")
  getMyScore(@CurrentUser() user: any) {
    return this.scores.getMyScore(user.sub);
  }

  @Get("top")
  getTopTraders() {
    return this.scores.getTopTraders();
  }

  @Get("me/badges")
  getMyBadges(@CurrentUser() user: any) {
    return this.scores.getMyBadges(user.sub);
  }

  @Get(":userId")
  getUserScore(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.scores.getUserScore(userId);
  }

  @Get(":userId/badges")
  getUserBadges(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.scores.getUserBadges(userId);
  }
}
