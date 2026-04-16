import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { UsersController } from "./users.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [SettingsController, UsersController],
  providers: [SettingsService],
})
export class SettingsModule {}
