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
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }], // default: 60 req/min
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
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }