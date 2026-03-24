import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { StrategiesController } from "./strategies.controller";
import { StrategiesService } from "./strategies.service";
import { InternalClientService } from "../common/services/internal-client.service";
import { LlmService } from "../news/llm.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [StrategiesController],
  providers: [StrategiesService, InternalClientService, LlmService],
  exports: [StrategiesService],
})
export class StrategiesModule {}
