import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
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
  broadcast(@Body() dto: BroadcastDto) {
    return this.notifications.broadcast(dto);
  }

  @Get("stats")
  getStats() {
    return this.notifications.getStats();
  }
}
