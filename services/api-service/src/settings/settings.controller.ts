import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser, RequireScopes, ApiKeyScopeGuard } from "@polyforge/shared-auth";
import { SettingsService } from "./settings.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateNotificationsDto } from "./dto/update-notifications.dto";

@ApiTags("settings")
@ApiBearerAuth("jwt")
@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Patch("profile")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.settings.updateProfile(user.sub, dto);
  }

  @Patch("notifications")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  updateNotifications(
    @CurrentUser() user: any,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.settings.updateNotifications(user.sub, dto);
  }

  @Patch("password")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('WRITE')
  updatePassword(@CurrentUser() user: any, @Body() dto: UpdatePasswordDto) {
    return this.settings.updatePassword(user.sub, dto);
  }

  @Get("gas")
  getGasUsage(@CurrentUser() user: any) {
    return this.settings.getGasUsage(user.sub);
  }
}
