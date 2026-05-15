import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RetentionService } from "./retention.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("admin/retention")
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get("overview")
  getOverview() {
    return this.retention.getOverview();
  }

  @Get("cohorts")
  getCohorts(@Query("months") months?: string) {
    return this.retention.getCohorts(months ? parseInt(months) : 6);
  }

  @Get("trend")
  getTrend(@Query("days") days?: string) {
    return this.retention.getTrend(days ? parseInt(days) : 30);
  }
}
