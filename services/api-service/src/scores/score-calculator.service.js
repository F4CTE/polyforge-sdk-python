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
var ScoreCalculatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreCalculatorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_db_1 = require("@polyforge/shared-db");
const client_1 = require("@prisma/client");
// ─── Weight constants ────────────────────────────────────────────────────────
const WEIGHTS = {
    winRate: 0.25,
    sharpe: 0.2,
    profitFactor: 0.15,
    consistency: 0.15,
    avgReturn: 0.1,
    tradeVolume: 0.1,
    drawdown: 0.05,
};
// ─── Normalization helpers ───────────────────────────────────────────────────
/** Normalize a value from [min, max] to [0, 100], clamped. */
function normalize(value, min, max) {
    if (max <= min)
        return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}
/** Inverse normalize — lower is better (e.g. drawdown). */
function normalizeInverse(value, min, max) {
    return 100 - normalize(value, min, max);
}
// ─── Service ─────────────────────────────────────────────────────────────────
let ScoreCalculatorService = ScoreCalculatorService_1 = class ScoreCalculatorService {
    prisma;
    logger = new common_1.Logger(ScoreCalculatorService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Run daily at 3:00 AM */
    async recalculateAll() {
        this.logger.log("Starting daily score recalculation...");
        const usersWithTrades = await this.prisma.order.groupBy({
            by: ["userId"],
            where: { status: { in: ["CONFIRMED", "MATCHED", "MINED"] } },
            _count: { id: true },
        });
        let updated = 0;
        for (const row of usersWithTrades) {
            try {
                await this.calculateForUser(row.userId);
                updated++;
            }
            catch (err) {
                this.logger.error(`Failed to calculate score for user ${row.userId}: ${err}`);
            }
        }
        this.logger.log(`Score recalculation complete — ${updated} users updated`);
    }
    /** Calculate and upsert the score for a single user. */
    async calculateForUser(userId) {
        const positions = await this.prisma.position.findMany({
            where: { userId },
        });
        if (positions.length === 0)
            return;
        // ── Win rate ──────────────────────────────────────────────────────────────
        const closedPositions = positions.filter((p) => p.resolutionStatus === "RESOLVED" || Number(p.realizedPnl) !== 0);
        const wins = closedPositions.filter((p) => Number(p.realizedPnl) > 0).length;
        const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0;
        // ── Average return per trade ─────────────────────────────────────────────
        const returns = closedPositions.map((p) => Number(p.realizedPnl));
        const avgReturn = returns.length > 0
            ? returns.reduce((sum, r) => sum + r, 0) / returns.length
            : 0;
        // ── Sharpe ratio (simplified: mean / stdDev of returns) ──────────────────
        const mean = avgReturn;
        const variance = returns.length > 1
            ? returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
                (returns.length - 1)
            : 0;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? mean / stdDev : 0;
        // ── Profit factor (gross profit / gross loss) ────────────────────────────
        const grossProfit = returns
            .filter((r) => r > 0)
            .reduce((sum, r) => sum + r, 0);
        const grossLoss = Math.abs(returns.filter((r) => r < 0).reduce((sum, r) => sum + r, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;
        // ── Max drawdown ─────────────────────────────────────────────────────────
        let peak = 0;
        let maxDrawdown = 0;
        let cumulative = 0;
        for (const r of returns) {
            cumulative += r;
            if (cumulative > peak)
                peak = cumulative;
            const dd = peak - cumulative;
            if (dd > maxDrawdown)
                maxDrawdown = dd;
        }
        // ── Consistency (% of profitable 30-day periods) ─────────────────────────
        // Use TimescaleDB time_bucket aggregation instead of loading all snapshots
        const buckets = await this.prisma.$queryRawUnsafe(`SELECT time_bucket('30 days', time) AS bucket, SUM(pnl) AS total_pnl
       FROM pnl_snapshots WHERE "userId" = $1
       GROUP BY 1 ORDER BY 1`, userId);
        let consistency = 0;
        if (buckets.length > 0) {
            const profitableBuckets = buckets.filter((b) => Number(b.total_pnl) > 0).length;
            consistency =
                buckets.length > 0 ? (profitableBuckets / buckets.length) * 100 : 0;
        }
        // ── Total trades ─────────────────────────────────────────────────────────
        const totalTrades = await this.prisma.order.count({
            where: {
                userId,
                status: { in: ["CONFIRMED", "MATCHED", "MINED"] },
            },
        });
        // ── Compute final score ──────────────────────────────────────────────────
        const score = this.computeScore({
            winRate,
            sharpeRatio,
            profitFactor,
            consistency,
            avgReturn,
            totalTrades,
            maxDrawdown,
        });
        // ── Upsert ───────────────────────────────────────────────────────────────
        await this.prisma.traderScore.upsert({
            where: { userId },
            create: {
                userId,
                score,
                winRate: new client_1.Prisma.Decimal(winRate.toFixed(2)),
                sharpeRatio: new client_1.Prisma.Decimal(sharpeRatio.toFixed(4)),
                avgReturn: new client_1.Prisma.Decimal(avgReturn.toFixed(4)),
                totalTrades,
                profitFactor: new client_1.Prisma.Decimal(profitFactor.toFixed(4)),
                maxDrawdown: new client_1.Prisma.Decimal(maxDrawdown.toFixed(4)),
                consistency: new client_1.Prisma.Decimal(consistency.toFixed(2)),
            },
            update: {
                score,
                winRate: new client_1.Prisma.Decimal(winRate.toFixed(2)),
                sharpeRatio: new client_1.Prisma.Decimal(sharpeRatio.toFixed(4)),
                avgReturn: new client_1.Prisma.Decimal(avgReturn.toFixed(4)),
                totalTrades,
                profitFactor: new client_1.Prisma.Decimal(profitFactor.toFixed(4)),
                maxDrawdown: new client_1.Prisma.Decimal(maxDrawdown.toFixed(4)),
                consistency: new client_1.Prisma.Decimal(consistency.toFixed(2)),
            },
        });
    }
    /** Weighted average of normalized metric scores → 0-100 */
    computeScore(metrics) {
        const components = {
            winRate: normalize(metrics.winRate, 0, 100),
            sharpe: normalize(metrics.sharpeRatio, -1, 3),
            profitFactor: normalize(metrics.profitFactor, 0, 5),
            consistency: normalize(metrics.consistency, 0, 100),
            avgReturn: normalize(metrics.avgReturn, -50, 50),
            tradeVolume: normalize(metrics.totalTrades, 0, 500),
            drawdown: normalizeInverse(metrics.maxDrawdown, 0, 1000),
        };
        const weighted = components.winRate * WEIGHTS.winRate +
            components.sharpe * WEIGHTS.sharpe +
            components.profitFactor * WEIGHTS.profitFactor +
            components.consistency * WEIGHTS.consistency +
            components.avgReturn * WEIGHTS.avgReturn +
            components.tradeVolume * WEIGHTS.tradeVolume +
            components.drawdown * WEIGHTS.drawdown;
        return Math.max(0, Math.min(100, Math.round(weighted)));
    }
};
exports.ScoreCalculatorService = ScoreCalculatorService;
__decorate([
    (0, schedule_1.Cron)("0 3 * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ScoreCalculatorService.prototype, "recalculateAll", null);
exports.ScoreCalculatorService = ScoreCalculatorService = ScoreCalculatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], ScoreCalculatorService);
//# sourceMappingURL=score-calculator.service.js.map