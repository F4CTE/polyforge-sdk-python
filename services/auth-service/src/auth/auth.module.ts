import { Module } from '@nestjs/common';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { RedisModule } from '@polyforge/shared-redis';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { TotpModule } from '../totp/totp.module';

@Module({
  imports: [UsersModule, MailModule, SharedAuthModule, TotpModule, RedisModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
