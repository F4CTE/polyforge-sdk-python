import { Module } from '@nestjs/common';
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
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
