import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReviewReportDto } from "./dto/review-report.dto";
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
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: string,
  ) {
    return this.reports.findAll({ page, limit, status });
  }

  @Patch(":id")
  async review(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewReportDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "REVIEW_REPORT",
      targetType: "report",
      targetId: id,
      payload: { status: dto.status, adminNote: dto.adminNote },
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.reports.review(id, admin.sub, dto);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
