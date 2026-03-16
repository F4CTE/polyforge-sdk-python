import { Module } from '@nestjs/common';
import { BuilderService } from './builder.service';
import { BuilderController } from './builder.controller';

@Module({
    providers: [BuilderService],
    controllers: [BuilderController],
})
export class BuilderModule {}
