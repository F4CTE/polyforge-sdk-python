import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { WhalesController } from "./whales.controller";
import { WhalesService } from "./whales.service";
import { WhaleDetectorService } from "./whale-detector.service";
import { SmartMoneyService } from "./smart-money.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [WhalesController],
  providers: [WhalesService, WhaleDetectorService, SmartMoneyService],
  exports: [SmartMoneyService],
})
export class WhalesModule {}
