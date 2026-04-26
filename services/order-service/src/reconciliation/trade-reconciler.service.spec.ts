import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TradeReconcilerService } from "./trade-reconciler.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
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

  beforeEach(() => {
    prisma = makePrisma();
    clob = makeClob();
    svc = new TradeReconcilerService(prisma, makeRedis(), clob);
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
        { id: "trade-1", order_id: "clob-1", status: "FILLED" },
        { id: "trade-2", order_id: "clob-2", status: "MATCHED" },
      ]);

      const updated = await svc.reconcileUserTrades("user-1", "0xwallet");

      expect(updated).toBe(2);
      expect(prisma.order.update).toHaveBeenCalledTimes(2);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: "CONFIRMED", clobStatus: "FILLED" },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-2" },
        data: { status: "CONFIRMED", clobStatus: "MATCHED" },
      });
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
