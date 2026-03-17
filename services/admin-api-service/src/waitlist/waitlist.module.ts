import { Module } from '@nestjs/common';
import { WaitlistAdminController } from './waitlist.controller';
import { WaitlistAdminService } from './waitlist.service';

@Module({
    controllers: [WaitlistAdminController],
    providers: [WaitlistAdminService],
})
export class WaitlistAdminModule {}
