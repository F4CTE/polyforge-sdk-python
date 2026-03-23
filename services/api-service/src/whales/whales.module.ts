import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { WhalesController } from "./whales.controller";
import { WhalesService } from "./whales.service";
import { WhaleDetectorService } from "./whale-detector.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [WhalesController],
  providers: [WhalesService, WhaleDetectorService],
})
export class WhalesModule {}
