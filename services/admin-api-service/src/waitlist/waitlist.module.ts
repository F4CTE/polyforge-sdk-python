import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { AdminMailModule } from '../mail/mail.module';
import { WaitlistAdminController } from './waitlist.controller';
import { WaitlistAdminService } from './waitlist.service';

@Module({
    imports: [InvitesModule, AdminMailModule],
    controllers: [WaitlistAdminController],
    providers: [WaitlistAdminService],
})
export class WaitlistAdminModule {}
