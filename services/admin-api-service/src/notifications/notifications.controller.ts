import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { NotificationsAdminService } from "./notifications.service";
import { BroadcastDto } from "./dto/broadcast.dto";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";

@UseGuards(AdminJwtGuard)
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
