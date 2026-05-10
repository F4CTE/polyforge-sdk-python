import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedUserDbModule } from '@polyforge/shared-db';
import { RedisModule } from '@polyforge/shared-redis';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { TotpService } from './totp.service';
import { TotpController } from './totp.controller';

@Module({
  imports: [SharedUserDbModule, RedisModule, SharedAuthModule, ConfigModule],
  controllers: [TotpController],
  providers: [TotpService],
  exports: [TotpService],
})
export class TotpModule {}
