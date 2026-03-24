import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BuilderService } from "./builder.service";
import { BuilderController } from "./builder.controller";

@Module({
  imports: [ConfigModule],
  providers: [BuilderService],
  controllers: [BuilderController],
})
export class BuilderModule {}
