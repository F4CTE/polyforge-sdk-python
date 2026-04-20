import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { JwtPayload } from "@polyforge/shared-types";
import { RewardsService } from "./rewards.service";

@ApiTags("rewards")
@ApiBearerAuth("jwt")
@Controller("rewards")
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get("markets")
  getRewardsMarkets() {
    return this.rewards.getRewardsMarkets();
  }

  @Get("markets/:conditionId")
  getRewardsForMarket(@Param("conditionId") conditionId: string) {
    return this.rewards.getRewardsForMarket(conditionId);
  }

  @Get("user")
  getUserRewards(@CurrentUser() user: JwtPayload) {
    return this.rewards.getUserRewards(user.sub);
  }

  @Get("user/total")
  getUserRewardsTotal(@CurrentUser() user: JwtPayload) {
    return this.rewards.getUserRewardsTotal(user.sub);
  }

  @Get("user/percentages")
  getUserRewardsPercentages(@CurrentUser() user: JwtPayload) {
    return this.rewards.getUserRewardsPercentages(user.sub);
  }

  @Get("user/markets")
  getUserRewardsPerMarket(@CurrentUser() user: JwtPayload) {
    return this.rewards.getUserRewardsPerMarket(user.sub);
  }

  @Get("rebates")
  getRebates(@CurrentUser() user: JwtPayload) {
    return this.rewards.getRebates(user.sub);
  }
}
