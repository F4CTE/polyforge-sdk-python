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
    const referralCode = user.sub.slice(0, 8).toUpperCase();
    return {
      referralCode,
      referralLink: `https://polyforge.trade/ref/${referralCode}`,
      stats: {
        invited: 0,
        signedUp: 0,
        active: 0,
        creditsEarned: 0,
      },
      referrals: [],
    };
  }
}
