import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { MailService } from "./mail.service";
import { TelegramService } from "./telegram.service";
import { DiscordService } from "./discord.service";
import { TemplatesService } from "./templates.service";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";

@Module({
  providers: [
    NotificationService,
    MailService,
    TelegramService,
    DiscordService,
    TemplatesService,
    WebhookDispatcherService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
