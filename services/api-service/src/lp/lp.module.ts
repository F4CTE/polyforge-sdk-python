import { Module } from '@nestjs/common';
import { LpController } from './lp.controller';
import { LpService } from './lp.service';

@Module({
  controllers: [LpController],
  providers: [LpService],
})
export class LpModule {}
