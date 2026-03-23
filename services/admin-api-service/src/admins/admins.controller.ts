import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { AdminsService } from "./admins.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { UpdateAdminDto } from "./dto/update-admin.dto";
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
@Roles(AdminRole.SUPER_ADMIN)
@Controller("admins")
export class AdminsController {
  constructor(
    private readonly admins: AdminsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.admins.findAll();
  }

  @Post()
  async create(
    @Body() dto: CreateAdminDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const created = await this.admins.create(dto);
    await this.audit.log({
      adminId: admin.sub,
      action: "CREATE_ADMIN",
      targetType: "admin",
      targetId: created.id,
      payload: { email: dto.email, role: dto.role },
      ip,
    });
    return created;
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const updated = await this.admins.update(id, admin.sub, dto);
    await this.audit.log({
      adminId: admin.sub,
      action: "UPDATE_ADMIN",
      targetType: "admin",
      targetId: id,
      payload: { role: dto.role, active: dto.active },
      ip,
    });
    return updated;
  }

  @Delete(":id")
  async deactivate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const result = await this.admins.deactivate(id, admin.sub);
    await this.audit.log({
      adminId: admin.sub,
      action: "DEACTIVATE_ADMIN",
      targetType: "admin",
      targetId: id,
      ip,
    });
    return result;
  }
}
