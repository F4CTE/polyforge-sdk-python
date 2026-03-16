import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { LoggerModule } from '@polyforge/logger';
import { HealthController } from './health/health.controller';
import { BotModule } from './bot/bot.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule,
        SharedDbModule,
        RedisModule,
        JwtModule.register({}),
        BotModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
