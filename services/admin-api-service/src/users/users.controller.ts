import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
  Optional,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { SuspendUserDto } from "./dto/suspend.dto";
import { UpdateLimitsDto } from "./dto/update-limits.dto";
import { RejectUserDto } from "./dto/reject-user.dto";
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
@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("suspended") suspendedRaw?: string,
    @Query("polymarketConnected") polymarketConnectedRaw?: string,
  ) {
    const suspended =
      suspendedRaw !== undefined ? suspendedRaw === "true" : undefined;
    const polymarketConnected =
      polymarketConnectedRaw !== undefined
        ? polymarketConnectedRaw === "true"
        : undefined;
    return this.users.findAll({
      page,
      limit,
      search,
      status,
      suspended,
      polymarketConnected,
    });
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.findOne(id);
    await this.audit.log({
      adminId: admin.sub,
      action: "VIEW_USER_DETAIL",
      targetType: "user",
      targetId: id,
      ip,
    });
    return result;
  }

  @Get(":id/risk-settings")
  async getRiskSettings(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.getRiskSettings(id);
    await this.audit.log({
      adminId: admin.sub,
      action: "VIEW_USER_RISK_SETTINGS",
      targetType: "user",
      targetId: id,
      ip,
    });
    return result;
  }

  @Patch(":id/suspend")
  async suspend(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "SUSPEND_USER",
      targetType: "user",
      targetId: id,
      payload: { reason: dto.reason },
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.users.suspend(id, dto);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Patch(":id/unsuspend")
  async unsuspend(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "UNSUSPEND_USER",
      targetType: "user",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.users.unsuspend(id);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Patch(":id/approve")
  async approve(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "APPROVE_USER",
      targetType: "user",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.users.approve(id, admin.sub);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Patch(":id/reject")
  async reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectUserDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "REJECT_USER",
      targetType: "user",
      targetId: id,
      ip,
      payload: dto.reason ? { reason: dto.reason } : undefined,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.users.reject(id, dto.reason);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Patch(":id/limits")
  async updateLimits(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLimitsDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "UPDATE_USER_LIMITS",
      targetType: "user",
      targetId: id,
      payload: dto as any,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.users.updateLimits(id, dto);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Get(":id/api-keys")
  async listApiKeys(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.listApiKeys(id);
    await this.audit.log({
      adminId: admin.sub,
      action: "VIEW_USER_API_KEYS",
      targetType: "user",
      targetId: id,
      ip,
    });
    return result;
  }

  @Get(":id/accuracy")
  getUserAccuracy(@Param("id", ParseUUIDPipe) id: string) {
    return this.users.getUserAccuracy(id);
  }

  @Delete(":id/api-keys/:keyId")
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("keyId", ParseUUIDPipe) keyId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "REVOKE_USER_API_KEY",
      targetType: "api_key",
      targetId: keyId,
      payload: { userId: id },
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.users.revokeApiKey(id, keyId);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
