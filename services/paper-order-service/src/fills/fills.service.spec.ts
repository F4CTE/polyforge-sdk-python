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

function makePaperOrder(
  overrides: Partial<{
    id: string;
    intentId: string;
    fillCompletedAt: Date | null;
    realizedPnl: string;
    redisEffectsApplied: boolean;
    fillSize: string;
    fillPrice: string;
    userId: string;
    strategyId: string;
    marketId: string;
    tokenId: string;
    side: string;
    outcome: string;
    orderType: string;
  }> = {},
) {
  return {
    id: "order-uuid-1",
    intentId: "intent-1",
    fillCompletedAt: null,
    realizedPnl: "0",
    redisEffectsApplied: false,
    fillSize: "100",
    fillPrice: "0.6",
    userId: "user-1",
    strategyId: "strat-1",
    marketId: "mkt-1",
    tokenId: "tok-YES",
    side: "BUY",
    outcome: "YES",
    orderType: "LIMIT",
    ...overrides,
  };
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
    eval: vi.fn().mockResolvedValue(1), // atomic P&L script returns 1 (applied)
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
    (prisma.$transaction as any).mockImplementation(
      async (callback: (tx: PrismaService) => Promise<unknown>) =>
        callback(prisma),
    );

    service = new FillsService(prisma, redis);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── simulate() ──────────────────────────────────────────────────────────

  describe("simulate", () => {
    it("rejects non-finite fill sizes before writing paper order data", async () => {
      await expect(service.simulate(makeIntent({ size: "" }))).rejects.toThrow(
        /Invalid paper order numeric input/,
      );

      expect(prisma.paperOrder.create).not.toHaveBeenCalled();
      expect(redisClient.eval).not.toHaveBeenCalled();
    });

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

      it("creates the order and updates the position inside a serializable transaction", async () => {
        await service.simulate(makeIntent());

        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
          isolationLevel: "Serializable",
        });
        expect(prisma.paperOrder.create).toHaveBeenCalledOnce();
        expect(prisma.paperPosition.create).toHaveBeenCalledOnce();
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

        expect(redisClient.eval).toHaveBeenCalled();
      });

      it("does not update Redis P&L counter when no realized PnL (new BUY position)", async () => {
        await service.simulate(makeIntent());

        // P&L script not called (realizedPnl=0), event still emitted via eval
        expect(redisClient.eval).toHaveBeenCalledTimes(1);
      });

      it("includes orderId and intentId in the emitted stream event", async () => {
        await service.simulate(makeIntent());

        expect(redisClient.eval).toHaveBeenCalled();
      });

      it("includes side, fillSize and tokenId in the emitted stream event", async () => {
        await service.simulate(
          makeIntent({ side: "BUY", size: "50", tokenId: "tok-NO" }),
        );

        const eventEvalCalls = redisClient.eval.mock.calls.filter(
          (call: unknown[]) => call.some((arg) => arg === "PAPER_ORDER_FILLED"),
        );
        expect(eventEvalCalls.length).toBe(1);
      });

      it("rejects non-finite intent size before creating a paper order", async () => {
        await expect(
          service.simulate(makeIntent({ size: "Infinity" })),
        ).rejects.toThrow(/Invalid paper fill size/);

        expect(prisma.paperOrder.create).not.toHaveBeenCalled();
        expect(redisClient.eval).not.toHaveBeenCalled();
      });

      it("rejects non-finite intent price before creating a paper order", async () => {
        await expect(
          service.simulate(makeIntent({ price: "NaN" })),
        ).rejects.toThrow(/Invalid paper fill price/);

        expect(prisma.paperOrder.create).not.toHaveBeenCalled();
        expect(redisClient.eval).not.toHaveBeenCalled();
      });

      it("retries once when the serializable transaction reports P2034", async () => {
        const conflict = Object.assign(new Error("write conflict"), {
          code: "P2034",
        });
        (prisma.$transaction as any)
          .mockRejectedValueOnce(conflict)
          .mockImplementationOnce(
            async (callback: (tx: PrismaService) => Promise<unknown>) =>
              callback(prisma),
          );

        await service.simulate(makeIntent());

        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
        expect(prisma.paperOrder.create).toHaveBeenCalledOnce();
        expect(prisma.paperPosition.create).toHaveBeenCalledOnce();
        expect(redisClient.eval).toHaveBeenCalled();
      });

      it("rethrows a P2034 conflict after exhausting serializable retries", async () => {
        const conflict = Object.assign(new Error("write conflict"), {
          code: "P2034",
        });
        (prisma.$transaction as any).mockRejectedValue(conflict);

        await expect(service.simulate(makeIntent())).rejects.toMatchObject({
          code: "P2034",
        });

        expect(prisma.$transaction).toHaveBeenCalledTimes(3);
        expect(prisma.paperOrder.create).not.toHaveBeenCalled();
        expect(redisClient.eval).not.toHaveBeenCalled();
      });

      it("does not retry non-serializable transaction errors", async () => {
        const err = Object.assign(new Error("unique violation"), {
          code: "P2002",
        });
        (prisma.$transaction as any).mockRejectedValueOnce(err);

        await expect(service.simulate(makeIntent())).rejects.toThrow(
          "unique violation",
        );

        expect(prisma.$transaction).toHaveBeenCalledOnce();
        expect(prisma.paperOrder.create).not.toHaveBeenCalled();
        expect(redisClient.eval).not.toHaveBeenCalled();
      });

      it("does not retry plain thrown values from the transaction", async () => {
        (prisma.$transaction as any).mockRejectedValueOnce("redis unavailable");

        await expect(service.simulate(makeIntent())).rejects.toBe(
          "redis unavailable",
        );

        expect(prisma.$transaction).toHaveBeenCalledOnce();
        expect(prisma.paperOrder.create).not.toHaveBeenCalled();
        expect(redisClient.eval).not.toHaveBeenCalled();
      });

      it("does not retry null transaction rejections", async () => {
        (prisma.$transaction as any).mockRejectedValueOnce(null);

        await expect(service.simulate(makeIntent())).rejects.toBeNull();

        expect(prisma.$transaction).toHaveBeenCalledOnce();
        expect(prisma.paperOrder.create).not.toHaveBeenCalled();
        expect(redisClient.eval).not.toHaveBeenCalled();
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

        expect(redisClient.eval).toHaveBeenCalled();
      });

      it("does not write Infinity when an existing position nets to zero size", async () => {
        (prisma.paperPosition.findUnique as any).mockResolvedValue(
          makePosition({ size: "-100", avgPrice: "0.60" }),
        );
        (prisma.paperPosition.delete as any).mockResolvedValue({});

        await service.simulate(makeIntent({ size: "100", price: "0.80" }));

        expect(prisma.paperPosition.update).not.toHaveBeenCalled();
        expect(prisma.paperPosition.delete).toHaveBeenCalledOnce();
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

          expect(redisClient.eval).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('EXISTS'"),
            2,
            "paper:pnl:applied:intent-1",
            "paper:user-1:pnl",
            expect.closeTo(20, 5),
            604800,
          );
        });

        it("emits PAPER_ORDER_FILLED event after closing", async () => {
          await service.simulate(
            makeIntent({ side: "SELL", size: "100", price: "0.80" }),
          );

          expect(redisClient.eval).toHaveBeenCalled();
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

          expect(redisClient.eval).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('EXISTS'"),
            2,
            "paper:pnl:applied:intent-1",
            "paper:user-1:pnl",
            expect.closeTo(10, 5),
            604800,
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

          // P&L eval not called (realizedPnl=0), event still emitted via eval
          expect(redisClient.eval).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  // ─── idempotency — duplicate intent handling ──────────────────────────────

  describe("idempotency", () => {
    it("returns silently when the intent is already fully processed", async () => {
      (prisma.paperOrder.findUnique as any).mockResolvedValue(
        makePaperOrder({
          fillCompletedAt: new Date(),
          redisEffectsApplied: true,
          realizedPnl: "15",
        }),
      );

      await service.simulate(makeIntent());

      // Must not create a new order, mutate position, or emit events
      expect(prisma.paperOrder.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(redisClient.eval).not.toHaveBeenCalled();
    });

    it("recovers Redis effects when fill completed but effects not applied", async () => {
      (prisma.paperOrder.findUnique as any).mockResolvedValue(
        makePaperOrder({
          id: "recovery-order-1",
          fillCompletedAt: new Date(),
          redisEffectsApplied: false,
          realizedPnl: "20",
          fillSize: "100",
          fillPrice: "0.80",
        }),
      );

      await service.simulate(makeIntent());

      // Must replay Redis side-effects
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('EXISTS'"),
        2,
        "paper:pnl:applied:intent-1",
        "paper:user-1:pnl",
        expect.closeTo(20, 5),
        604800,
      );

      // Must emit PAPER_ORDER_FILLED event (via eval)
      expect(redisClient.eval).toHaveBeenCalledTimes(2);

      // Must mark redisEffectsApplied
      expect(prisma.paperOrder.update).toHaveBeenCalledWith({
        where: { intentId: "intent-1" },
        data: { redisEffectsApplied: true },
      });

      // Must NOT create a new order or run the transaction
      expect(prisma.paperOrder.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("does not re-emit PAPER_ORDER_FILLED when recovery replays after event already emitted but redisEffectsApplied not persisted", async () => {
      // Simulate crash after event emission but before DB update of redisEffectsApplied:
      // the event was already emitted (dedup key exists in Redis), but
      // the DB still shows redisEffectsApplied=false.
      (prisma.paperOrder.findUnique as any).mockResolvedValue(
        makePaperOrder({
          id: "recovery-order-dedup",
          fillCompletedAt: new Date(),
          redisEffectsApplied: false,
          realizedPnl: "20",
          fillSize: "100",
          fillPrice: "0.80",
        }),
      );

      // Event dedup key already exists — event was emitted before crash.
      // The atomic event Lua script returns 0 when dedup key exists.
      redisClient.eval.mockImplementation((_script: string, _numKeys: number, ...args: any[]) => {
        const key0 = String(args[0] ?? '');
        if (key0.startsWith('paper:event:emitted:')) {
          return Promise.resolve(0); // already emitted
        }
        return Promise.resolve(1); // P&L applied
      });

      await service.simulate(makeIntent({ intentId: "intent-dup-event" }));

      // P&L eval should still run (separate dedup boundary)
      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('EXISTS'"),
        2,
        "paper:pnl:applied:intent-dup-event",
        "paper:user-1:pnl",
        expect.closeTo(20, 5),
        604800,
      );

      // Event emission must NOT happen again — dedup handled atomically in Lua
      // Both PNL and event scripts are called, but event script returns 0 (already emitted)
      expect(redisClient.eval).toHaveBeenCalledTimes(2);

      // DB recovery must still complete
      expect(prisma.paperOrder.update).toHaveBeenCalledWith({
        where: { intentId: "intent-dup-event" },
        data: { redisEffectsApplied: true },
      });

      // Must NOT create a new order
      expect(prisma.paperOrder.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("recovers Redis effects even when realizedPnl is zero", async () => {
      (prisma.paperOrder.findUnique as any).mockResolvedValue(
        makePaperOrder({
          id: "recovery-order-2",
          fillCompletedAt: new Date(),
          redisEffectsApplied: false,
          realizedPnl: "0",
          fillSize: "100",
          fillPrice: "0.80",
        }),
      );

      await service.simulate(makeIntent());

      // P&L eval should NOT be called (realizedPnl === 0)
      // Event emission goes through eval — called once for event only
      expect(redisClient.eval).toHaveBeenCalledTimes(1);

      expect(prisma.paperOrder.update).toHaveBeenCalledWith({
        where: { intentId: "intent-1" },
        data: { redisEffectsApplied: true },
      });
    });

    it("throws when an in-flight order exists without fillCompletedAt", async () => {
      (prisma.paperOrder.findUnique as any).mockResolvedValue(
        makePaperOrder({
          fillCompletedAt: null,
          redisEffectsApplied: false,
        }),
      );

      await expect(service.simulate(makeIntent())).rejects.toThrow(
        /incomplete order record/,
      );

      expect(prisma.paperOrder.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(redisClient.eval).not.toHaveBeenCalled();
    });

    it("persists realizedPnl inside the serializable transaction alongside fillCompletedAt", async () => {
      let inTransaction = false;
      let realizedPnlWrittenInTx = false;

      (prisma.$transaction as any).mockImplementation(
        async (callback: (tx: PrismaService) => Promise<unknown>) => {
          inTransaction = true;
          const result = await callback(prisma);
          inTransaction = false;
          return result;
        },
      );

      (prisma.paperOrder.update as any).mockImplementation((args: any) => {
        if (inTransaction && args.data?.realizedPnl !== undefined) {
          realizedPnlWrittenInTx = true;
        }
        return Promise.resolve({});
      });

      (prisma.paperOrder.create as any).mockResolvedValue(makePaperOrder());
      (prisma.paperPosition.findUnique as any).mockResolvedValue(
        makePosition({ size: "100", avgPrice: "0.60" }),
      );
      (prisma.paperPosition.delete as any).mockResolvedValue({});

      await service.simulate(
        makeIntent({ side: "SELL", size: "100", price: "0.80" }),
      );

      expect(realizedPnlWrittenInTx).toBe(true);
    });

    it("recovers Redis effects with correct realizedPnl after crash between fill commit and Redis write", async () => {
      (prisma.paperOrder.findUnique as any).mockResolvedValue(
        makePaperOrder({
          id: "crash-order-pnl",
          fillCompletedAt: new Date(),
          redisEffectsApplied: false,
          realizedPnl: "30",
          fillSize: "100",
          fillPrice: "0.80",
        }),
      );

      await service.simulate(makeIntent());

      expect(redisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('EXISTS'"),
        2,
        "paper:pnl:applied:intent-1",
        "paper:user-1:pnl",
        expect.closeTo(30, 5),
        604800,
      );

      expect(prisma.paperOrder.update).toHaveBeenCalledWith({
        where: { intentId: "intent-1" },
        data: { redisEffectsApplied: true },
      });

      expect(prisma.paperOrder.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

        expect(redisClient.eval).toHaveBeenCalledWith(
          expect.stringContaining("redis.call('EXISTS'"),
          2,
          "paper:pnl:applied:intent-1",
          "paper:user-1:pnl",
          expect.closeTo(30, 5),
          604800,
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

        expect(redisClient.eval).toHaveBeenCalledWith(
          expect.stringContaining("redis.call('EXISTS'"),
          2,
          "paper:pnl:applied:intent-1",
          "paper:user-1:pnl",
          expect.closeTo(-30, 5),
          604800,
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
        expect(redisClient.eval).toHaveBeenCalledWith(
          expect.stringContaining("redis.call('EXISTS'"),
          2,
          "paper:pnl:applied:intent-1",
          "paper:user-1:pnl",
          expect.closeTo(10, 5),
          604800,
        );
        // Position fully closed
        expect(prisma.paperPosition.delete).toHaveBeenCalledOnce();
      });
    });
  });
});
