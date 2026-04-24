import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";
import { VenuesService } from "./venues.service";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("venues")
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get("health")
  getHealth() {
    return this.venues.getHealth();
  }
}
