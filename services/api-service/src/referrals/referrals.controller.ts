import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("referrals")
@ApiBearerAuth("jwt")
@Controller("referrals")
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  @Get("me")
  getMyReferrals(@CurrentUser() user: JwtPayload) {
    return {
      userId: user.sub,
      referralCode: null,
      totalReferred: 0,
      activeReferred: 0,
      earnings: "0",
      referrals: [],
    };
  }
}
