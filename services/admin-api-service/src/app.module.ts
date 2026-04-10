import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { APP_GUARD } from "@nestjs/core";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { HealthController } from "./common/health.controller";
import { AdminGuardModule } from "./common/guard/admin-guard.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { UsersModule } from "./users/users.module";
import { StrategiesModule } from "./strategies/strategies.module";
import { OrdersModule } from "./orders/orders.module";
import { CacheAdminModule } from "./cache/cache.module";
import { BacktestsModule } from "./backtests/backtests.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { LogsModule } from "./logs/logs.module";
import { BuilderModule } from "./builder/builder.module";
import { RetentionModule } from "./retention/retention.module";
import { InvitesModule } from "./invites/invites.module";
import { WaitlistAdminModule } from "./waitlist/waitlist.module";
import { ConfigFlagsModule } from "./config-flags/config-flags.module";
import { AuditModule } from "./common/audit/audit.module";
import { AdminsModule } from "./admins/admins.module";
import { TicketsModule } from "./tickets/tickets.module";
import { KeyRotationModule } from "./key-rotation/key-rotation.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60000, limit: 60 }],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
    }),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    AdminGuardModule,
    AuditModule,
    DashboardModule,
    UsersModule,
    StrategiesModule,
    OrdersModule,
    CacheAdminModule,
    BacktestsModule,
    ReportsModule,
    NotificationsModule,
    LogsModule,
    BuilderModule,
    RetentionModule,
    InvitesModule,
    WaitlistAdminModule,
    ConfigFlagsModule,
    AdminsModule,
    TicketsModule,
    KeyRotationModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
