import { Module } from "@nestjs/common";
import { SharedAuthModule } from "@polyforge/shared-auth";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [SharedAuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
