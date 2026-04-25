import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "@polyforge/logger";
import { RedisModule } from "@polyforge/shared-redis";
import { SharedDbModule } from "@polyforge/shared-db";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { OrdersModule } from "./orders/orders.module";
import { StreamModule } from "./stream/stream.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { BridgeModule } from "./bridge/bridge.module";
import { RelayerModule } from "./relayer/relayer.module";
import { CtfModule } from "./ctf/ctf.module";
import { HealthController } from "./health/health.controller";
import { HeartbeatService } from "./heartbeat/heartbeat.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    LoggerModule,
    RedisModule,
    SharedDbModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    OrdersModule,
    StreamModule,
    ReconciliationModule,
    BridgeModule,
    RelayerModule,
    CtfModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    HeartbeatService,
  ],
})
export class AppModule {}
