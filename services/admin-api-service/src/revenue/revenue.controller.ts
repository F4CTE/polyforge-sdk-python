import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RevenueService } from "./revenue.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("admin/revenue")
export class RevenueController {
  constructor(private readonly revenue: RevenueService) {}

  @Get("monthly")
  getMonthly(@Query("months") months?: string) {
    return this.revenue.getMonthlyRevenue(months ? parseInt(months) : 12);
  }

  @Get("breakdown")
  getBreakdown(@Query("period") period?: string) {
    const valid = ["7d", "30d", "90d"];
    const p = valid.includes(period ?? "") ? period! : "30d";
    return this.revenue.getBreakdown(p);
  }

  @Get("top-users")
  getTopUsers(
    @Query("period") period?: string,
    @Query("limit") limit?: string,
  ) {
    const valid = ["7d", "30d", "90d"];
    const p = valid.includes(period ?? "") ? period! : "30d";
    const parsed = limit != null ? parseInt(limit) : NaN;
    const l = Math.min(Math.max(Number.isNaN(parsed) ? 10 : parsed, 1), 50);
    return this.revenue.getTopUsers(p, l);
  }
}
