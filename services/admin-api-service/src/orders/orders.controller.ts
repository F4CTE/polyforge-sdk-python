import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
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
@Controller("orders")
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.orders.findAll({ page, limit, userId, status, from, to });
  }

  @Get("dlq")
  getDlq() {
    return this.orders.getDlq();
  }

  @Post("dlq/:intentId/replay")
  async replayDlqEntry(
    @Param("intentId") intentId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "REPLAY_DLQ_ENTRY",
      targetType: "dlq_entry",
      targetId: intentId,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.orders.replayDlqEntry(intentId);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Post("dlq/:intentId/discard")
  async discardDlqEntry(
    @Param("intentId") intentId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "DISCARD_DLQ_ENTRY",
      targetType: "dlq_entry",
      targetId: intentId,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.orders.discardDlqEntry(intentId);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
