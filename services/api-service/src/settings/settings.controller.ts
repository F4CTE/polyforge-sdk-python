import {
  ForbiddenException,
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import { SettingsService } from "./settings.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";
import { UpdateRiskSettingsDto } from "./dto/update-risk-settings.dto";
import { JwtPayload } from "@polyforge/shared-types";
import type { FastifyReply } from "fastify";
import { NoCacheInterceptor } from "../common/interceptors/no-cache.interceptor";

@ApiTags("settings")
@ApiBearerAuth("jwt")
@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Patch("profile")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.settings.updateProfile(user.sub, dto);
  }

  @Get("notifications")
  getNotifications(@CurrentUser() user: JwtPayload) {
    return this.settings.getNotifications(user.sub);
  }

  @Patch("notifications")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  updateNotifications(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.settings.updateNotifications(user.sub, dto);
  }

  @Patch("password")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  updatePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.settings.updatePassword(user.sub, dto);
  }

  @Get("beta-usage")
  getBetaUsage(@CurrentUser() user: JwtPayload) {
    return this.settings.getBetaUsage(user.sub);
  }

  @Get("gas")
  getGasUsage(@CurrentUser() user: JwtPayload) {
    return this.settings.getGasUsage(user.sub);
  }

  @Get("risk")
  getRiskSettings(@CurrentUser() user: JwtPayload) {
    return this.settings.getRiskSettings(user.sub);
  }

  @Patch("risk")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  updateRiskSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRiskSettingsDto,
  ) {
    return this.settings.updateRiskSettings(user.sub, dto);
  }

  @Post("risk/reset")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  resetCircuitBreaker(@CurrentUser() user: JwtPayload) {
    return this.settings.resetCircuitBreaker(user.sub);
  }
}

@ApiTags("settings")
@ApiBearerAuth("jwt")
@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly settings: SettingsService) {}

  @Get("export")
  @UseInterceptors(NoCacheInterceptor)
  async exportPersonalData(
    @CurrentUser() user: JwtPayload,
    @Query("format") format: string | undefined,
    @Req() req: { apiKeyMeta?: unknown },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (req.apiKeyMeta) {
      throw new ForbiddenException(
        "Personal data export requires an authenticated user session",
      );
    }

    const data = await this.settings.exportPersonalData(user.sub);
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format?.toLowerCase() === "csv") {
      res.header("Content-Type", "text/csv; charset=utf-8");
      res.header(
        "Content-Disposition",
        `attachment; filename="polyforge-data-export-${timestamp}.csv"`,
      );
      return this.settings.exportPersonalDataCsv(data);
    }

    res.header("Content-Type", "application/json; charset=utf-8");
    res.header(
      "Content-Disposition",
      `attachment; filename="polyforge-data-export-${timestamp}.json"`,
    );
    return data;
  }
}
