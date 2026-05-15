import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SentimentService } from "./sentiment.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("sentiment")
export class SentimentController {
  constructor(private readonly sentiment: SentimentService) {}

  @Get()
  getOverview(
    @Query("limit") limit?: string,
    @Query("period") period?: "1h" | "24h" | "7d",
  ) {
    return this.sentiment.getOverview(limit ? parseInt(limit) : 20, period);
  }
}
