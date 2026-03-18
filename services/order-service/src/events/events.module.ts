import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { RedisModule } from "@polyforge/shared-redis";

@Module({
  imports: [RedisModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
