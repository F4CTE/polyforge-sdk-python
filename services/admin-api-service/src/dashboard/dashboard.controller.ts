import { Controller, Get, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getHealth() {
    return this.dashboard.getHealth();
  }

  @Get("rate-limits")
  getRateLimits() {
    return this.dashboard.getRateLimits();
  }

  @Get("platform-stats")
  getPlatformStats() {
    return this.dashboard.getPlatformStats();
  }

  @Get("marketplace-stats")
  getMarketplaceStats() {
    return this.dashboard.getMarketplaceStats();
  }

  @Get("beta-usage")
  getBetaUsage() {
    return this.dashboard.getBetaUsage();
  }
}
