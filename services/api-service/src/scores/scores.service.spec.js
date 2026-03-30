"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const score_calculator_service_1 = require("./score-calculator.service");
const scores_service_1 = require("./scores.service");
const badge_service_1 = require("./badge.service");
const client_1 = require("@prisma/client");
// ─── Mock PrismaService ─────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        order: {
            groupBy: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
        },
        position: {
            findMany: vitest_1.vi.fn(),
        },
        pnlSnapshot: {
            findMany: vitest_1.vi.fn(),
        },
        $queryRawUnsafe: vitest_1.vi.fn().mockResolvedValue([]),
        traderScore: {
            upsert: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
        },
        traderBadge: {
            findMany: vitest_1.vi.fn(),
            upsert: vitest_1.vi.fn(),
        },
        user: {
            findMany: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
        },
        whaleFollow: {
            count: vitest_1.vi.fn(),
        },
        strategy: {
            count: vitest_1.vi.fn(),
        },
        copyConfig: {
            count: vitest_1.vi.fn(),
        },
        paperPosition: {
            findMany: vitest_1.vi.fn(),
        },
    };
}
// ─── ScoreCalculatorService ──────────────────────────────────────────────────
(0, vitest_1.describe)("ScoreCalculatorService", () => {
    let calculator;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        calculator = new score_calculator_service_1.ScoreCalculatorService(prisma);
    });
    (0, vitest_1.describe)("computeScore", () => {
        (0, vitest_1.it)("returns 0 for worst-case metrics", () => {
            const score = calculator.computeScore({
                winRate: 0,
                sharpeRatio: -1,
                profitFactor: 0,
                consistency: 0,
                avgReturn: -50,
                totalTrades: 0,
                maxDrawdown: 1000,
            });
            (0, vitest_1.expect)(score).toBe(0);
        });
        (0, vitest_1.it)("returns 100 for best-case metrics", () => {
            const score = calculator.computeScore({
                winRate: 100,
                sharpeRatio: 3,
                profitFactor: 5,
                consistency: 100,
                avgReturn: 50,
                totalTrades: 500,
                maxDrawdown: 0,
            });
            (0, vitest_1.expect)(score).toBe(100);
        });
        (0, vitest_1.it)("returns a mid-range score for average metrics", () => {
            const score = calculator.computeScore({
                winRate: 55,
                sharpeRatio: 1.2,
                profitFactor: 1.5,
                consistency: 50,
                avgReturn: 5,
                totalTrades: 100,
                maxDrawdown: 200,
            });
            (0, vitest_1.expect)(score).toBeGreaterThan(30);
            (0, vitest_1.expect)(score).toBeLessThan(70);
        });
        (0, vitest_1.it)("clamps score to 0-100 range", () => {
            // Even with extreme values, score should stay in range
            const score = calculator.computeScore({
                winRate: 200,
                sharpeRatio: 100,
                profitFactor: 100,
                consistency: 200,
                avgReturn: 1000,
                totalTrades: 100000,
                maxDrawdown: -500,
            });
            (0, vitest_1.expect)(score).toBeLessThanOrEqual(100);
            (0, vitest_1.expect)(score).toBeGreaterThanOrEqual(0);
        });
        (0, vitest_1.it)("weighs win rate highest at 25%", () => {
            const baseScore = calculator.computeScore({
                winRate: 0,
                sharpeRatio: 0,
                profitFactor: 0,
                consistency: 0,
                avgReturn: 0,
                totalTrades: 0,
                maxDrawdown: 500,
            });
            const withWinRate = calculator.computeScore({
                winRate: 100,
                sharpeRatio: 0,
                profitFactor: 0,
                consistency: 0,
                avgReturn: 0,
                totalTrades: 0,
                maxDrawdown: 500,
            });
            // 100% win rate should add 25 points (0.25 * 100)
            (0, vitest_1.expect)(withWinRate - baseScore).toBe(25);
        });
    });
    (0, vitest_1.describe)("calculateForUser", () => {
        (0, vitest_1.it)("skips users with no positions", async () => {
            prisma.position.findMany.mockResolvedValue([]);
            await calculator.calculateForUser("user-1");
            (0, vitest_1.expect)(prisma.traderScore.upsert).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("calculates and upserts score for user with positions", async () => {
            prisma.position.findMany.mockResolvedValue([
                {
                    realizedPnl: new client_1.Prisma.Decimal(100),
                    resolutionStatus: "RESOLVED",
                },
                {
                    realizedPnl: new client_1.Prisma.Decimal(-50),
                    resolutionStatus: "RESOLVED",
                },
                {
                    realizedPnl: new client_1.Prisma.Decimal(75),
                    resolutionStatus: "RESOLVED",
                },
            ]);
            prisma.pnlSnapshot.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(10);
            prisma.traderScore.upsert.mockResolvedValue({});
            await calculator.calculateForUser("user-1");
            (0, vitest_1.expect)(prisma.traderScore.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { userId: "user-1" },
                create: vitest_1.expect.objectContaining({
                    userId: "user-1",
                    totalTrades: 10,
                }),
            }));
            // Win rate should be ~66.67% (2 out of 3 profitable)
            const call = prisma.traderScore.upsert.mock.calls[0][0];
            (0, vitest_1.expect)(parseFloat(call.create.winRate.toString())).toBeCloseTo(66.67, 0);
        });
    });
});
// ─── ScoresService ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("ScoresService", () => {
    let service;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        service = new scores_service_1.ScoresService(prisma);
    });
    (0, vitest_1.describe)("getMyScore", () => {
        (0, vitest_1.it)("returns null score when user has no score", async () => {
            prisma.traderScore.findUnique.mockResolvedValue(null);
            const result = await service.getMyScore("user-1");
            (0, vitest_1.expect)(result.score).toBeNull();
            (0, vitest_1.expect)(result.breakdown).toBeNull();
        });
        (0, vitest_1.it)("returns score with breakdown when available", async () => {
            prisma.traderScore.findUnique.mockResolvedValue({
                score: 75,
                winRate: new client_1.Prisma.Decimal("60.00"),
                sharpeRatio: new client_1.Prisma.Decimal("1.5000"),
                avgReturn: new client_1.Prisma.Decimal("5.2500"),
                totalTrades: 50,
                profitFactor: new client_1.Prisma.Decimal("2.1000"),
                maxDrawdown: new client_1.Prisma.Decimal("100.0000"),
                consistency: new client_1.Prisma.Decimal("66.00"),
                updatedAt: new Date("2026-01-01"),
            });
            const result = await service.getMyScore("user-1");
            (0, vitest_1.expect)(result.score).toBeTruthy();
            (0, vitest_1.expect)(result.breakdown).toBeTruthy();
            (0, vitest_1.expect)(result.breakdown.score).toBe(75);
            (0, vitest_1.expect)(result.breakdown.totalTrades).toBe(50);
        });
    });
    (0, vitest_1.describe)("getTopTraders", () => {
        (0, vitest_1.it)("returns top 20 traders with user info", async () => {
            prisma.traderScore.findMany.mockResolvedValue([
                {
                    userId: "user-1",
                    score: 95,
                    winRate: new client_1.Prisma.Decimal("80.00"),
                    totalTrades: 200,
                    user: {
                        id: "user-1",
                        username: "alpha_trader",
                        displayName: "Alpha Trader",
                        avatarUrl: null,
                    },
                },
                {
                    userId: "user-2",
                    score: 88,
                    winRate: new client_1.Prisma.Decimal("72.50"),
                    totalTrades: 150,
                    user: {
                        id: "user-2",
                        username: "beta_whale",
                        displayName: null,
                        avatarUrl: null,
                    },
                },
            ]);
            const result = await service.getTopTraders();
            (0, vitest_1.expect)(result).toHaveLength(2);
            (0, vitest_1.expect)(result[0].username).toBe("alpha_trader");
            (0, vitest_1.expect)(result[0].score).toBe(95);
            (0, vitest_1.expect)(result[1].username).toBe("beta_whale");
        });
    });
});
// ─── BadgeService ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("BadgeService", () => {
    let badge;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        badge = new badge_service_1.BadgeService(prisma);
    });
    (0, vitest_1.describe)("evaluateForUser", () => {
        (0, vitest_1.it)("awards FIRST_TRADE badge when user has trades", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(5);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(0);
            prisma.strategy.count.mockResolvedValue(0);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue(null);
            prisma.paperPosition.findMany.mockResolvedValue([]);
            prisma.traderBadge.upsert.mockResolvedValue({});
            const awarded = await badge.evaluateForUser("user-1", new Date("2027-01-01"));
            (0, vitest_1.expect)(awarded).toBe(1);
            (0, vitest_1.expect)(prisma.traderBadge.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { userId_type: { userId: "user-1", type: "FIRST_TRADE" } },
                create: vitest_1.expect.objectContaining({
                    userId: "user-1",
                    type: "FIRST_TRADE",
                    name: "First Trade",
                }),
            }));
        });
        (0, vitest_1.it)("awards EARLY_ADOPTER for users who joined during beta", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(0);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(0);
            prisma.strategy.count.mockResolvedValue(0);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue(null);
            prisma.paperPosition.findMany.mockResolvedValue([]);
            prisma.traderBadge.upsert.mockResolvedValue({});
            const awarded = await badge.evaluateForUser("user-1", new Date("2025-12-01"));
            (0, vitest_1.expect)(awarded).toBe(1);
            (0, vitest_1.expect)(prisma.traderBadge.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                create: vitest_1.expect.objectContaining({
                    type: "EARLY_ADOPTER",
                }),
            }));
        });
        (0, vitest_1.it)("awards WHALE_HUNTER when following 10+ whales", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(0);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(15);
            prisma.strategy.count.mockResolvedValue(0);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue(null);
            prisma.paperPosition.findMany.mockResolvedValue([]);
            prisma.traderBadge.upsert.mockResolvedValue({});
            const awarded = await badge.evaluateForUser("user-1", new Date("2027-01-01"));
            (0, vitest_1.expect)(awarded).toBe(1);
            (0, vitest_1.expect)(prisma.traderBadge.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                create: vitest_1.expect.objectContaining({
                    type: "WHALE_HUNTER",
                    name: "Whale Hunter",
                }),
            }));
        });
        (0, vitest_1.it)("awards STRATEGY_MASTER when user has 10+ strategies", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(0);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(0);
            prisma.strategy.count.mockResolvedValue(12);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue(null);
            prisma.paperPosition.findMany.mockResolvedValue([]);
            prisma.traderBadge.upsert.mockResolvedValue({});
            const awarded = await badge.evaluateForUser("user-1", new Date("2027-01-01"));
            (0, vitest_1.expect)(awarded).toBe(1);
            (0, vitest_1.expect)(prisma.traderBadge.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                create: vitest_1.expect.objectContaining({
                    type: "STRATEGY_MASTER",
                }),
            }));
        });
        (0, vitest_1.it)("awards TOP_10 badge when user is in top 10 by score", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(0);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(0);
            prisma.strategy.count.mockResolvedValue(0);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue({ score: 95 });
            prisma.traderScore.count.mockResolvedValue(3); // 3 users above = rank 4
            prisma.pnlSnapshot.findMany.mockResolvedValue([]);
            prisma.paperPosition.findMany.mockResolvedValue([]);
            prisma.traderBadge.upsert.mockResolvedValue({});
            const awarded = await badge.evaluateForUser("user-1", new Date("2027-01-01"));
            // Should get TOP_10 and TOP_50
            (0, vitest_1.expect)(awarded).toBe(2);
        });
        (0, vitest_1.it)("skips badges user already has", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([
                { type: "FIRST_TRADE" },
                { type: "EARLY_ADOPTER" },
            ]);
            prisma.order.count.mockResolvedValue(5);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(0);
            prisma.strategy.count.mockResolvedValue(0);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue(null);
            prisma.paperPosition.findMany.mockResolvedValue([]);
            const awarded = await badge.evaluateForUser("user-1", new Date("2025-01-01"));
            // Should not re-award existing badges
            (0, vitest_1.expect)(awarded).toBe(0);
        });
        (0, vitest_1.it)("awards PAPER_GRADUATE when paper trading is profitable", async () => {
            prisma.traderBadge.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(0);
            prisma.position.findMany.mockResolvedValue([]);
            prisma.whaleFollow.count.mockResolvedValue(0);
            prisma.strategy.count.mockResolvedValue(0);
            prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
            prisma.traderScore.findUnique.mockResolvedValue(null);
            prisma.paperPosition.findMany.mockResolvedValue([
                { realizedPnl: new client_1.Prisma.Decimal(50) },
                { realizedPnl: new client_1.Prisma.Decimal(25) },
            ]);
            prisma.traderBadge.upsert.mockResolvedValue({});
            const awarded = await badge.evaluateForUser("user-1", new Date("2027-01-01"));
            (0, vitest_1.expect)(awarded).toBe(1);
            (0, vitest_1.expect)(prisma.traderBadge.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                create: vitest_1.expect.objectContaining({
                    type: "PAPER_GRADUATE",
                }),
            }));
        });
    });
});
//# sourceMappingURL=scores.service.spec.js.map