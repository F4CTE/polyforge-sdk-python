import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { LinkingService } from "./linking.service";
import { CommandsService } from "./commands.service";
import { TelegramService } from "./telegram.service";
import { DiscordService } from "./discord.service";
import { WhatsAppService } from "./whatsapp.service";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";

@Module({
  imports: [JwtModule.register({})],
  controllers: [WhatsAppWebhookController],
  providers: [
    LinkingService,
    CommandsService,
    TelegramService,
    DiscordService,
    WhatsAppService,
  ],
})
export class BotModule {}
