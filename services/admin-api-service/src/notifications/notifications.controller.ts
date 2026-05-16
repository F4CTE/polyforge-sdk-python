import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { NotificationsAdminService } from "./notifications.service";
import { BroadcastDto } from "./dto/broadcast.dto";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AuditService } from "../common/audit/audit.service";
import {
  CurrentAdmin,
  AdminIp,
} from "../common/decorators/current-admin.decorator";
import { AdminJwtPayload, AdminRole } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("notifications")
export class NotificationsAdminController {
  constructor(
    private readonly notifications: NotificationsAdminService,
    private readonly audit: AuditService,
  ) {}

  @Post("broadcast")
  @Roles(AdminRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async broadcast(
    @Body() dto: BroadcastDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "BROADCAST_NOTIFICATION",
      targetType: "notification",
      payload: {
        channel: dto.channel,
        templateId: dto.templateId,
        subject: dto.subject,
        userIds: dto.userIds,
        recipientCount: dto.userIds?.length,
      },
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.notifications.broadcast(dto);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Get("stats")
  getStats() {
    return this.notifications.getStats();
  }

  @Get("dlq")
  @Roles(AdminRole.SUPER_ADMIN)
  getDlqEntries(
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const parsedLimit =
      limit != null ? parseInt(limit, 10) : undefined;
    const validLimit =
      parsedLimit != null &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0
        ? parsedLimit
        : undefined;
    return this.notifications.getDlqEntries(validLimit, cursor);
  }

  @Post("dlq/:id/replay")
  @Roles(AdminRole.SUPER_ADMIN)
  async replayDlqEntry(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "REPLAY_DLQ_ENTRY",
      targetType: "notification",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.notifications.replayDlqEntry(id);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Delete("dlq/:id")
  @Roles(AdminRole.SUPER_ADMIN)
  async discardDlqEntry(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "DISCARD_DLQ_ENTRY",
      targetType: "notification",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.notifications.discardDlqEntry(id);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
