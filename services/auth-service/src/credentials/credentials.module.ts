import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedDbModule } from '@polyforge/shared-db';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';

@Module({
  imports: [SharedDbModule, SharedAuthModule, ConfigModule],
  controllers: [CredentialsController],
  providers: [CredentialsService],
})
export class CredentialsModule {}
