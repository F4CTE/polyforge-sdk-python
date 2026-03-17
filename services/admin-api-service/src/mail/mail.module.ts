import { Module } from '@nestjs/common';
import { AdminMailService } from './mail.service';

@Module({
    providers: [AdminMailService],
    exports: [AdminMailService],
})
export class AdminMailModule {}
