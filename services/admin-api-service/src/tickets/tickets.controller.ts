import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { TicketsAdminService } from "./tickets.service";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { AdminMessageDto } from "./dto/admin-message.dto";
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
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SUPPORT)
@Controller("tickets")
export class TicketsAdminController {
  constructor(
    private readonly tickets: TicketsAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("assignedTo") assignedTo?: string,
  ) {
    return this.tickets.findAll({ page, limit, status, priority, assignedTo });
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.tickets.findOne(id);
  }

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  async addReply(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminMessageDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "TICKET_REPLY",
      targetType: "ticket",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.tickets.addReply(id, admin.sub, dto);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "UPDATE_TICKET",
      targetType: "ticket",
      targetId: id,
      payload: dto as any,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.tickets.update(id, admin.sub, dto);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Post(":id/close")
  @HttpCode(HttpStatus.OK)
  async close(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "CLOSE_TICKET",
      targetType: "ticket",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.tickets.close(id, admin.sub);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
