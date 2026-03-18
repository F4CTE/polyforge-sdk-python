import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mockDeep, MockProxy } from "vitest-mock-extended";
import { FillsService, OrderIntent } from "./fills.service";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIntent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId: "intent-1",
    userId: "user-1",
    strategyId: "strat-1",
    marketId: "mkt-1",
    tokenId: "tok-YES",
    side: "BUY",
    outcome: "YES",
    size: "100",
    price: "0.60",
    orderType: "LIMIT",
    expiration: "0",
    ...overrides,
  };
}

function makePaperOrder(overrides: Partial<{ id: string }> = {}) {
  return { id: "order-uuid-1", ...overrides };
}

function makePosition(
  overrides: Partial<{
    userId: string;
    tokenId: string;
    marketId: string;
    outcome: string;
    size: string;
    avgPrice: string;
    currentPrice: string;
    unrealizedPnl: string;
    realizedPnl: string;
  }> = {},
) {
  return {
    userId: "user-1",
    tokenId: "tok-YES",
    marketId: "mkt-1",
    outcome: "YES",
    size: "100",
    avgPrice: "0.60",
    currentPrice: "0.60",
    unrealizedPnl: "0",
    realizedPnl: "0",
    ...overrides,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function buildMockRedisClient() {
  return {
    incrbyfloat: vi.fn().mockResolvedValue("0"),
    xadd: vi.fn().mockResolvedValue("1-0"),
    get: vi.fn().mockResolvedValue(null),
  };
}

describe("FillsService", () => {
  let service: FillsService;
  let prisma: MockProxy<PrismaService>;
  let redis: MockProxy<RedisService>;
  let redisClient: ReturnType<typeof buildMockRedisClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    redis = mockDeep<RedisService>();

    redisClient = buildMockRedisClient();
    redis.getClient.mockReturnValue(redisClient as any);
    redis.get.mockResolvedValue(null); // no book or price cache by default
    redis.xadd.mockResolvedValue("1-0");

    service = new FillsService(prisma, redis);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── simulate() ──────────────────────────────────────────────────────────

  describe("simulate", () => {
    describe("BUY — new position", () => {
      beforeEach(() => {
        (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
        (prisma.paperPosition.findUnique as any).mockResolvedValue(null);
        (prisma.paperPosition.create as any).mockResolvedValue({});
      });

      it("creates a paper order with CONFIRMED status", async () => {
        await service.simulate(makeIntent());

        expect(prisma.paperOrder.create).toHaveBeenCalledOnce();
        expect(prisma.paperOrder.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: "user-1",
              status: "CONFIRMED",
              side: "BUY",
            }),
          }),
        );
      });

      it("stores fillPrice and fillSize on the created order", async () => {
        await service.simulate(makeIntent({ price: "0.60", size: "100" }));

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        expect(data.fillSize).toBe("100");
        // fillPrice is the resolved price — with no book data it equals intent.price
        expect(data.fillPrice).toBe("0.6");
      });

      it("creates a new paper position when none exists", async () => {
        await service.simulate(makeIntent());

        expect(prisma.paperPosition.create).toHaveBeenCalledOnce();
        expect(prisma.paperPosition.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: "user-1",
              tokenId: "tok-YES",
            }),
          }),
        );
      });

      it("emits PAPER_ORDER_FILLED event to stream:events", async () => {
        await service.simulate(makeIntent());

        expect(redis.xadd).toHaveBeenCalledWith(
          "stream:events",
          expect.objectContaining({
            type: "PAPER_ORDER_FILLED",
            userId: "user-1",
          }),
        );
      });

      it("does not update Redis P&L counter when no realized PnL (new BUY position)", async () => {
        await service.simulate(makeIntent());

        expect(redisClient.incrbyfloat).not.toHaveBeenCalled();
      });

      it("includes orderId and intentId in the emitted stream event", async () => {
        await service.simulate(makeIntent());

        expect(redis.xadd).toHaveBeenCalledWith(
          "stream:events",
          expect.objectContaining({
            orderId: "order-uuid-1",
            intentId: "intent-1",
          }),
        );
      });

      it("includes side, fillSize and tokenId in the emitted stream event", async () => {
        await service.simulate(
          makeIntent({ side: "BUY", size: "50", tokenId: "tok-NO" }),
        );

        expect(redis.xadd).toHaveBeenCalledWith(
          "stream:events",
          expect.objectContaining({
            side: "BUY",
            fillSize: "50",
            tokenId: "tok-NO",
          }),
        );
      });
    });

    describe("BUY — adding to existing position", () => {
      beforeEach(() => {
        (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "100", avgPrice: "0.60" }),
        );
        (prisma.paperPosition.update as any).mockResolvedValue({});
      });

      it("updates the position with weighted average price", async () => {
        // Buying 100 more at 0.80 → new avg = (100*0.60 + 100*0.80) / 200 = 0.70
        await service.simulate(makeIntent({ size: "100", price: "0.80" }));

        expect(prisma.paperPosition.update).toHaveBeenCalledOnce();
        const { data } = (prisma.paperPosition.update as any).mock.calls[0][0];
        expect(parseFloat(data.size)).toBeCloseTo(200);
        expect(parseFloat(data.avgPrice)).toBeCloseTo(0.7);
      });

      it("emits PAPER_ORDER_FILLED event", async () => {
        await service.simulate(makeIntent({ size: "100", price: "0.80" }));

        expect(redis.xadd).toHaveBeenCalledWith(
          "stream:events",
          expect.objectContaining({ type: "PAPER_ORDER_FILLED" }),
        );
      });
    });

    describe("SELL — closing/reducing position", () => {
      describe("full close", () => {
        beforeEach(() => {
          (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
          (prisma.paperPosition.findUnique as any).mockResolvedValue(
            makePosition({ size: "100", avgPrice: "0.60" }),
          );
          (prisma.paperPosition.delete as any).mockResolvedValue({});
        });

        it("deletes the position when selling full size", async () => {
          await service.simulate(
            makeIntent({ side: "SELL", size: "100", price: "0.80" }),
          );

          expect(prisma.paperPosition.delete).toHaveBeenCalledOnce();
        });

        it("calculates realized PnL correctly on a full close", async () => {
          // BUY avg 0.60, SELL at 0.80, size 100 → PnL = (0.80 - 0.60) * 100 = 20
          await service.simulate(
            makeIntent({ side: "SELL", size: "100", price: "0.80" }),
          );

          expect(redisClient.incrbyfloat).toHaveBeenCalledWith(
            "paper:user-1:pnl",
            expect.closeTo(20, 5),
          );
        });

        it("emits PAPER_ORDER_FILLED event after closing", async () => {
          await service.simulate(
            makeIntent({ side: "SELL", size: "100", price: "0.80" }),
          );

          expect(redis.xadd).toHaveBeenCalledWith(
            "stream:events",
            expect.objectContaining({
              type: "PAPER_ORDER_FILLED",
              side: "SELL",
            }),
          );
        });
      });

      describe("partial close", () => {
        beforeEach(() => {
          (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
          (prisma.paperPosition.findUnique as any).mockResolvedValue(
            makePosition({ size: "100", avgPrice: "0.60" }),
          );
          (prisma.paperPosition.update as any).mockResolvedValue({});
        });

        it("reduces position size without deleting when partially sold", async () => {
          // Sell only 50 of the 100 held
          await service.simulate(
            makeIntent({ side: "SELL", size: "50", price: "0.80" }),
          );

          expect(prisma.paperPosition.update).toHaveBeenCalledOnce();
          expect(prisma.paperPosition.delete).not.toHaveBeenCalled();

          const { data } = (prisma.paperPosition.update as any).mock
            .calls[0][0];
          expect(parseFloat(data.size)).toBeCloseTo(50);
        });

        it("calculates realized PnL for partial close", async () => {
          // Sell 50 at 0.80, avg 0.60 → PnL = (0.80 - 0.60) * 50 = 10
          await service.simulate(
            makeIntent({ side: "SELL", size: "50", price: "0.80" }),
          );

          expect(redisClient.incrbyfloat).toHaveBeenCalledWith(
            "paper:user-1:pnl",
            expect.closeTo(10, 5),
          );
        });

        it("accumulates realizedPnl in the position record", async () => {
          await service.simulate(
            makeIntent({ side: "SELL", size: "50", price: "0.80" }),
          );

          const { data } = (prisma.paperPosition.update as any).mock
            .calls[0][0];
          // Starting realizedPnl was '0', adding 10 → '10'
          expect(parseFloat(data.realizedPnl)).toBeCloseTo(10);
        });
      });

      describe("SELL with no existing position", () => {
        beforeEach(() => {
          (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
          (prisma.paperPosition.findUnique as any).mockResolvedValue(null);
        });

        it("creates the paper order but does not create or delete a position", async () => {
          await service.simulate(makeIntent({ side: "SELL" }));

          expect(prisma.paperOrder.create).toHaveBeenCalledOnce();
          expect(prisma.paperPosition.create).not.toHaveBeenCalled();
          expect(prisma.paperPosition.delete).not.toHaveBeenCalled();
          expect(prisma.paperPosition.update).not.toHaveBeenCalled();
        });

        it("does not update Redis P&L counter when no position to close", async () => {
          await service.simulate(makeIntent({ side: "SELL" }));

          expect(redisClient.incrbyfloat).not.toHaveBeenCalled();
        });
      });
    });
  });

  // ─── resolveFillPrice() — via simulate() ─────────────────────────────────
  // resolveFillPrice is private; we test it through simulate() by inspecting
  // the fillPrice stored in the paperOrder.create call.

  describe("resolveFillPrice", () => {
    beforeEach(() => {
      (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
      (prisma.paperPosition.findUnique as any).mockResolvedValue(null);
      (prisma.paperPosition.create as any).mockResolvedValue({});
    });

    it("uses intent price when no book or price cache exists", async () => {
      redis.get.mockResolvedValue(null);

      await service.simulate(makeIntent({ price: "0.65", side: "BUY" }));

      const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
      expect(parseFloat(data.fillPrice)).toBeCloseTo(0.65);
    });

    it("uses last price from price cache when book cache is absent", async () => {
      redis.get.mockImplementation(async (key: string) => {
        if (key.startsWith("cache:price:")) {
          return JSON.stringify({ price: "0.72" });
        }
        return null;
      });

      await service.simulate(makeIntent({ price: "0.65", side: "BUY" }));

      const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
      expect(parseFloat(data.fillPrice)).toBeCloseTo(0.72);
    });

    describe("BUY price improvement from book", () => {
      it("fills at best ask when ask is lower than intent price", async () => {
        redis.get.mockImplementation(async (key: string) => {
          if (key.startsWith("cache:book:")) {
            return JSON.stringify({ asks: [{ price: "0.55" }], bids: [] });
          }
          return null;
        });

        await service.simulate(makeIntent({ price: "0.65", side: "BUY" }));

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        // Ask 0.55 < limit 0.65 → price improvement to 0.55
        expect(parseFloat(data.fillPrice)).toBeCloseTo(0.55);
      });

      it("fills at intent price when ask is higher than intent price", async () => {
        redis.get.mockImplementation(async (key: string) => {
          if (key.startsWith("cache:book:")) {
            return JSON.stringify({ asks: [{ price: "0.70" }], bids: [] });
          }
          return null;
        });

        await service.simulate(makeIntent({ price: "0.65", side: "BUY" }));

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        // Ask 0.70 > limit 0.65 → no improvement, use limit price 0.65
        expect(parseFloat(data.fillPrice)).toBeCloseTo(0.65);
      });

      it("fills at intent price when book has no asks", async () => {
        redis.get.mockImplementation(async (key: string) => {
          if (key.startsWith("cache:book:")) {
            return JSON.stringify({ asks: [], bids: [{ price: "0.55" }] });
          }
          return null;
        });

        await service.simulate(makeIntent({ price: "0.65", side: "BUY" }));

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        expect(parseFloat(data.fillPrice)).toBeCloseTo(0.65);
      });
    });

    describe("SELL price improvement from book", () => {
      beforeEach(() => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "100", avgPrice: "0.50" }),
        );
        (prisma.paperPosition.delete as any).mockResolvedValue({});
      });

      it("fills at best bid when bid is higher than intent price", async () => {
        redis.get.mockImplementation(async (key: string) => {
          if (key.startsWith("cache:book:")) {
            return JSON.stringify({ bids: [{ price: "0.75" }], asks: [] });
          }
          return null;
        });

        await service.simulate(
          makeIntent({ price: "0.65", side: "SELL", size: "100" }),
        );

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        // Bid 0.75 > limit 0.65 → price improvement to 0.75
        expect(parseFloat(data.fillPrice)).toBeCloseTo(0.75);
      });

      it("fills at intent price when bid is lower than intent price", async () => {
        redis.get.mockImplementation(async (key: string) => {
          if (key.startsWith("cache:book:")) {
            return JSON.stringify({ bids: [{ price: "0.55" }], asks: [] });
          }
          return null;
        });

        await service.simulate(
          makeIntent({ price: "0.65", side: "SELL", size: "100" }),
        );

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        // Bid 0.55 < limit 0.65 → no improvement, use limit price 0.65
        expect(parseFloat(data.fillPrice)).toBeCloseTo(0.65);
      });

      it("fills at intent price when book has no bids", async () => {
        redis.get.mockImplementation(async (key: string) => {
          if (key.startsWith("cache:book:")) {
            return JSON.stringify({ bids: [], asks: [{ price: "0.70" }] });
          }
          return null;
        });

        await service.simulate(
          makeIntent({ price: "0.65", side: "SELL", size: "100" }),
        );

        const { data } = (prisma.paperOrder.create as any).mock.calls[0][0];
        expect(parseFloat(data.fillPrice)).toBeCloseTo(0.65);
      });
    });
  });

  // ─── upsertPosition() — via simulate() ───────────────────────────────────

  describe("upsertPosition", () => {
    beforeEach(() => {
      (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
    });

    describe("BUY — creates a new position when none exists", () => {
      beforeEach(() => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(null);
        (prisma.paperPosition.create as any).mockResolvedValue({});
      });

      it("creates the position with the correct avg price", async () => {
        await service.simulate(makeIntent({ price: "0.60", size: "200" }));

        const { data } = (prisma.paperPosition.create as any).mock.calls[0][0];
        expect(parseFloat(data.avgPrice)).toBeCloseTo(0.6);
        expect(parseFloat(data.size)).toBeCloseTo(200);
      });

      it("sets unrealizedPnl to 0 on a new position", async () => {
        await service.simulate(makeIntent({ price: "0.60", size: "200" }));

        const { data } = (prisma.paperPosition.create as any).mock.calls[0][0];
        expect(data.unrealizedPnl).toBe("0");
      });
    });

    describe("BUY — adds to existing position (weighted average)", () => {
      beforeEach(() => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "200", avgPrice: "0.50" }),
        );
        (prisma.paperPosition.update as any).mockResolvedValue({});
      });

      it("computes the weighted average correctly", async () => {
        // Existing: 200 @ 0.50. New buy: 100 @ 0.80
        // New avg = (200*0.50 + 100*0.80) / 300 = (100 + 80) / 300 = 0.6
        await service.simulate(
          makeIntent({ size: "100", price: "0.80", side: "BUY" }),
        );

        const { data } = (prisma.paperPosition.update as any).mock.calls[0][0];
        expect(parseFloat(data.size)).toBeCloseTo(300);
        expect(parseFloat(data.avgPrice)).toBeCloseTo(0.6);
      });

      it("updates unrealizedPnl based on new avg and fill price", async () => {
        // After buy: size 300, avg 0.6, current price 0.80
        // unrealizedPnl = (0.80 - 0.60) * 300 = 60
        await service.simulate(
          makeIntent({ size: "100", price: "0.80", side: "BUY" }),
        );

        const { data } = (prisma.paperPosition.update as any).mock.calls[0][0];
        expect(parseFloat(data.unrealizedPnl)).toBeCloseTo(60);
      });
    });

    describe("SELL — full close returns positive realizedPnl", () => {
      beforeEach(() => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "100", avgPrice: "0.40", realizedPnl: "0" }),
        );
        (prisma.paperPosition.delete as any).mockResolvedValue({});
      });

      it("returns correct realizedPnl and updates Redis", async () => {
        // Buy avg 0.40, sell at 0.70, 100 shares → PnL = 30
        await service.simulate(
          makeIntent({ side: "SELL", size: "100", price: "0.70" }),
        );

        expect(redisClient.incrbyfloat).toHaveBeenCalledWith(
          "paper:user-1:pnl",
          expect.closeTo(30, 5),
        );
      });
    });

    describe("SELL — full close returns negative realizedPnl", () => {
      beforeEach(() => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "100", avgPrice: "0.80", realizedPnl: "0" }),
        );
        (prisma.paperPosition.delete as any).mockResolvedValue({});
      });

      it("correctly records a loss", async () => {
        // Buy avg 0.80, sell at 0.50, 100 shares → PnL = -30
        await service.simulate(
          makeIntent({ side: "SELL", size: "100", price: "0.50" }),
        );

        expect(redisClient.incrbyfloat).toHaveBeenCalledWith(
          "paper:user-1:pnl",
          expect.closeTo(-30, 5),
        );
      });
    });

    describe("SELL — sells more than held (caps at existingSize)", () => {
      beforeEach(() => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "50", avgPrice: "0.60", realizedPnl: "0" }),
        );
        (prisma.paperPosition.delete as any).mockResolvedValue({});
      });

      it("closes only existing size even if intent size is larger", async () => {
        // Only 50 held, trying to sell 200 → closes 50
        await service.simulate(
          makeIntent({ side: "SELL", size: "200", price: "0.80" }),
        );

        // realizedPnl = (0.80 - 0.60) * 50 = 10
        expect(redisClient.incrbyfloat).toHaveBeenCalledWith(
          "paper:user-1:pnl",
          expect.closeTo(10, 5),
        );
        // Position fully closed
        expect(prisma.paperPosition.delete).toHaveBeenCalledOnce();
      });
    });
  });
});
