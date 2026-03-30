import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { LlmService } from "../news/llm.service";

@Module({
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AiController],
  providers: [AiService, LlmService],
})
export class AiModule {}
