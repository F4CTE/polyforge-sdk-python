import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SportsController } from "./sports.controller";
import { SportsService } from "./sports.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [SportsController],
  providers: [SportsService],
})
export class SportsModule {}
