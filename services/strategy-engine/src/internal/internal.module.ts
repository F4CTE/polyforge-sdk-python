import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InternalController } from './internal.controller';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { StrategyModule } from '../strategy/strategy.module';

@Module({
    imports: [JwtModule.register({}), StrategyModule],
    controllers: [InternalController],
    providers: [InternalAuthGuard],
})
export class InternalModule {}
