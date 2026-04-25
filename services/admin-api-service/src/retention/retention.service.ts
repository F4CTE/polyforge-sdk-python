import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@polyforge/shared-db";

// NOTE: `waitlist:emails` (Redis ZSET) and `config:invite_only` (Redis string) are
// intentionally excluded from automated retention jobs. Waitlist entries are managed
// manually by admins via the admin panel (invite & remove). The invite-only flag is
// a runtime toggle that must persist until explicitly changed.

const DAY_MS = 86400_000;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Analytics Endpoints ──────────────────────────────────────────────────

  async getOverview() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * DAY_MS);
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);

    const [dau, wau, mau, newUsersToday, newUsersWeek, previousMau] =
      await Promise.all([
        this.prisma.user.count({
          where: { lastSeen: { gte: oneDayAgo }, deleted: false },
        }),
        this.prisma.user.count({
          where: { lastSeen: { gte: sevenDaysAgo }, deleted: false },
        }),
        this.prisma.user.count({
          where: { lastSeen: { gte: thirtyDaysAgo }, deleted: false },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: oneDayAgo }, deleted: false },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: sevenDaysAgo }, deleted: false },
        }),
        this.prisma.user.count({
          where: {
            lastSeen: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            deleted: false,
          },
        }),
      ]);

    const dauWauRatio = wau > 0 ? dau / wau : 0;
    const wauMauRatio = mau > 0 ? wau / mau : 0;
    const churnRate = previousMau > 0 ? 1 - mau / (mau + previousMau) : 0;

    return {
      dau,
      wau,
      mau,
      dauWauRatio,
      wauMauRatio,
      newUsersToday,
      newUsersWeek,
      churnRate,
    };
  }

  async getTrend(days: number) {
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const rows = await this.prisma.$queryRaw<
      { date: string; dau: number; new_users: number }[]
    >(Prisma.sql`
      WITH dates AS (
        SELECT generate_series(
          ${cutoff}::date,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS d
      ),
      daily_active AS (
        SELECT d.d AS date,
               COUNT(DISTINCT u.id) AS dau
        FROM dates d
        LEFT JOIN users u
          ON u."lastSeen"::date = d.d
         AND u.deleted = false
        GROUP BY d.d
      ),
      daily_new AS (
        SELECT d.d AS date,
               COUNT(u.id) AS new_users
        FROM dates d
        LEFT JOIN users u
          ON u."createdAt"::date = d.d
         AND u.deleted = false
        GROUP BY d.d
      )
      SELECT da.date::text,
             da.dau::int,
             dn.new_users::int AS "new_users"
      FROM daily_active da
      JOIN daily_new dn ON da.date = dn.date
      ORDER BY da.date
    `);

    return {
      data: rows.map((r) => ({
        date: r.date,
        dau: Number(r.dau),
        newUsers: Number(r.new_users),
        returningUsers: Math.max(0, Number(r.dau) - Number(r.new_users)),
      })),
    };
  }

  async getCohorts(months: number) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    const weekOffsets = [0, 1, 2, 4, 8, 12];

    const rows = await this.prisma.$queryRaw<
      { cohort: string; size: number }[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS cohort,
             COUNT(*)::int AS size
      FROM users
      WHERE "createdAt" >= ${cutoff}
        AND deleted = false
      GROUP BY cohort
      ORDER BY cohort
    `);

    const cohortData = await Promise.all(
      rows.map(async (row) => {
        const cohortStart = new Date(`${row.cohort}-01T00:00:00Z`);

        const retention = await Promise.all(
          weekOffsets.map(async (weekOffset) => {
            const windowStart = new Date(
              cohortStart.getTime() + weekOffset * 7 * DAY_MS,
            );
            const windowEnd = new Date(windowStart.getTime() + 7 * DAY_MS);

            if (windowStart > new Date()) return 0;

            const active = await this.prisma.user.count({
              where: {
                createdAt: {
                  gte: cohortStart,
                  lt: new Date(
                    cohortStart.getFullYear(),
                    cohortStart.getMonth() + 1,
                    1,
                  ),
                },
                lastSeen: { gte: windowStart, lt: windowEnd },
                deleted: false,
              },
            });

            return row.size > 0 ? Math.round((active / row.size) * 100) : 0;
          }),
        );

        return {
          cohort: row.cohort,
          size: row.size,
          retention,
        };
      }),
    );

    return { data: cohortData };
  }

  // ─── Data Purge Jobs ──────────────────────────────────────────────────────

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
