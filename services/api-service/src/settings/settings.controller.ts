import { Controller, Get, Patch, Post, Body, UseGuards } from "@nestjs/common";
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
