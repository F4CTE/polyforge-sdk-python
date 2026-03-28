import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { LoggerModule } from '@polyforge/logger';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TotpModule } from './totp/totp.module';
import { CredentialsModule } from './credentials/credentials.module';
import { BotLinkModule } from './bot-link/bot-link.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: process.env.NODE_ENV === 'production' ? 60 : 10000, // 60 req/min prod, effectively unlimited in dev
        },
      ],
    }),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    SharedAuthModule,
    AuthModule,
    UsersModule,
    TotpModule,
    CredentialsModule,
    BotLinkModule,
    ApiKeysModule,
    WaitlistModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
