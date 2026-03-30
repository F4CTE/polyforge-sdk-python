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
var ScoresService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoresService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
let ScoresService = ScoresService_1 = class ScoresService {
    prisma;
    logger = new common_1.Logger(ScoresService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ─── Get my score + breakdown ──────────────────────────────────────────────
    async getMyScore(userId) {
        const score = await this.prisma.traderScore.findUnique({
            where: { userId },
        });
        if (!score) {
            return {
                score: null,
                breakdown: null,
            };
        }
        return {
            score,
            breakdown: this.buildBreakdown(score),
        };
    }
    // ─── Get user's score ──────────────────────────────────────────────────────
    async getUserScore(userId) {
        const score = await this.prisma.traderScore.findUnique({
            where: { userId },
        });
        if (!score)
            throw new common_1.NotFoundException("Score not found for this user");
        return {
            score,
            breakdown: this.buildBreakdown(score),
        };
    }
    // ─── Top 20 traders by score ───────────────────────────────────────────────
    async getTopTraders() {
        const scores = await this.prisma.traderScore.findMany({
            orderBy: { score: "desc" },
            take: 20,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                    },
                },
            },
        });
        return scores.map((s) => ({
            userId: s.userId,
            username: s.user.username,
            displayName: s.user.displayName,
            avatarUrl: s.user.avatarUrl,
            score: s.score,
            winRate: s.winRate.toString(),
            totalTrades: s.totalTrades,
        }));
    }
    // ─── Get badges ────────────────────────────────────────────────────────────
    async getMyBadges(userId) {
        return this.prisma.traderBadge.findMany({
            where: { userId },
            orderBy: { earnedAt: "desc" },
        });
    }
    async getUserBadges(userId) {
        return this.prisma.traderBadge.findMany({
            where: { userId },
            orderBy: { earnedAt: "desc" },
        });
    }
    // ─── Helpers ───────────────────────────────────────────────────────────────
    buildBreakdown(score) {
        return {
            score: score.score,
            components: {
                winRate: {
                    value: score.winRate.toString(),
                    weight: 0.25,
                    weighted: parseFloat(score.winRate.toString()) * 0.25,
                },
                sharpe: {
                    value: score.sharpeRatio.toString(),
                    weight: 0.2,
                    weighted: parseFloat(score.sharpeRatio.toString()) * 0.2,
                },
                profitFactor: {
                    value: score.profitFactor.toString(),
                    weight: 0.15,
                    weighted: parseFloat(score.profitFactor.toString()) * 0.15,
                },
                consistency: {
                    value: score.consistency.toString(),
                    weight: 0.15,
                    weighted: parseFloat(score.consistency.toString()) * 0.15,
                },
                avgReturn: {
                    value: score.avgReturn.toString(),
                    weight: 0.1,
                    weighted: parseFloat(score.avgReturn.toString()) * 0.1,
                },
                tradeVolume: {
                    value: score.totalTrades,
                    weight: 0.1,
                    weighted: score.totalTrades * 0.1,
                },
                drawdown: {
                    value: score.maxDrawdown.toString(),
                    weight: 0.05,
                    weighted: parseFloat(score.maxDrawdown.toString()) * 0.05,
                },
            },
            totalTrades: score.totalTrades,
            updatedAt: score.updatedAt.toISOString(),
        };
    }
};
exports.ScoresService = ScoresService;
exports.ScoresService = ScoresService = ScoresService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], ScoresService);
//# sourceMappingURL=scores.service.js.map