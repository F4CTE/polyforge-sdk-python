import { Module } from "@nestjs/common";
import { ConfigFlagsController } from "./config-flags.controller";
import { ConfigFlagsService } from "./config-flags.service";

@Module({
  controllers: [ConfigFlagsController],
  providers: [ConfigFlagsService],
})
export class ConfigFlagsModule {}
