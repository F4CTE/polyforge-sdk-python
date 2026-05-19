import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  JwtAuthGuard,
  ApiKeyScopeGuard,
  RequireScopes,
  CurrentUser,
} from "@polyforge/shared-auth";
import { AiService } from "./ai.service";
import { AiQueryDto } from "./dto/ai-query.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("ai")
@ApiBearerAuth("jwt")
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("query")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 20 : 10000,
      ttl: 60000,
    },
  })
  query(@CurrentUser() user: JwtPayload, @Body() dto: AiQueryDto) {
    return this.ai.query(user.sub, dto.query);
  }

  @Get("portfolio-review")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 5 : 10000,
      ttl: 60000,
    },
  })
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  portfolioReview(@CurrentUser() user: JwtPayload) {
    return this.ai.portfolioReview(user.sub);
  }
}
