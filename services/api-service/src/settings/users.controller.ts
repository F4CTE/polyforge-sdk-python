import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  CurrentUser,
  ApiKeyScopeGuard,
  RequireScopes,
} from "@polyforge/shared-auth";
import { SettingsService } from "./settings.service";
import { UpdateEventNotificationsDto } from "./dto/update-event-notifications.dto";
import { UpdateVenuePreferencesDto } from "./dto/update-venue-preferences.dto";
import { PaginationDto } from "../common/dto/pagination.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("users")
@ApiBearerAuth("jwt")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly settings: SettingsService) {}

  @Get("me/following")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  getFollowing(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.settings.getFollowing(user.sub, query.page, query.limit);
  }

  @Get("me/notification-preferences")
  getNotificationPreferences(@CurrentUser() user: JwtPayload) {
    return this.settings.getEventNotifications(user.sub);
  }

  @Put("me/notification-preferences")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEventNotificationsDto,
  ) {
    return this.settings.updateEventNotifications(user.sub, dto);
  }

  @Get("me/venue-preferences")
  getVenuePreferences(@CurrentUser() user: JwtPayload) {
    return this.settings.getVenuePreferences(user.sub);
  }

  @Patch("me/venue-preferences")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  updateVenuePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateVenuePreferencesDto,
  ) {
    return this.settings.updateVenuePreferences(user.sub, dto);
  }
}
