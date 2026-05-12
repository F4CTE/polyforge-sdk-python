import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import { tryChecksumEthereumAddress } from "../copy/wallet-address";

// ─── Badge definitions ──────────────────────────────────────────────────────

interface BadgeDef {
  type: string;
  name: string;
}

const BADGE_DEFS: Record<string, BadgeDef> = {
  FIRST_TRADE: { type: "FIRST_TRADE", name: "First Trade" },
  WINNING_STREAK_5: { type: "WINNING_STREAK_5", name: "5-Win Streak" },
  WHALE_HUNTER: { type: "WHALE_HUNTER", name: "Whale Hunter" },
  STRATEGY_MASTER: { type: "STRATEGY_MASTER", name: "Strategy Master" },
  COPY_LEADER: { type: "COPY_LEADER", name: "Copy Leader" },
  TOP_10: { type: "TOP_10", name: "Top 10" },
  TOP_50: { type: "TOP_50", name: "Top 50" },
  CONSISTENT_WINNER: { type: "CONSISTENT_WINNER", name: "Consistent Winner" },
  PAPER_GRADUATE: { type: "PAPER_GRADUATE", name: "Paper Graduate" },
  EARLY_ADOPTER: { type: "EARLY_ADOPTER", name: "Early Adopter" },
};

