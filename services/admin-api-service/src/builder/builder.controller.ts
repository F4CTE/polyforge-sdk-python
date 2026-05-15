import { Controller, Get, UseGuards } from "@nestjs/common";
import { BuilderService } from "./builder.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("builder")
export class BuilderController {
  constructor(private readonly builder: BuilderService) {}

  @Get("stats")
  getStats() {
    return this.builder.getStats();
  }

  @Get("leaderboard")
  getLeaderboard() {
    return this.builder.getBuilderLeaderboard();
  }

  @Get("volume")
  getVolume() {
    return this.builder.getBuilderVolume();
  }
}
