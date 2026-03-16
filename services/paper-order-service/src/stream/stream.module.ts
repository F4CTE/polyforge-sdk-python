import { Module } from '@nestjs/common';
import { StreamConsumerService } from './stream-consumer.service';
import { FillsModule } from '../fills/fills.module';

@Module({
    imports: [FillsModule],
    providers: [StreamConsumerService],
})
export class StreamModule {}
