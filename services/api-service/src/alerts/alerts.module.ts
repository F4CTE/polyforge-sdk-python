import { Module } from "@nestjs/common";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
import { EventsModule } from "../gateway/events.module";

@Module({
  imports: [EventsModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
