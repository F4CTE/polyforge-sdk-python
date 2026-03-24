import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
