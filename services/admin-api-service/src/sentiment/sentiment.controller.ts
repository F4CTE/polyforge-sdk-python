import { Controller, Get, ParseEnumPipe, Query, UseGuards } from "@nestjs/common";
import { Period, SentimentService } from "./sentiment.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("sentiment")
export class SentimentController {
  constructor(private readonly sentiment: SentimentService) {}

  private static readonly PERIOD_QUERY = {
    ONE_HOUR: "1h",
    TWENTY_FOUR_HOURS: "24h",
    SEVEN_DAYS: "7d",
  } as const;

  @Get()
  getOverview(
    @Query("limit") limit?: string,
    @Query("period", new ParseEnumPipe(SentimentController.PERIOD_QUERY, { optional: true }))
    period?: Period,
  ) {
    return this.sentiment.getOverview(limit ? parseInt(limit) : 20, period);
  }
}
