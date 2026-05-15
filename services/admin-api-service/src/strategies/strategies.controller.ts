import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { StrategiesService } from "./strategies.service";
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
@Controller("strategies")
export class StrategiesController {
  constructor(
    private readonly strategies: StrategiesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
    @Query("visibility") visibility?: string,
  ) {
    return this.strategies.findAll({ page, limit, userId, status, visibility });
  }

  @Post("templates")
  @Roles(AdminRole.SUPER_ADMIN)
  async createTemplate(
    @Body("strategyId", ParseUUIDPipe) strategyId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "CREATE_STRATEGY_TEMPLATE",
      targetType: "strategy",
      targetId: strategyId,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.strategies.createTemplate(strategyId);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Post(":id/force-stop")
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async forceStop(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "FORCE_STOP_STRATEGY",
      targetType: "strategy",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.strategies.forceStop(id);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Patch(":id/unpublish")
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  async unpublish(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "UNPUBLISH_STRATEGY",
      targetType: "strategy",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.strategies.unpublish(id);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
