import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { AdminMailService } from "../mail/mail.service";

@Injectable()
export class TicketReminderService {
  private readonly logger = new Logger(TicketReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: AdminMailService,
  ) {}

  @Cron("15 * * * *") // Every hour at :15
  async checkStaleTickets() {
    const hoursStr = await this.redis.get("config:ticket_reminder_hours");
    const cutoffHours = parseInt(hoursStr ?? "48", 10);
    const cutoff = new Date(Date.now() - cutoffHours * 3600_000);

    const staleTickets = await this.prisma.ticket.findMany({
      where: {
        status: "AWAITING_USER" as any,
        updatedAt: { lt: cutoff },
        reminderSentAt: null,
      },
      include: {
        user: { select: { email: true, username: true } },
      },
    });

    if (staleTickets.length === 0) return;

    this.logger.log(
      `Found ${staleTickets.length} stale ticket(s) awaiting user response`,
    );

    for (const ticket of staleTickets) {
      try {
        await this.mail.sendTicketReminderEmail(
          ticket.user.email,
          ticket.user.username,
          ticket.id,
          ticket.subject,
        );

        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { reminderSentAt: new Date() },
        });

        this.logger.log(
          `Sent reminder for ticket ${ticket.id} to ${ticket.user.email}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to send reminder for ticket ${ticket.id}: ${err?.message}`,
        );
      }
    }
  }
}
