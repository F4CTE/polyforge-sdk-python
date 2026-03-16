import { Module } from '@nestjs/common';
import { BacktestsService } from './backtests.service';
import { BacktestsController } from './backtests.controller';

@Module({
    providers: [BacktestsService],
    controllers: [BacktestsController],
})
export class BacktestsModule {}
