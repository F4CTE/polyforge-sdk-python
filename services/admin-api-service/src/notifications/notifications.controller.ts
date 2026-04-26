import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { NotificationsAdminService } from "./notifications.service";
import { BroadcastDto } from "./dto/broadcast.dto";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("notifications")
export class NotificationsAdminController {
  constructor(private readonly notifications: NotificationsAdminService) {}

  @Post("broadcast")
  @Roles(AdminRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  broadcast(@Body() dto: BroadcastDto) {
    return this.notifications.broadcast(dto);
  }

  @Get("stats")
  getStats() {
    return this.notifications.getStats();
  }
}
