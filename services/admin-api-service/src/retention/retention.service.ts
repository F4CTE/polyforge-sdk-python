import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";

// NOTE: `waitlist:emails` (Redis ZSET) and `config:invite_only` (Redis string) are
// intentionally excluded from automated retention jobs. Waitlist entries are managed
// manually by admins via the admin panel (invite & remove). The invite-only flag is
// a runtime toggle that must persist until explicitly changed.

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Nightly at 3am UTC
  @Cron("0 3 * * *")
  async runRetentionJobs() {
    this.logger.log("Starting nightly retention jobs");
    await Promise.allSettled([
      this.purgeUserLoginHistory(),
      this.purgeNotificationHistory(),
      this.purgePaperOrders(),
      this.purgeStrategyEvents(),
      this.purgeOldEventLogs(),
    ]);
    this.logger.log("Nightly retention jobs complete");
  }

  private async purgeUserLoginHistory() {
    const cutoff = new Date(Date.now() - 90 * 86400_000); // 90 days
    const { count } = await this.prisma.userLoginHistory.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    this.logger.log(`Purged ${count} user_login_history rows`);
  }

  private async purgeNotificationHistory() {
    const cutoff = new Date(Date.now() - 90 * 86400_000); // 90 days
    const { count } = await this.prisma.notificationHistory.deleteMany({
      where: { sentAt: { lt: cutoff } },
    });
    this.logger.log(`Purged ${count} notification_history rows`);
  }

  private async purgePaperOrders() {
    const cutoff = new Date(Date.now() - 90 * 86400_000); // 90 days
    const { count } = await this.prisma.paperOrder.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    this.logger.log(`Purged ${count} paper_orders rows`);
  }

  private async purgeStrategyEvents() {
    const cutoff = new Date(Date.now() - 7 * 86400_000); // 7 days
    const { count } = await this.prisma.strategyEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    this.logger.log(`Purged ${count} strategy_events rows`);
  }

  private async purgeOldEventLogs() {
    // Fill events: 1 year
    // Other events: 30 days
    const cutoff30d = new Date(Date.now() - 30 * 86400_000);
    const cutoff1y = new Date(Date.now() - 365 * 86400_000);

    const { count: nonFill } = await this.prisma.eventLog.deleteMany({
      where: {
        eventType: { notIn: ["ORDER_FILLED", "PAPER_ORDER_FILLED"] },
        createdAt: { lt: cutoff30d },
      },
    });
    const { count: fill } = await this.prisma.eventLog.deleteMany({
      where: {
        eventType: { in: ["ORDER_FILLED", "PAPER_ORDER_FILLED"] },
        createdAt: { lt: cutoff1y },
      },
    });
    this.logger.log(
      `Purged ${nonFill} non-fill event_log rows, ${fill} fill event_log rows`,
    );
  }
}
