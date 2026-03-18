import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from '@polyforge/logger';
import { RedisModule } from '@polyforge/shared-redis';
import { OrdersModule } from './orders/orders.module';
import { StreamModule } from './stream/stream.module';
import { HealthController } from './health/health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({}),
        LoggerModule,
        RedisModule,
        OrdersModule,
        StreamModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
