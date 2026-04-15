import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { ProfileService } from "./profile.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("profile")
@ApiBearerAuth("jwt")
@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch("me")
  updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profile.updateProfile(user.sub, dto);
  }

  @Post("password")
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.profile.changePassword(user.sub, dto);
  }

  @Patch("notifications")
  updateNotifications(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, boolean>,
  ) {
    return this.profile.updateNotifications(user.sub, dto);
  }

  @Get(":username")
  getProfile(
    @Param("username") username: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.profile.getProfile(username, user?.sub);
  }

  @Post(":username/follow")
  toggleFollow(
    @Param("username") username: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.profile.toggleFollow(username, user.sub);
  }
}
