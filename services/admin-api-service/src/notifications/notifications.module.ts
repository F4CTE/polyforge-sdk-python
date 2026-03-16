import { Module } from '@nestjs/common';
import { NotificationsAdminService } from './notifications.service';
import { NotificationsAdminController } from './notifications.controller';

@Module({
    providers: [NotificationsAdminService],
    controllers: [NotificationsAdminController],
})
export class NotificationsModule {}
