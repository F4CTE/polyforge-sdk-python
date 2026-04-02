import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  ApiKeyScopeGuard,
  RequireScopes,
  CurrentUser,
} from "@polyforge/shared-auth";
import { AiService } from "./ai.service";
import { AiQueryDto } from "./dto/ai-query.dto";

@ApiTags("ai")
@ApiBearerAuth("jwt")
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("query")
  query(@CurrentUser() user: any, @Body() dto: AiQueryDto) {
    return this.ai.query(user.sub, dto.query);
  }

  @Get("portfolio-review")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  portfolioReview(@CurrentUser() user: any) {
    return this.ai.portfolioReview(user.sub);
  }
}