const BETA_CUTOFF = new Date("2026-06-01T00:00:00Z");

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Run daily at 4:00 AM (after score recalculation at 3 AM) */
  @Cron("0 4 * * *")
  async evaluateAll(): Promise<void> {
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:badge:evaluateAll",
      ttlMs: 3_600_000,
      job: async () => {
        this.logger.log("Starting daily badge evaluation...");

        const users = await this.prisma.user.findMany({
          select: { id: true, createdAt: true },
          where: { deleted: false, suspended: false },
        });

        let awarded = 0;

        for (const user of users) {
          try {
            const count = await this.evaluateForUser(user.id, user.createdAt);
            awarded += count;
          } catch (err) {
            this.logger.error(
              `Badge evaluation failed for user ${user.id}: ${String(err)}`,
            );
          }
        }

        this.logger.log(
          `Badge evaluation complete — ${awarded} new badges awarded`,
        );
      },
    });
  }

  /** Evaluate all badge criteria for a user. Returns number of newly awarded badges. */
  async evaluateForUser(userId: string, userCreatedAt: Date): Promise<number> {
    const existing = await this.prisma.traderBadge.findMany({
      where: { userId },
      select: { type: true },
    });
    const has = new Set(existing.map((b) => b.type));
    let awarded = 0;

    // ── FIRST_TRADE ──────────────────────────────────────────────────────────
    if (!has.has("FIRST_TRADE")) {
      const tradeCount = await this.prisma.order.count({
        where: {
          userId,
          status: { in: ["CONFIRMED", "MATCHED", "MINED"] },
        },
      });
      if (tradeCount > 0) {
        await this.award(userId, "FIRST_TRADE");
        awarded++;
      }
    }

    // ── WINNING_STREAK_5 ─────────────────────────────────────────────────────
    if (!has.has("WINNING_STREAK_5")) {
      const positions = await this.prisma.position.findMany({
        where: {
          userId,
          resolutionStatus: "RESOLVED",
        },
        orderBy: { updatedAt: "desc" },
        select: { realizedPnl: true },
      });
      let streak = 0;
      let maxStreak = 0;
      for (const p of positions) {
        if (Number(p.realizedPnl) > 0) {
          streak++;
          if (streak > maxStreak) maxStreak = streak;
        } else {
          streak = 0;
        }
      }
      if (maxStreak >= 5) {
        await this.award(userId, "WINNING_STREAK_5");
        awarded++;
      }
    }

    // ── WHALE_HUNTER ─────────────────────────────────────────────────────────
    if (!has.has("WHALE_HUNTER")) {
      const whaleFollows = await this.prisma.whaleFollow.count({
        where: { userId },
      });
      if (whaleFollows >= 10) {
        await this.award(userId, "WHALE_HUNTER");
        awarded++;
      }
    }

    // ── STRATEGY_MASTER ──────────────────────────────────────────────────────
    if (!has.has("STRATEGY_MASTER")) {
      const strategyCount = await this.prisma.strategy.count({
        where: { userId },
      });
      if (strategyCount >= 10) {
        await this.award(userId, "STRATEGY_MASTER");
        awarded++;
      }
    }

    // ── COPY_LEADER ──────────────────────────────────────────────────────────
    if (!has.has("COPY_LEADER")) {
      // Count distinct users copying this user's wallet.
      // Normalize to EIP-55 canonical form so the query matches both legacy
      // lowercased rows and new checksummed writes.  Falls back to the raw
      // stored value when checksumming fails (e.g. malformed legacy data).
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { polymarketAddress: true },
      });
      if (user?.polymarketAddress) {
        const wallet =
          tryChecksumEthereumAddress(user.polymarketAddress) ??
          user.polymarketAddress;
        const copierCount = await this.prisma.copyConfig.count({
          where: {
            targetWallet: { equals: wallet, mode: "insensitive" },
            status: { in: ["ACTIVE", "PAUSED"] },
          },
        });
        if (copierCount >= 5) {
          await this.award(userId, "COPY_LEADER");
          awarded++;
        }
      }
    }

    // ── TOP_10 / TOP_50 ──────────────────────────────────────────────────────
    const score = await this.prisma.traderScore.findUnique({
      where: { userId },
    });

    if (score) {
      const rank = await this.prisma.traderScore.count({
        where: { score: { gt: score.score } },
      });
      const userRank = rank + 1;

      if (!has.has("TOP_10") && userRank <= 10) {
        await this.award(userId, "TOP_10");
        awarded++;
      }
      if (!has.has("TOP_50") && userRank <= 50) {
        await this.award(userId, "TOP_50");
        awarded++;
      }
    }

    // ── CONSISTENT_WINNER ────────────────────────────────────────────────────
    if (!has.has("CONSISTENT_WINNER") && score) {
      // 3+ consecutive profitable months based on consistency metric
      if (Number(score.consistency) >= 50) {
        // At least 50% profitable months + check actual consecutive months
        const pnlSnapshots = await this.prisma.pnlSnapshot.findMany({
          where: { userId },
          orderBy: { time: "asc" },
        });

        if (pnlSnapshots.length > 0) {
          const monthBuckets = new Map<string, number>();
          for (const snap of pnlSnapshots) {
            const d = new Date(snap.time);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthBuckets.set(
              key,
              (monthBuckets.get(key) ?? 0) + Number(snap.pnl),
            );
          }

          const monthValues = Array.from(monthBuckets.values());
          let consecutive = 0;
          let maxConsecutive = 0;
          for (const v of monthValues) {
            if (v > 0) {
              consecutive++;
              if (consecutive > maxConsecutive) maxConsecutive = consecutive;
            } else {
              consecutive = 0;
            }
          }

          if (maxConsecutive >= 3) {
            await this.award(userId, "CONSISTENT_WINNER");
            awarded++;
          }
        }
      }
    }

    // ── PAPER_GRADUATE ───────────────────────────────────────────────────────
    if (!has.has("PAPER_GRADUATE")) {
      const paperPositions = await this.prisma.paperPosition.findMany({
        where: { userId },
        select: { realizedPnl: true },
      });
      const totalPaperPnl = paperPositions.reduce(
        (sum, p) => sum + Number(p.realizedPnl),
        0,
      );
      if (paperPositions.length > 0 && totalPaperPnl > 0) {
        await this.award(userId, "PAPER_GRADUATE");
        awarded++;
      }
    }

    // ── EARLY_ADOPTER ────────────────────────────────────────────────────────
    if (!has.has("EARLY_ADOPTER")) {
      if (userCreatedAt < BETA_CUTOFF) {
        await this.award(userId, "EARLY_ADOPTER");
        awarded++;
      }
    }

    return awarded;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async award(userId: string, type: string): Promise<void> {
    const def = BADGE_DEFS[type];
    if (!def) return;

    await this.prisma.traderBadge.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type: def.type, name: def.name },
      update: {},
    });

    this.logger.log(`Awarded badge "${def.name}" to user ${userId}`);
  }
}
