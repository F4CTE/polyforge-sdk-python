import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LinkingService } from './linking.service';
import { CommandsService } from './commands.service';
import { TelegramService } from './telegram.service';
import { DiscordService } from './discord.service';

@Module({
    imports: [JwtModule.register({})],
    providers: [LinkingService, CommandsService, TelegramService, DiscordService],
})
export class BotModule {}
