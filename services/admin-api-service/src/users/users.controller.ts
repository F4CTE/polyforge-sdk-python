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
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { AuditService } from "../common/audit/audit.service";
import {
  CurrentAdmin,
  AdminIp,
} from "../common/decorators/current-admin.decorator";
import { AdminJwtPayload } from "@polyforge/shared-types";

@UseGuards(AdminJwtGuard)
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
  ) {
    const suspended =
      suspendedRaw !== undefined ? suspendedRaw === "true" : undefined;
    return this.users.findAll({ page, limit, search, status, suspended });
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

  @Patch(":id/suspend")
  async suspend(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.suspend(id, dto);
    await this.audit.log({
      adminId: admin.sub,
      action: "SUSPEND_USER",
      targetType: "user",
      targetId: id,
      payload: { reason: dto.reason },
      ip,
    });
    return result;
  }

  @Patch(":id/unsuspend")
  async unsuspend(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.unsuspend(id);
    await this.audit.log({
      adminId: admin.sub,
      action: "UNSUSPEND_USER",
      targetType: "user",
      targetId: id,
      ip,
    });
    return result;
  }

  @Patch(":id/limits")
  async updateLimits(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLimitsDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.updateLimits(id, dto);
    await this.audit.log({
      adminId: admin.sub,
      action: "UPDATE_USER_LIMITS",
      targetType: "user",
      targetId: id,
      payload: dto as any,
      ip,
    });
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

  @Delete(":id/api-keys/:keyId")
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("keyId", ParseUUIDPipe) keyId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.users.revokeApiKey(id, keyId);
    await this.audit.log({
      adminId: admin.sub,
      action: "REVOKE_USER_API_KEY",
      targetType: "api_key",
      targetId: keyId,
      payload: { userId: id },
      ip,
    });
    return result;
  }
}
