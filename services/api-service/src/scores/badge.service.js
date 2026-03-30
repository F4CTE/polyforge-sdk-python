"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BadgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadgeService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_db_1 = require("@polyforge/shared-db");
const BADGE_DEFS = {
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
let BadgeService = BadgeService_1 = class BadgeService {
    prisma;
    logger = new common_1.Logger(BadgeService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Run daily at 4:00 AM (after score recalculation at 3 AM) */
    async evaluateAll() {
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
            }
            catch (err) {
                this.logger.error(`Badge evaluation failed for user ${user.id}: ${err}`);
            }
        }
        this.logger.log(`Badge evaluation complete — ${awarded} new badges awarded`);
    }
    /** Evaluate all badge criteria for a user. Returns number of newly awarded badges. */
    async evaluateForUser(userId, userCreatedAt) {
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
                    if (streak > maxStreak)
                        maxStreak = streak;
                }
                else {
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
            // Count distinct users copying this user's wallet
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { polymarketAddress: true },
            });
            if (user?.polymarketAddress) {
                const copierCount = await this.prisma.copyConfig.count({
                    where: {
                        targetWallet: user.polymarketAddress,
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
                    const monthBuckets = new Map();
                    for (const snap of pnlSnapshots) {
                        const d = new Date(snap.time);
                        const key = `${d.getFullYear()}-${d.getMonth()}`;
                        monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + Number(snap.pnl));
                    }
                    const monthValues = Array.from(monthBuckets.values());
                    let consecutive = 0;
                    let maxConsecutive = 0;
                    for (const v of monthValues) {
                        if (v > 0) {
                            consecutive++;
                            if (consecutive > maxConsecutive)
                                maxConsecutive = consecutive;
                        }
                        else {
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
            const totalPaperPnl = paperPositions.reduce((sum, p) => sum + Number(p.realizedPnl), 0);
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
    async award(userId, type) {
        const def = BADGE_DEFS[type];
        if (!def)
            return;
        await this.prisma.traderBadge.upsert({
            where: { userId_type: { userId, type } },
            create: { userId, type: def.type, name: def.name },
            update: {},
        });
        this.logger.log(`Awarded badge "${def.name}" to user ${userId}`);
    }
};
exports.BadgeService = BadgeService;
__decorate([
    (0, schedule_1.Cron)("0 4 * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BadgeService.prototype, "evaluateAll", null);
exports.BadgeService = BadgeService = BadgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], BadgeService);
//# sourceMappingURL=badge.service.js.map