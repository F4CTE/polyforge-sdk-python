import { Module } from "@nestjs/common";
import { MeController, SettingsController } from "./settings.controller";
import { UsersController } from "./users.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [SettingsController, MeController, UsersController],
  providers: [SettingsService],
})
export class SettingsModule {}
