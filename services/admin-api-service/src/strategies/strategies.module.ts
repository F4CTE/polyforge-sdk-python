import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { StrategiesService } from "./strategies.service";
import { StrategiesController } from "./strategies.controller";

@Module({
  imports: [JwtModule.register({})],
  providers: [StrategiesService],
  controllers: [StrategiesController],
})
export class StrategiesModule {}
