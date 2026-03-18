import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { LoggerModule } from '@polyforge/logger';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    LoggerModule,
    SharedDbModule,
    RedisModule,
    ThrottlerModule.forRoot([{ ttl: 900000, limit: 10 }]),
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
