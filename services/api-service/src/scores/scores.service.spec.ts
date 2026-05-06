import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@polyforge/shared-db", () => ({
  PrismaService: class PrismaService {},
}));

vi.mock("@polyforge/shared-redis", () => ({
  RedisService: class RedisService {},
  runOncePerCluster: vi.fn(async ({ job }: { job: () => Promise<unknown> }) =>
    job(),
  ),
}));

import { ScoreCalculatorService } from "./score-calculator.service";
import { ScoresService } from "./scores.service";
import { BadgeService } from "./badge.service";
import { Prisma } from "@prisma/client";

// ─── Mock PrismaService ─────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    order: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
    },
    pnlSnapshot: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    traderScore: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    traderBadge: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    whaleFollow: {
      count: vi.fn(),
    },
    strategy: {
      count: vi.fn(),
    },
    copyConfig: {
      count: vi.fn(),
    },
    paperPosition: {
      findMany: vi.fn(),
    },
  } as any;
}

const makeRedis = () => ({
  getClient: () => ({
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  }),
});

// ─── ScoreCalculatorService ──────────────────────────────────────────────────

describe("ScoreCalculatorService", () => {
  let calculator: ScoreCalculatorService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    calculator = new ScoreCalculatorService(prisma, makeRedis() as any);
  });

  describe("computeScore", () => {
    it("returns 0 for worst-case metrics", () => {
      const score = calculator.computeScore({
        winRate: 0,
        sharpeRatio: -1,
        profitFactor: 0,
        consistency: 0,
        avgReturn: -50,
        totalTrades: 0,
        maxDrawdown: 1000,
      });

      expect(score).toBe(0);
    });

    it("returns 100 for best-case metrics", () => {
      const score = calculator.computeScore({
        winRate: 100,
        sharpeRatio: 3,
        profitFactor: 5,
        consistency: 100,
        avgReturn: 50,
        totalTrades: 500,
        maxDrawdown: 0,
      });

      expect(score).toBe(100);
    });

    it("returns a mid-range score for average metrics", () => {
      const score = calculator.computeScore({
        winRate: 55,
        sharpeRatio: 1.2,
        profitFactor: 1.5,
        consistency: 50,
        avgReturn: 5,
        totalTrades: 100,
        maxDrawdown: 200,
      });

      expect(score).toBeGreaterThan(30);
      expect(score).toBeLessThan(70);
    });

    it("clamps score to 0-100 range", () => {
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

      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("weighs win rate highest at 25%", () => {
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
      expect(withWinRate - baseScore).toBe(25);
    });
  });

  describe("calculateForUser", () => {
    it("skips users with no positions", async () => {
      prisma.position.findMany.mockResolvedValue([]);

      await calculator.calculateForUser("user-1");

      expect(prisma.traderScore.upsert).not.toHaveBeenCalled();
    });

    it("calculates and upserts score for user with positions", async () => {
      prisma.position.findMany.mockResolvedValue([
        {
          realizedPnl: new Prisma.Decimal(100),
          resolutionStatus: "RESOLVED",
        },
        {
          realizedPnl: new Prisma.Decimal(-50),
          resolutionStatus: "RESOLVED",
        },
        {
          realizedPnl: new Prisma.Decimal(75),
          resolutionStatus: "RESOLVED",
        },
      ]);

      prisma.pnlSnapshot.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(10);
      prisma.traderScore.upsert.mockResolvedValue({});

      await calculator.calculateForUser("user-1");

      expect(prisma.traderScore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          create: expect.objectContaining({
            userId: "user-1",
            totalTrades: 10,
          }),
        }),
      );

      // Win rate should be ~66.67% (2 out of 3 profitable)
      const call = prisma.traderScore.upsert.mock.calls[0][0];
      expect(parseFloat(call.create.winRate.toString())).toBeCloseTo(66.67, 0);
    });
  });
});

// ─── ScoresService ───────────────────────────────────────────────────────────

