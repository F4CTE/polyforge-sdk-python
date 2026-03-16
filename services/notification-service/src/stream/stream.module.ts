import { Module } from '@nestjs/common';
import { EventsConsumerService } from './events-consumer.service';
import { DigestService } from './digest.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [NotificationModule],
    providers: [EventsConsumerService, DigestService],
})
export class StreamModule {}
