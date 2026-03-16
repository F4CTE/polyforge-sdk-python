import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { LoggerModule } from '@polyforge/logger';
import { HealthController } from './health/health.controller';
import { FillsModule } from './fills/fills.module';
import { StreamModule } from './stream/stream.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule,
        SharedDbModule,
        RedisModule,
        FillsModule,
        StreamModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
