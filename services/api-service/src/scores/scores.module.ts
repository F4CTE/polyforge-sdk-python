import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ScoresController } from "./scores.controller";
import { ScoresService } from "./scores.service";
import { ScoreCalculatorService } from "./score-calculator.service";
import { BadgeService } from "./badge.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ScoresController],
  providers: [ScoresService, ScoreCalculatorService, BadgeService],
  exports: [ScoresService],
})
export class ScoresModule {}
