import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';
import { InternalClientService } from '../common/services/internal-client.service';

@Module({
    imports: [JwtModule.register({})],
    controllers: [StrategiesController],
    providers: [StrategiesService, InternalClientService],
})
export class StrategiesModule {}
