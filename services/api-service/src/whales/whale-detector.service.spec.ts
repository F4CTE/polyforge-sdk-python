import { describe, it, expect, beforeEach, vi } from "vitest";
import { WhaleDetectorService } from "./whale-detector.service";
import { Prisma } from "@prisma/client";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    whaleAlert: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    whaleProfile: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    market: {
      findUnique: vi.fn(),
    },
  } as any;
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    xadd: vi.fn().mockResolvedValue("stream-id"),
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn().mockResolvedValue("OK"),
      xack: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("WhaleDetectorService", () => {
  let service: WhaleDetectorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    service = new WhaleDetectorService(prisma, redis);
  });

  // ── processEvent (via reflection) ─────────────────────────────────────

  describe("processEvent", () => {
    const processEvent = (svc: any, event: Record<string, string>) =>
      svc["processEvent"](event);

    it("ignores non-ORDER_FILLED events", async () => {
      await processEvent(service, { type: "ORDER_CREATED", size: "10000", price: "1" });

      expect(prisma.whaleAlert.create).not.toHaveBeenCalled();
    });

    it("ignores trades below the default threshold ($5000)", async () => {
      await processEvent(service, {
        type: "ORDER_FILLED",
        size: "100",
        price: "0.5",
        walletAddress: "0xabc",
      });

      expect(prisma.whaleAlert.create).not.toHaveBeenCalled();
    });

    it("creates a whale alert when notional exceeds threshold", async () => {
      prisma.whaleAlert.create.mockResolvedValue({ id: "alert1" });
      prisma.whaleProfile.upsert.mockResolvedValue({});
      prisma.market.findUnique.mockResolvedValue({ title: "Test Market" });

      await processEvent(service, {
        type: "ORDER_FILLED",
        size: "10000",
        price: "1.0",
        walletAddress: "0xwhale",
        marketId: "m1",
        tokenId: "t1",
        side: "BUY",
        outcome: "YES",
      });

      expect(prisma.whaleAlert.create).toHaveBeenCalledOnce();
      expect(prisma.whaleProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: "0xwhale" },
        }),
      );
    });

    it("emits WHALE_TRADE event to stream", async () => {
      prisma.whaleAlert.create.mockResolvedValue({ id: "alert1" });
      prisma.whaleProfile.upsert.mockResolvedValue({});
      prisma.market.findUnique.mockResolvedValue({ title: "Test Market" });

      await processEvent(service, {
        type: "ORDER_FILLED",
        size: "20000",
        price: "0.5",
        walletAddress: "0xwhale",
        marketId: "m1",
        side: "SELL",
        outcome: "NO",
      });

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "WHALE_TRADE",
          walletAddress: "0xwhale",
        }),
      );
    });

    it("skips events without wallet address", async () => {
      await processEvent(service, {
        type: "ORDER_FILLED",
        size: "100000",
        price: "1.0",
      });

      expect(prisma.whaleAlert.create).not.toHaveBeenCalled();
    });
  });

  // ── aggregateProfiles ─────────────────────────────────────────────────

  describe("aggregateProfiles", () => {
    it("recalculates volume and trade count for each profile", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([
        { walletAddress: "0xwhale1" },
      ]);
      prisma.whaleAlert.findMany.mockResolvedValue([
        { notional: new Prisma.Decimal(1000) },
        { notional: new Prisma.Decimal(2000) },
      ]);
      prisma.whaleProfile.update.mockResolvedValue({});

      await service.aggregateProfiles();

      expect(prisma.whaleProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: "0xwhale1" },
          data: expect.objectContaining({ tradeCount: 2 }),
        }),
      );
    });
  });
});
