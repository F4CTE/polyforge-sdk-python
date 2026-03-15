import { Module } from '@nestjs/common';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [UsersModule, MailModule, SharedAuthModule],
    providers: [AuthService],
    controllers: [AuthController],
})
export class AuthModule { }