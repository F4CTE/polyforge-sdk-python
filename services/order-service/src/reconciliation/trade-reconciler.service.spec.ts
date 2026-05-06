import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TradeReconcilerService } from "./trade-reconciler.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    copyTrade: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeClob() {
  return {
    fetchTrades: vi.fn().mockResolvedValue([]),
  } as any;
}

function makeRedis() {
  const client = {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
  return { getClient: () => client } as any;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("TradeReconcilerService", () => {
  let svc: TradeReconcilerService;
  let prisma: ReturnType<typeof makePrisma>;
  let clob: ReturnType<typeof makeClob>;
  let events: any;

  beforeEach(() => {
    prisma = makePrisma();
    clob = makeClob();
    events = { emitOrderFilled: vi.fn().mockResolvedValue(undefined) };
    svc = new TradeReconcilerService(prisma, makeRedis(), clob, events);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── reconcileUserTrades — updates missed fills ──────────────────────────

  describe("reconcileUserTrades()", () => {
    it("updates missed fills from LIVE to CONFIRMED", async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: "order-1",
          userId: "user-1",
          clobOrderId: "clob-1",
          status: "LIVE",
        },
        {
          id: "order-2",
          userId: "user-1",
          clobOrderId: "clob-2",
          status: "LIVE",
        },
      ]);

      clob.fetchTrades.mockResolvedValue([
        {
          id: "trade-1",
          order_id: "clob-1",
          status: "FILLED",
          price: "0.61",
          size: "10",
          match_time: "2026-05-06T00:00:00.000Z",
        },
        {
          id: "trade-2",
          order_id: "clob-2",
          status: "MATCHED",
          price: "0.62",
          size: "20",
          match_time: "2026-05-06T00:00:01.000Z",
        },
      ]);

      const updated = await svc.reconcileUserTrades("user-1", "0xwallet");

      expect(updated).toBe(2);
      expect(prisma.order.update).toHaveBeenCalledTimes(2);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "CONFIRMED",
          clobStatus: "FILLED",
          fillPrice: "0.61",
          fillSize: "10",
        }),
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-2" },
        data: expect.objectContaining({
          status: "CONFIRMED",
          clobStatus: "MATCHED",
          fillPrice: "0.62",
          fillSize: "20",
        }),
      });
      expect(events.emitOrderFilled).toHaveBeenCalledTimes(2);
    });

    it("does not update orders that are still LIVE on the CLOB", async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: "order-1",
          userId: "user-1",
          clobOrderId: "clob-1",
          status: "LIVE",
        },
      ]);

      clob.fetchTrades.mockResolvedValue([
        { id: "trade-1", order_id: "clob-1", status: "LIVE" },
      ]);

      const updated = await svc.reconcileUserTrades("user-1", "0xwallet");

      expect(updated).toBe(0);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it("returns 0 when user has no LIVE orders", async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const updated = await svc.reconcileUserTrades("user-1", "0xwallet");

      expect(updated).toBe(0);
    });
  });

  // ── reconcile — handles API failure gracefully ──────────────────────────

  describe("reconcile()", () => {
    it("handles API failure gracefully without throwing", async () => {
      prisma.order.findMany.mockResolvedValue([{ userId: "user-1" }]);
      prisma.user.findMany.mockResolvedValue([
        { id: "user-1", walletAddress: "0xwallet" },
      ]);
      clob.fetchTrades.mockRejectedValue(new Error("network error"));

      await expect(svc.reconcile()).resolves.toBeUndefined();
    });

    it("skips users without wallet address", async () => {
      prisma.order.findMany.mockResolvedValue([{ userId: "user-1" }]);
      prisma.user.findMany.mockResolvedValue([
        { id: "user-1", walletAddress: null },
      ]);

      await svc.reconcile();

      expect(clob.fetchTrades).not.toHaveBeenCalled();
    });
  });
});
