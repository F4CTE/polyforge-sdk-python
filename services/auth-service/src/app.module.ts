import { Module } from '@nestjs/common';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { LoggerModule } from '@polyforge/logger';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    LoggerModule,
    SharedDbModule,
    RedisModule,
    SharedAuthModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }