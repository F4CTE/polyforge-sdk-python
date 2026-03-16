import { Module } from '@nestjs/common';
import { StreamConsumerService } from './stream-consumer.service';
import { BacktestModule } from '../backtest/backtest.module';

@Module({
    imports: [BacktestModule],
    providers: [StreamConsumerService],
})
export class StreamModule {}