describe("ScoresService", () => {
  let service: ScoresService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ScoresService(prisma);
  });

  describe("getMyScore", () => {
    it("returns null score when user has no score", async () => {
      prisma.traderScore.findUnique.mockResolvedValue(null);

      const result = await service.getMyScore("user-1");

      expect(result.score).toBeNull();
      expect(result.breakdown).toBeNull();
    });

    it("returns score with breakdown when available", async () => {
      prisma.traderScore.findUnique.mockResolvedValue({
        score: 75,
        winRate: new Prisma.Decimal("60.00"),
        sharpeRatio: new Prisma.Decimal("1.5000"),
        avgReturn: new Prisma.Decimal("5.2500"),
        totalTrades: 50,
        profitFactor: new Prisma.Decimal("2.1000"),
        maxDrawdown: new Prisma.Decimal("100.0000"),
        consistency: new Prisma.Decimal("66.00"),
        updatedAt: new Date("2026-01-01"),
      });

      const result = await service.getMyScore("user-1");

      expect(result.score).toBeTruthy();
      expect(result.breakdown).toBeTruthy();
      expect(result.breakdown!.score).toBe(75);
      expect(result.breakdown!.totalTrades).toBe(50);
    });
  });

  describe("getTopTraders", () => {
    it("returns top 20 traders with user info", async () => {
      prisma.traderScore.findMany.mockResolvedValue([
        {
          userId: "user-1",
          score: 95,
          winRate: new Prisma.Decimal("80.00"),
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
          winRate: new Prisma.Decimal("72.50"),
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

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe("alpha_trader");
      expect(result[0].score).toBe(95);
      expect(result[1].username).toBe("beta_whale");
    });
  });
});

// ─── BadgeService ────────────────────────────────────────────────────────────

describe("BadgeService", () => {
  let badge: BadgeService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    badge = new BadgeService(prisma, makeRedis() as any);
  });

  describe("evaluateForUser", () => {
    it("awards FIRST_TRADE badge when user has trades", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(5);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"), // After beta cutoff
      );

      expect(awarded).toBe(1);
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_type: { userId: "user-1", type: "FIRST_TRADE" } },
          create: expect.objectContaining({
            userId: "user-1",
            type: "FIRST_TRADE",
            name: "First Trade",
          }),
        }),
      );
    });

    it("awards EARLY_ADOPTER for users who joined during beta", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2025-12-01"), // Before beta cutoff
      );

      expect(awarded).toBe(1);
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: "EARLY_ADOPTER",
          }),
        }),
      );
    });

    it("awards WHALE_HUNTER when following 10+ whales", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(15);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"),
      );

      expect(awarded).toBe(1);
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: "WHALE_HUNTER",
            name: "Whale Hunter",
          }),
        }),
      );
    });

    it("awards STRATEGY_MASTER when user has 10+ strategies", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(12);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"),
      );

      expect(awarded).toBe(1);
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: "STRATEGY_MASTER",
          }),
        }),
      );
    });

    it("awards TOP_10 badge when user is in top 10 by score", async () => {
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

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"),
      );

      // Should get TOP_10 and TOP_50
      expect(awarded).toBe(2);
    });

    it("awards WINNING_STREAK_5 when resolved positions include five consecutive profitable outcomes", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([
        { realizedPnl: new Prisma.Decimal(10) },
        { realizedPnl: new Prisma.Decimal(8) },
        { realizedPnl: new Prisma.Decimal(6) },
        { realizedPnl: new Prisma.Decimal(4) },
        { realizedPnl: new Prisma.Decimal(2) },
      ]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"),
      );

      expect(awarded).toBe(1);
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: "WINNING_STREAK_5",
            name: "5-Win Streak",
          }),
        }),
      );
    });

    it("awards COPY_LEADER when at least five active or paused configs copy the user's wallet", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({
        polymarketAddress: "0xLeader",
      });
      prisma.copyConfig.count.mockResolvedValue(5);
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"),
      );

      expect(awarded).toBe(1);
      expect(prisma.copyConfig.count).toHaveBeenCalledWith({
        where: {
          targetWallet: "0xLeader",
          status: { in: ["ACTIVE", "PAUSED"] },
        },
      });
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: "COPY_LEADER",
            name: "Copy Leader",
          }),
        }),
      );
    });

    it("does not award EARLY_ADOPTER at the exact beta cutoff", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2026-06-01T00:00:00Z"),
      );

      expect(awarded).toBe(0);
      expect(prisma.traderBadge.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ type: "EARLY_ADOPTER" }),
        }),
      );
    });

    it("skips badges user already has", async () => {
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

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2025-01-01"), // Before beta
      );

      // Should not re-award existing badges
      expect(awarded).toBe(0);
    });

    it("awards PAPER_GRADUATE when paper trading is profitable", async () => {
      prisma.traderBadge.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      prisma.position.findMany.mockResolvedValue([]);
      prisma.whaleFollow.count.mockResolvedValue(0);
      prisma.strategy.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ polymarketAddress: null });
      prisma.traderScore.findUnique.mockResolvedValue(null);
      prisma.paperPosition.findMany.mockResolvedValue([
        { realizedPnl: new Prisma.Decimal(50) },
        { realizedPnl: new Prisma.Decimal(25) },
      ]);
      prisma.traderBadge.upsert.mockResolvedValue({});

      const awarded = await badge.evaluateForUser(
        "user-1",
        new Date("2027-01-01"),
      );

      expect(awarded).toBe(1);
      expect(prisma.traderBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: "PAPER_GRADUATE",
          }),
        }),
      );
    });
  });
});
