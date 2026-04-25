import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@polyforge/shared-auth";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@ApiBearerAuth("jwt")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("correlation/categories")
  getCorrelationByCategory() {
    return this.analytics.getCorrelationCategories();
  }
}
