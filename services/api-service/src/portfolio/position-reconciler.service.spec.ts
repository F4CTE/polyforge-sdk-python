import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PositionReconcilerService } from "./position-reconciler.service";

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeMocks() {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    position: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;

  const redis = {
    xadd: vi.fn().mockResolvedValue("ok"),
  } as any;

  const config = {
    get: vi.fn().mockReturnValue("http://mock-polymarket:3099"),
  } as any;

  const gateway = {
    pushNotification: vi.fn(),
  } as any;

  return { prisma, redis, config, gateway };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PositionReconcilerService", () => {
  let svc: PositionReconcilerService;
  let prisma: ReturnType<typeof makeMocks>["prisma"];
  let redis: ReturnType<typeof makeMocks>["redis"];
  let config: ReturnType<typeof makeMocks>["config"];
  let gateway: ReturnType<typeof makeMocks>["gateway"];

  beforeEach(() => {
    const m = makeMocks();
    ({ prisma, redis, config, gateway } = m);
    svc = new PositionReconcilerService(prisma, redis, config, gateway);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Creates missing local positions ────────────────────────────────────

  it("creates missing local positions when Polymarket has them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            asset: "token-abc",
            size: "50",
            avgPrice: "0.65",
            realizedPnl: "5",
          },
        ],
      }),
    );

    prisma.position.findMany.mockResolvedValue([]);

    await svc.reconcileUser("user-1", "0xWallet");

    expect(prisma.position.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenId: "token-abc",
        size: "50",
        avgPrice: "0.65",
        realizedPnl: "5",
      }),
    });
  });

  // ── Does not create position when size is 0 ─────────────────────────────

  it("does not create position when Polymarket size is 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { asset: "token-abc", size: "0", avgPrice: "0.65", realizedPnl: "0" },
        ],
      }),
    );

    prisma.position.findMany.mockResolvedValue([]);

    await svc.reconcileUser("user-1", "0xWallet");

    expect(prisma.position.create).not.toHaveBeenCalled();
  });

  // ── Closes stale local positions ───────────────────────────────────────

  it("marks stale local positions as resolved when Polymarket size is 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { asset: "token-xyz", size: "0", avgPrice: "0.50", realizedPnl: "0" },
        ],
      }),
    );

    prisma.position.findMany.mockResolvedValue([
      {
        id: "pos-1",
        tokenId: "token-xyz",
        resolutionStatus: "UNRESOLVED",
      },
    ]);

    await svc.reconcileUser("user-1", "0xWallet");

    expect(prisma.position.update).toHaveBeenCalledWith({
      where: { id: "pos-1" },
      data: { resolutionStatus: "RESOLVED", size: 0 },
    });
  });

  // ── Skips non-connected users ──────────────────────────────────────────

  it("skips users without polymarketAddress", async () => {
    // New: reconcile() first queries positions with distinct userId
    prisma.position.findMany.mockResolvedValueOnce([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", polymarketAddress: null },
      { id: "user-2", polymarketAddress: "0xAddr" },
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    await svc.reconcile();

    // Only user-2 should trigger a fetch
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("0xAddr"),
      expect.any(Object),
    );
  });

  // ── Queries only connected, non-suspended, non-deleted users ───────────

  it("queries only connected, non-suspended, non-deleted users with open positions", async () => {
    // New: reconcile() first queries positions to find users with unresolved positions
    prisma.position.findMany.mockResolvedValueOnce([{ userId: "user-1" }]);
    prisma.user.findMany.mockResolvedValue([]);

    await svc.reconcile();

    expect(prisma.position.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { resolutionStatus: "UNRESOLVED" } }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["user-1"] },
          polymarketConnected: true,
          suspended: false,
          deleted: false,
        }),
      }),
    );
  });

  it("handles API failure per-user without blocking others", async () => {
    prisma.position.findMany.mockResolvedValueOnce([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", polymarketAddress: "0xAddr1" },
      { id: "user-2", polymarketAddress: "0xAddr2" },
    ]);

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("Network timeout");
        return { ok: true, json: async () => [] };
      }),
    );

    // Should not throw
    await expect(svc.reconcile()).resolves.toBeUndefined();

    // Second user should still be processed
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // ── Handles non-ok API response ────────────────────────────────────────

  it("returns early for non-ok API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await svc.reconcileUser("user-1", "0xAddr");

    expect(prisma.position.findMany).not.toHaveBeenCalled();
  });

  // ── Does not modify position that already matches ──────────────────────

  it("sends WebSocket notification when position is resolved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { asset: "token-xyz", size: "0", avgPrice: "0.50", realizedPnl: "25.00" },
        ],
      }),
    );

    prisma.position.findMany.mockResolvedValue([
      {
        id: "pos-1",
        tokenId: "token-xyz",
        marketId: "mkt-1",
        outcome: "YES",
        resolutionStatus: "UNRESOLVED",
      },
    ]);

    await svc.reconcileUser("user-1", "0xWallet");

    expect(gateway.pushNotification).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        type: "MARKET_RESOLVED",
        positionId: "pos-1",
        tokenId: "token-xyz",
        realizedPnl: "25.00",
      }),
    );
  });

  it("returns early when no users have unresolved positions", async () => {
    prisma.position.findMany.mockResolvedValueOnce([]);

    await svc.reconcile();

    // Should not query users at all
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("handles missing realizedPnl in polymarket data (defaults to '0')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { asset: "token-abc", size: "50", avgPrice: "0.65" },
        ],
      }),
    );

    prisma.position.findMany.mockResolvedValue([]);

    await svc.reconcileUser("user-1", "0xWallet");

    expect(prisma.position.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        realizedPnl: "0",
      }),
    });
  });

  it("does not modify position that already matches Polymarket", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            asset: "token-abc",
            size: "50",
            avgPrice: "0.65",
            realizedPnl: "5",
          },
        ],
      }),
    );

    prisma.position.findMany.mockResolvedValue([
      { id: "pos-1", tokenId: "token-abc", resolutionStatus: "UNRESOLVED" },
    ]);

    await svc.reconcileUser("user-1", "0xAddr");

    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.position.update).not.toHaveBeenCalled();
  });
});
