"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const position_reconciler_service_1 = require("./position-reconciler.service");
// ─── Mocks ───────────────────────────────────────────────────────────────────
function makeMocks() {
    const prisma = {
        user: {
            findMany: vitest_1.vi.fn().mockResolvedValue([]),
        },
        position: {
            findMany: vitest_1.vi.fn().mockResolvedValue([]),
            create: vitest_1.vi.fn().mockResolvedValue({}),
            update: vitest_1.vi.fn().mockResolvedValue({}),
        },
    };
    const redis = {
        xadd: vitest_1.vi.fn().mockResolvedValue("ok"),
    };
    const config = {
        get: vitest_1.vi.fn().mockReturnValue("http://mock-polymarket:3099"),
    };
    return { prisma, redis, config };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("PositionReconcilerService", () => {
    let svc;
    let prisma;
    let redis;
    let config;
    (0, vitest_1.beforeEach)(() => {
        const m = makeMocks();
        ({ prisma, redis, config } = m);
        svc = new position_reconciler_service_1.PositionReconcilerService(prisma, redis, config);
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        }));
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
        vitest_1.vi.unstubAllGlobals();
    });
    // ── Creates missing local positions ────────────────────────────────────
    (0, vitest_1.it)("creates missing local positions when Polymarket has them", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    asset: "token-abc",
                    size: "50",
                    avgPrice: "0.65",
                    realizedPnl: "5",
                },
            ],
        }));
        prisma.position.findMany.mockResolvedValue([]);
        await svc.reconcileUser("user-1", "0xWallet");
        (0, vitest_1.expect)(prisma.position.create).toHaveBeenCalledWith({
            data: vitest_1.expect.objectContaining({
                userId: "user-1",
                tokenId: "token-abc",
                size: "50",
                avgPrice: "0.65",
                realizedPnl: "5",
            }),
        });
    });
    // ── Does not create position when size is 0 ─────────────────────────────
    (0, vitest_1.it)("does not create position when Polymarket size is 0", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { asset: "token-abc", size: "0", avgPrice: "0.65", realizedPnl: "0" },
            ],
        }));
        prisma.position.findMany.mockResolvedValue([]);
        await svc.reconcileUser("user-1", "0xWallet");
        (0, vitest_1.expect)(prisma.position.create).not.toHaveBeenCalled();
    });
    // ── Closes stale local positions ───────────────────────────────────────
    (0, vitest_1.it)("marks stale local positions as resolved when Polymarket size is 0", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { asset: "token-xyz", size: "0", avgPrice: "0.50", realizedPnl: "0" },
            ],
        }));
        prisma.position.findMany.mockResolvedValue([
            {
                id: "pos-1",
                tokenId: "token-xyz",
                resolutionStatus: "UNRESOLVED",
            },
        ]);
        await svc.reconcileUser("user-1", "0xWallet");
        (0, vitest_1.expect)(prisma.position.update).toHaveBeenCalledWith({
            where: { id: "pos-1" },
            data: { resolutionStatus: "RESOLVED", size: 0 },
        });
    });
    // ── Skips non-connected users ──────────────────────────────────────────
    (0, vitest_1.it)("skips users without polymarketAddress", async () => {
        // New: reconcile() first queries positions with distinct userId
        prisma.position.findMany.mockResolvedValueOnce([
            { userId: "user-1" },
            { userId: "user-2" },
        ]);
        prisma.user.findMany.mockResolvedValue([
            { id: "user-1", polymarketAddress: null },
            { id: "user-2", polymarketAddress: "0xAddr" },
        ]);
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        }));
        await svc.reconcile();
        // Only user-2 should trigger a fetch
        (0, vitest_1.expect)(fetch).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(fetch).toHaveBeenCalledWith(vitest_1.expect.stringContaining("0xAddr"), vitest_1.expect.any(Object));
    });
    // ── Queries only connected, non-suspended, non-deleted users ───────────
    (0, vitest_1.it)("queries only connected, non-suspended, non-deleted users with open positions", async () => {
        // New: reconcile() first queries positions to find users with unresolved positions
        prisma.position.findMany.mockResolvedValueOnce([{ userId: "user-1" }]);
        prisma.user.findMany.mockResolvedValue([]);
        await svc.reconcile();
        (0, vitest_1.expect)(prisma.position.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ where: { resolutionStatus: "UNRESOLVED" } }));
        (0, vitest_1.expect)(prisma.user.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            where: vitest_1.expect.objectContaining({
                id: { in: ["user-1"] },
                polymarketConnected: true,
                suspended: false,
                deleted: false,
            }),
        }));
    });
    (0, vitest_1.it)("handles API failure per-user without blocking others", async () => {
        prisma.position.findMany.mockResolvedValueOnce([
            { userId: "user-1" },
            { userId: "user-2" },
        ]);
        prisma.user.findMany.mockResolvedValue([
            { id: "user-1", polymarketAddress: "0xAddr1" },
            { id: "user-2", polymarketAddress: "0xAddr2" },
        ]);
        let callCount = 0;
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1)
                throw new Error("Network timeout");
            return { ok: true, json: async () => [] };
        }));
        // Should not throw
        await (0, vitest_1.expect)(svc.reconcile()).resolves.toBeUndefined();
        // Second user should still be processed
        (0, vitest_1.expect)(fetch).toHaveBeenCalledTimes(2);
    });
    // ── Handles non-ok API response ────────────────────────────────────────
    (0, vitest_1.it)("returns early for non-ok API response", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({ ok: false, status: 503 }));
        await svc.reconcileUser("user-1", "0xAddr");
        (0, vitest_1.expect)(prisma.position.findMany).not.toHaveBeenCalled();
    });
    // ── Does not modify position that already matches ──────────────────────
    (0, vitest_1.it)("does not modify position that already matches Polymarket", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    asset: "token-abc",
                    size: "50",
                    avgPrice: "0.65",
                    realizedPnl: "5",
                },
            ],
        }));
        prisma.position.findMany.mockResolvedValue([
            { id: "pos-1", tokenId: "token-abc", resolutionStatus: "UNRESOLVED" },
        ]);
        await svc.reconcileUser("user-1", "0xAddr");
        (0, vitest_1.expect)(prisma.position.create).not.toHaveBeenCalled();
        (0, vitest_1.expect)(prisma.position.update).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=position-reconciler.service.spec.js.map