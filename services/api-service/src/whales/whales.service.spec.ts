import { describe, it, expect, beforeEach, vi } from "vitest";
import { WhalesService } from "./whales.service";
import { WhaleDetectorService } from "./whale-detector.service";
import { Prisma } from "@prisma/client";

// ─── Mock PrismaService ─────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    whaleAlert: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    whaleProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    whaleFollow: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    market: {
      findUnique: vi.fn(),
    },
  } as any;
}

// ─── Mock RedisService ──────────────────────────────────────────────────────

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    xadd: vi.fn(),
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn(),
      xreadgroup: vi.fn(),
      xack: vi.fn(),
    }),
  } as any;
}

// ─── WhalesService ──────────────────────────────────────────────────────────

describe("WhalesService", () => {
  let service: WhalesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new WhalesService(prisma);
  });

  describe("getFeed", () => {
    it("returns paginated results", async () => {
      const alerts = [
        { id: "a1", walletAddress: "0xabc", notional: new Prisma.Decimal(10000), detectedAt: new Date() },
        { id: "a2", walletAddress: "0xdef", notional: new Prisma.Decimal(8000), detectedAt: new Date() },
      ];

      prisma.whaleAlert.findMany.mockResolvedValue(alerts);
      prisma.whaleAlert.count.mockResolvedValue(2);

      const result = await service.getFeed({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("applies minSize filter", async () => {
      prisma.whaleAlert.findMany.mockResolvedValue([]);
      prisma.whaleAlert.count.mockResolvedValue(0);

      await service.getFeed({ minSize: "5000", page: 1, limit: 20 });

      const whereArg = prisma.whaleAlert.findMany.mock.calls[0][0].where;
      expect(whereArg.notional).toEqual({ gte: new Prisma.Decimal("5000") });
    });

    it("applies marketId filter", async () => {
      prisma.whaleAlert.findMany.mockResolvedValue([]);
      prisma.whaleAlert.count.mockResolvedValue(0);

      await service.getFeed({ marketId: "mkt-1", page: 1, limit: 20 });

      const whereArg = prisma.whaleAlert.findMany.mock.calls[0][0].where;
      expect(whereArg.marketId).toBe("mkt-1");
    });

    it("applies walletAddress filter", async () => {
      prisma.whaleAlert.findMany.mockResolvedValue([]);
      prisma.whaleAlert.count.mockResolvedValue(0);

      await service.getFeed({ walletAddress: "0xabc", page: 1, limit: 20 });

      const whereArg = prisma.whaleAlert.findMany.mock.calls[0][0].where;
      expect(whereArg.walletAddress).toBe("0xabc");
    });

    it("calculates correct page offset", async () => {
      prisma.whaleAlert.findMany.mockResolvedValue([]);
      prisma.whaleAlert.count.mockResolvedValue(50);

      await service.getFeed({ page: 3, limit: 10 });

      const findManyArg = prisma.whaleAlert.findMany.mock.calls[0][0];
      expect(findManyArg.skip).toBe(20);
      expect(findManyArg.take).toBe(10);
    });
  });

  describe("getTopWhales", () => {
    it("sorts by volume by default", async () => {
      const profiles = [
        { walletAddress: "0x1", totalVolume: new Prisma.Decimal(50000), tradeCount: 10 },
        { walletAddress: "0x2", totalVolume: new Prisma.Decimal(30000), tradeCount: 5 },
      ];
      prisma.whaleProfile.findMany.mockResolvedValue(profiles);

      const result = await service.getTopWhales({});

      expect(result).toHaveLength(2);
      const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ totalVolume: "desc" });
    });

    it("sorts by pnl when requested", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.getTopWhales({ sortBy: "pnl" });

      const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ totalPnl: "desc" });
    });

    it("sorts by winRate when requested", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.getTopWhales({ sortBy: "winRate" });

      const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ winRate: "desc" });
    });

    it("sorts by tradeCount when requested", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.getTopWhales({ sortBy: "tradeCount" });

      const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ tradeCount: "desc" });
    });

    it("respects limit parameter", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.getTopWhales({ limit: 5 });

      const takeArg = prisma.whaleProfile.findMany.mock.calls[0][0].take;
      expect(takeArg).toBe(5);
    });
  });

  describe("toggleFollow", () => {
    it("creates follow when not already following", async () => {
      prisma.whaleFollow.findUnique.mockResolvedValue(null);
      prisma.whaleFollow.create.mockResolvedValue({ id: "f1" });

      const result = await service.toggleFollow("user-1", "0xabc");

      expect(result.followed).toBe(true);
      expect(prisma.whaleFollow.create).toHaveBeenCalledWith({
        data: { userId: "user-1", walletAddress: "0xabc" },
      });
    });

    it("deletes follow when already following", async () => {
      prisma.whaleFollow.findUnique.mockResolvedValue({
        id: "f1",
        userId: "user-1",
        walletAddress: "0xabc",
      });
      prisma.whaleFollow.delete.mockResolvedValue({});

      const result = await service.toggleFollow("user-1", "0xabc");

      expect(result.followed).toBe(false);
      expect(prisma.whaleFollow.delete).toHaveBeenCalledWith({
        where: { id: "f1" },
      });
    });
  });

  describe("getProfile", () => {
    it("returns profile and recent trades", async () => {
      const profile = {
        walletAddress: "0xabc",
        totalVolume: new Prisma.Decimal(50000),
        totalPnl: new Prisma.Decimal(5000),
        tradeCount: 25,
        winRate: new Prisma.Decimal(60),
        lastTradeAt: new Date(),
      };
      const trades = [
        { id: "t1", walletAddress: "0xabc", notional: new Prisma.Decimal(10000) },
      ];

      prisma.whaleProfile.findUnique.mockResolvedValue(profile);
      prisma.whaleAlert.findMany.mockResolvedValue(trades);

      const result = await service.getProfile("0xabc");

      expect(result.profile.walletAddress).toBe("0xabc");
      expect(result.recentTrades).toHaveLength(1);
    });

    it("returns default profile when wallet not found", async () => {
      prisma.whaleProfile.findUnique.mockResolvedValue(null);
      prisma.whaleAlert.findMany.mockResolvedValue([]);

      const result = await service.getProfile("0xunknown");

      expect(result.profile.walletAddress).toBe("0xunknown");
      expect(result.profile.tradeCount).toBe(0);
      expect(result.recentTrades).toHaveLength(0);
    });
  });

  describe("getFollowing", () => {
    it("returns followed wallets enriched with profiles", async () => {
      const follows = [
        { id: "f1", userId: "u1", walletAddress: "0xabc", createdAt: new Date() },
        { id: "f2", userId: "u1", walletAddress: "0xdef", createdAt: new Date() },
      ];
      const profiles = [
        { walletAddress: "0xabc", totalVolume: new Prisma.Decimal(50000) },
      ];

      prisma.whaleFollow.findMany.mockResolvedValue(follows);
      prisma.whaleProfile.findMany.mockResolvedValue(profiles);

      const result = await service.getFollowing("u1");

      expect(result).toHaveLength(2);
      expect(result[0].profile).toBeTruthy();
      expect(result[1].profile).toBeNull();
    });
  });
});

