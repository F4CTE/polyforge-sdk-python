import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { StrategiesController } from "./strategies.controller";
import { StrategiesService } from "./strategies.service";
import { InternalClientService } from "../common/services/internal-client.service";
import { LlmService } from "../news/llm.service";
import { EventsModule } from "../gateway/events.module";

@Module({
  imports: [JwtModule.register({}), EventsModule],
  controllers: [StrategiesController],
  providers: [StrategiesService, InternalClientService, LlmService],
  exports: [StrategiesService],
})
export class StrategiesModule {}
