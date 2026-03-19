import { Module } from "@nestjs/common";
import { AdminMailModule } from "../mail/mail.module";
import { TicketsAdminController } from "./tickets.controller";
import { TicketsAdminService } from "./tickets.service";
import { TicketReminderService } from "./ticket-reminder.service";

@Module({
  imports: [AdminMailModule],
  controllers: [TicketsAdminController],
  providers: [TicketsAdminService, TicketReminderService],
})
export class TicketsModule {}
