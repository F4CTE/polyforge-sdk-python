import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CopyController } from "./copy.controller";
import { CopyService } from "./copy.service";
import { CopyEngineService } from "./copy-engine.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CopyController],
  providers: [CopyService, CopyEngineService],
})
export class CopyModule {}
