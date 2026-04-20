import { Module } from "@nestjs/common";
import { RewardsController } from "./rewards.controller";
import { RewardsService } from "./rewards.service";
import { PolymarketDataApiService } from "../portfolio/polymarket-data-api.service";

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, PolymarketDataApiService],
})
export class RewardsModule {}
