import { Module } from "@nestjs/common";
import { FillsService } from "./fills.service";

@Module({
  providers: [FillsService],
  exports: [FillsService],
})
export class FillsModule {}
