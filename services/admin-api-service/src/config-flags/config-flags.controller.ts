import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsInt, Min } from "class-validator";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminJwtPayload, AdminRole } from "@polyforge/shared-types";
import { AuditService } from "../common/audit/audit.service";
import {
  CurrentAdmin,
  AdminIp,
} from "../common/decorators/current-admin.decorator";
import { ConfigFlagsService } from "./config-flags.service";
import {
  BetaLimitsConfigService,
  type BetaLimits,
} from "@polyforge/shared-redis";

class SetInviteOnlyDto {
  @IsBoolean()
  enabled!: boolean;
}

class UpdateBetaLimitsDto {
  @IsOptional() @IsInt() @Min(0) maxActiveStrategies?: number;
  @IsOptional() @IsInt() @Min(0) maxConcurrentBacktests?: number;
  @IsOptional() @IsInt() @Min(0) maxBacktestHistoryDays?: number;
  @IsOptional() @IsInt() @Min(0) maxMonthlyVolumeUsdc?: number;
  @IsOptional() @IsInt() @Min(0) maxPositionSizeUsdc?: number;
  @IsOptional() @IsInt() @Min(0) marketDataRateLimitPerMinute?: number;
  @IsOptional() @IsInt() @Min(0) maxMarketplaceListings?: number;
  @IsOptional() @IsInt() @Min(0) maxDailyStrategyExecutions?: number;
}

@ApiTags("config")
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller("config")
export class ConfigFlagsController {
  constructor(
    private readonly flags: ConfigFlagsService,
    private readonly betaLimits: BetaLimitsConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get all runtime config flags" })
  getFlags() {
    return this.flags.getFlags();
  }

  @Patch("invite-only")
  @ApiOperation({ summary: "Toggle invite-only registration mode" })
  async setInviteOnly(
    @Body() dto: SetInviteOnlyDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ) {
    const auditMeta = {
      adminId: admin.sub,
      action: "TOGGLE_INVITE_ONLY",
      targetType: "config",
      payload: { enabled: dto.enabled },
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.flags.setInviteOnly(dto.enabled);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }

  @Get("beta-limits")
  @ApiOperation({ summary: "Get current beta limits" })
  getBetaLimits(): Promise<BetaLimits> {
    return this.betaLimits.getAllLimits();
  }

  @Patch("beta-limits")
  @ApiOperation({
    summary: "Update beta limits (partial update, Redis-backed)",
  })
  async setBetaLimits(
    @Body() dto: UpdateBetaLimitsDto,
    @CurrentAdmin() admin: AdminJwtPayload,
    @AdminIp() ip: string,
  ): Promise<BetaLimits> {
    const updates: Partial<BetaLimits> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (updates as Record<string, number>)[key] = value;
      }
    }
    const auditMeta = {
      adminId: admin.sub,
      action: "UPDATE_BETA_LIMITS",
      targetType: "config",
      payload: updates as Record<string, unknown>,
      ip,
    } as const;

    await this.audit.log({ ...auditMeta, status: "attempt" });
    const result = await this.betaLimits.setLimits(updates);
    await this.audit.logSafe({ ...auditMeta, status: "success" });
    return result;
  }
}
