import { Module } from "@nestjs/common";
import { AccuracyController } from "./accuracy.controller";
import { AccuracyService } from "./accuracy.service";

@Module({
  controllers: [AccuracyController],
  providers: [AccuracyService],
})
export class AccuracyModule {}
