import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { SettingsService } from "./settings.service";
import { UpdateEventNotificationsDto } from "./dto/update-event-notifications.dto";
import { JwtPayload } from "@polyforge/shared-types";

/**
 * Exposes the `/users/me/notification-preferences` endpoints consumed by the
 * user-app settings page.  Stored as per-event × per-channel JSON so the UI
 * can toggle inApp / email / push independently for each event type.
 */
@ApiTags("users")
@ApiBearerAuth("jwt")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly settings: SettingsService) {}

  @Get("me/notification-preferences")
  getNotificationPreferences(@CurrentUser() user: JwtPayload) {
    return this.settings.getEventNotifications(user.sub);
  }

  @Put("me/notification-preferences")
  updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEventNotificationsDto,
  ) {
    return this.settings.updateEventNotifications(user.sub, dto);
  }
}
