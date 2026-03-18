import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { TotpService } from './totp.service';
import { TotpController } from './totp.controller';

@Module({
  imports: [SharedDbModule, RedisModule, SharedAuthModule, ConfigModule],
  controllers: [TotpController],
  providers: [TotpService],
  exports: [TotpService],
})
export class TotpModule {}
