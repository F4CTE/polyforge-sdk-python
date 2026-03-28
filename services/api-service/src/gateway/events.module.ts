import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EventsGateway } from "./events.gateway";
import { EventsService } from "./events.service";
import { StrategyEventsService } from "./strategy-events.service";

@Module({
  imports: [JwtModule.register({})],
  providers: [EventsGateway, EventsService, StrategyEventsService],
  exports: [EventsGateway, StrategyEventsService],
})
export class EventsModule {}
