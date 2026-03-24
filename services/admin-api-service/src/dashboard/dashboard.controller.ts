import { Controller, Get, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";

@UseGuards(AdminJwtGuard)
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
}
