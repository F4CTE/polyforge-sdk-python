import { Controller, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { SettingsService } from "./settings.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";

@ApiTags("settings")
@ApiBearerAuth("jwt")
@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Patch("profile")
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.settings.updateProfile(user.sub, dto);
  }

  @Patch("notifications")
  updateNotifications(
    @CurrentUser() user: any,
    @Body() dto: Record<string, boolean>,
  ) {
    return this.settings.updateNotifications(user.sub, dto);
  }

  @Patch("password")
  updatePassword(@CurrentUser() user: any, @Body() dto: UpdatePasswordDto) {
    return this.settings.updatePassword(user.sub, dto);
  }
}
