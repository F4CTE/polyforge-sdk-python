import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { LoggerModule } from '@polyforge/logger';
import { HealthController } from './common/health.controller';
import { AdminGuardModule } from './common/guard/admin-guard.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { StrategiesModule } from './strategies/strategies.module';
import { OrdersModule } from './orders/orders.module';
import { CacheAdminModule } from './cache/cache.module';
import { BacktestsModule } from './backtests/backtests.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LogsModule } from './logs/logs.module';
import { BuilderModule } from './builder/builder.module';
import { RetentionModule } from './retention/retention.module';
import { InvitesModule } from './invites/invites.module';
import { AuditModule } from './common/audit/audit.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
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
    ],
    controllers: [HealthController],
})
export class AppModule {}
