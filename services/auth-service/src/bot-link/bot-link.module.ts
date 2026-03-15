import { Module } from '@nestjs/common';
import { RedisModule } from '@polyforge/shared-redis';
import { SharedAuthModule } from '@polyforge/shared-auth';
import { BotLinkService } from './bot-link.service';
import { BotLinkController } from './bot-link.controller';

@Module({
    imports: [RedisModule, SharedAuthModule],
    controllers: [BotLinkController],
    providers: [BotLinkService],
    exports: [BotLinkService],
})
export class BotLinkModule {}
