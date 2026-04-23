import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { EventsGateway } from "./events.gateway";
import { EventsService } from "./events.service";
import { StrategyEventsService } from "./strategy-events.service";

@Module({
  imports: [JwtModule.register({}), WebhooksModule],
  providers: [EventsGateway, EventsService, StrategyEventsService],
  exports: [EventsGateway, StrategyEventsService],
})
export class EventsModule {}
