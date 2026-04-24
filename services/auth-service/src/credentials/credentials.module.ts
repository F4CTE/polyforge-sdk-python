import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SharedDbModule } from '@polyforge/shared-db';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { KalshiCredentialsService } from './kalshi-credentials.service';
import { KalshiCredentialsController } from './kalshi-credentials.controller';

@Module({
  imports: [
    SharedDbModule,
    SharedAuthModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [CredentialsController, KalshiCredentialsController],
  providers: [CredentialsService, KalshiCredentialsService],
})
export class CredentialsModule {}
