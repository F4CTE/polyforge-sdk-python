import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsInt, Min } from "class-validator";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";
import { RolesGuard } from "../common/guard/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminRole } from "@polyforge/shared-types";
import { ConfigFlagsService } from "./config-flags.service";
import { BetaLimitsConfigService, type BetaLimits } from "@polyforge/shared-redis";

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
@Roles(AdminRole.SUPER_ADMIN)
@Controller("config")
export class ConfigFlagsController {
  constructor(
    private readonly flags: ConfigFlagsService,
    private readonly betaLimits: BetaLimitsConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get all runtime config flags" })
  getFlags() {
    return this.flags.getFlags();
  }

  @Patch("invite-only")
  @ApiOperation({ summary: "Toggle invite-only registration mode" })
  setInviteOnly(@Body() dto: SetInviteOnlyDto) {
    return this.flags.setInviteOnly(dto.enabled);
  }

  @Get("beta-limits")
  @ApiOperation({ summary: "Get current beta limits" })
  getBetaLimits(): Promise<BetaLimits> {
    return this.betaLimits.getAllLimits();
  }

  @Patch("beta-limits")
  @ApiOperation({ summary: "Update beta limits (partial update, Redis-backed)" })
  setBetaLimits(@Body() dto: UpdateBetaLimitsDto): Promise<BetaLimits> {
    const updates: Partial<BetaLimits> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (updates as Record<string, number>)[key] = value;
      }
    }
    return this.betaLimits.setLimits(updates);
  }
}
