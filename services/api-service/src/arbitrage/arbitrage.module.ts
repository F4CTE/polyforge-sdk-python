import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SharedAuthModule } from "@polyforge/shared-auth";
import { ArbitrageController } from "./arbitrage.controller";
import { ArbitrageService } from "./arbitrage.service";
import { MarketMatchService } from "./market-match.service";
import { CrossVenueArbitrageService } from "./cross-venue-arbitrage.service";
import { ArbitrageAlertService } from "./arbitrage-alert.service";

@Module({
  imports: [ScheduleModule.forRoot(), SharedAuthModule],
  controllers: [ArbitrageController],
  providers: [
    ArbitrageService,
    MarketMatchService,
    CrossVenueArbitrageService,
    ArbitrageAlertService,
  ],
  exports: [MarketMatchService, CrossVenueArbitrageService],
})
export class ArbitrageModule {}
