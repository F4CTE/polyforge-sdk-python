import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  CurrentUser,
  ApiKeyScopeGuard,
  RequireScopes,
} from "@polyforge/shared-auth";
import { PaperService } from "./paper.service";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("paper")
@ApiBearerAuth("jwt")
@Controller("paper")
@UseGuards(JwtAuthGuard)
export class PaperController {
  constructor(private readonly paper: PaperService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.paper.getSummary(user.sub);
  }

  @Post("reset")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  reset(@CurrentUser() user: JwtPayload) {
    return this.paper.reset(user.sub);
  }
}
