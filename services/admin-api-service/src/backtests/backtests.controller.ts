import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { BacktestsService } from "./backtests.service";
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
@Controller("backtests")
export class BacktestsController {
  constructor(
    private readonly backtests: BacktestsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
  ) {
    return this.backtests.findAll({ page, limit, userId, status });
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "CANCEL_BACKTEST",
      targetType: "backtest",
      targetId: id,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.backtests.cancel(id);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
