import { Module } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { MetricsService } from './metrics.service';

@Module({
    providers: [BacktestService, MetricsService],
    exports: [BacktestService],
})
export class BacktestModule {}
