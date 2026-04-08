import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { StrategiesService } from "./strategies.service";
import { StrategiesController } from "./strategies.controller";

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [StrategiesService],
  controllers: [StrategiesController],
})
export class StrategiesModule {}
