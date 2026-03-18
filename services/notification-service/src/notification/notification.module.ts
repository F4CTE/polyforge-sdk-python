import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { MailService } from "./mail.service";
import { TelegramService } from "./telegram.service";
import { DiscordService } from "./discord.service";
import { TemplatesService } from "./templates.service";

@Module({
  providers: [
    NotificationService,
    MailService,
    TelegramService,
    DiscordService,
    TemplatesService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