// ─── WhaleDetectorService ───────────────────────────────────────────────────

describe("WhaleDetectorService", () => {
  let detector: WhaleDetectorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    detector = new WhaleDetectorService(prisma, redis);
  });

  describe("processEvent (via reflection)", () => {
    it("ignores events that are not ORDER_FILLED", async () => {
      // Access private method for testing
      const processEvent = (detector as any).processEvent.bind(detector);

      await processEvent({ type: "ORDER_PLACED", size: "100", price: "100" });

      expect(prisma.whaleAlert.create).not.toHaveBeenCalled();
    });

    it("ignores orders below threshold", async () => {
      redis.get.mockResolvedValue("5000");
      const processEvent = (detector as any).processEvent.bind(detector);

      await processEvent({
        type: "ORDER_FILLED",
        walletAddress: "0xabc",
        size: "10",
        price: "100",
        marketId: "mkt-1",
        tokenId: "tok-1",
        side: "BUY",
        outcome: "YES",
      });

      // 10 * 100 = 1000 < 5000 threshold
      expect(prisma.whaleAlert.create).not.toHaveBeenCalled();
    });

    it("creates alert and updates profile for whale orders", async () => {
      redis.get.mockResolvedValue("5000");
      prisma.whaleAlert.create.mockResolvedValue({ id: "alert-1" });
      prisma.whaleProfile.upsert.mockResolvedValue({});
      prisma.market.findUnique.mockResolvedValue({ title: "Test Market" });
      redis.xadd.mockResolvedValue("ok");

      const processEvent = (detector as any).processEvent.bind(detector);

      await processEvent({
        type: "ORDER_FILLED",
        walletAddress: "0xwhale",
        size: "100",
        price: "100",
        marketId: "mkt-1",
        tokenId: "tok-1",
        side: "BUY",
        outcome: "YES",
      });

      // 100 * 100 = 10000 > 5000 threshold
      expect(prisma.whaleAlert.create).toHaveBeenCalled();
      expect(prisma.whaleProfile.upsert).toHaveBeenCalled();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({ type: "WHALE_TRADE", walletAddress: "0xwhale" }),
      );
    });

    it("uses default threshold when Redis config is absent", async () => {
      redis.get.mockResolvedValue(null);
      prisma.whaleAlert.create.mockResolvedValue({ id: "alert-1" });
      prisma.whaleProfile.upsert.mockResolvedValue({});
      prisma.market.findUnique.mockResolvedValue(null);
      redis.xadd.mockResolvedValue("ok");

      const processEvent = (detector as any).processEvent.bind(detector);

      // Notional = 60 * 100 = 6000 > 5000 (default)
      await processEvent({
        type: "ORDER_FILLED",
        walletAddress: "0xwhale",
        size: "60",
        price: "100",
        marketId: "mkt-1",
        tokenId: "tok-1",
        side: "SELL",
        outcome: "NO",
      });

      expect(prisma.whaleAlert.create).toHaveBeenCalled();
    });
  });

  describe("aggregateProfiles", () => {
    it("recalculates profile stats from alerts", async () => {
      const profiles = [
        { walletAddress: "0xabc", tradeCount: 0, totalVolume: new Prisma.Decimal(0) },
      ];
      const alerts = [
        { walletAddress: "0xabc", notional: new Prisma.Decimal(10000) },
        { walletAddress: "0xabc", notional: new Prisma.Decimal(5000) },
      ];

      prisma.whaleProfile.findMany.mockResolvedValue(profiles);
      prisma.whaleAlert.findMany.mockResolvedValue(alerts);
      prisma.whaleProfile.update.mockResolvedValue({});

      await detector.aggregateProfiles();

      expect(prisma.whaleProfile.update).toHaveBeenCalledWith({
        where: { walletAddress: "0xabc" },
        data: expect.objectContaining({
          tradeCount: 2,
        }),
      });
    });

    it("skips profiles with no alerts", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([
        { walletAddress: "0xempty" },
      ]);
      prisma.whaleAlert.findMany.mockResolvedValue([]);

      await detector.aggregateProfiles();

      expect(prisma.whaleProfile.update).not.toHaveBeenCalled();
    });
  });
});
