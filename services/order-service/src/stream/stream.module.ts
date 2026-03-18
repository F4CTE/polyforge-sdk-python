import { Module } from "@nestjs/common";
import { StreamConsumerService } from "./stream-consumer.service";
import { OrdersModule } from "../orders/orders.module";
import { RedisModule } from "@polyforge/shared-redis";

@Module({
  imports: [RedisModule, OrdersModule],
  providers: [StreamConsumerService],
})
export class StreamModule {}
