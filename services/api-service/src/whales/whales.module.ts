import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SharedAuthModule } from "@polyforge/shared-auth";
import { WhalesController } from "./whales.controller";
import { WhalesService } from "./whales.service";
import { WhaleDetectorService } from "./whale-detector.service";
import { SmartMoneyService } from "./smart-money.service";

@Module({
  imports: [ScheduleModule.forRoot(), SharedAuthModule],
  controllers: [WhalesController],
  providers: [WhalesService, WhaleDetectorService, SmartMoneyService],
  exports: [WhalesService, SmartMoneyService],
})
export class WhalesModule {}
