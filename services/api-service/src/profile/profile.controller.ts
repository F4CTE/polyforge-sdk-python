import { Controller, Get, Post, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { ProfileService } from "./profile.service";

@ApiTags("profile")
@ApiBearerAuth("jwt")
@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get(":username")
  getProfile(@Param("username") username: string, @CurrentUser() user: any) {
    return this.profile.getProfile(username, user?.sub);
  }

  @Post(":username/follow")
  toggleFollow(@Param("username") username: string, @CurrentUser() user: any) {
    return this.profile.toggleFollow(username, user.sub);
  }
}
