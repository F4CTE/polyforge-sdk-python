"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const discover_service_1 = require("./discover.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeStrategy(overrides = {}) {
    return {
        id: "strategy-uuid-1",
        userId: "user-uuid-1",
        title: "My Public Strategy",
        visibility: "PUBLIC",
        status: "ACTIVE",
        likeCount: 10,
        forkCount: 3,
        triggers: [{ type: "PRICE_ABOVE" }],
        conditions: [],
        actions: [],
        safety: [],
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        user: {
            id: "user-uuid-1",
            username: "alice",
            displayName: "Alice",
            avatarUrl: null,
        },
        ...overrides,
    };
}
function makeDiscoverQuery(overrides = {}) {
    return {
        page: 1,
        limit: 20,
        ...overrides,
    };
}
function makeLeaderboardQuery(overrides = {}) {
    return {
        page: 1,
        limit: 20,
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("DiscoverService", () => {
    let service;
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        const redis = {
            get: vitest_1.vi.fn().mockResolvedValue(null),
            set: vitest_1.vi.fn().mockResolvedValue("OK"),
        };
        service = new discover_service_1.DiscoverService(db, redis);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── discover ──────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("discover", () => {
        (0, vitest_1.it)("returns a paginated response of strategies", async () => {
            const strategies = [makeStrategy()];
            db.strategy.findMany.mockResolvedValue(strategies);
            db.strategy.count.mockResolvedValue(1);
            const result = await service.discover("user-uuid-1", makeDiscoverQuery());
            (0, vitest_1.expect)(result.data).toHaveLength(1);
            (0, vitest_1.expect)(result.total).toBe(1);
            (0, vitest_1.expect)(result.page).toBe(1);
        });
        (0, vitest_1.it)("filters to PUBLIC and UNLISTED strategies that are not ARCHIVED", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery());
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: {
                    visibility: { in: ["PUBLIC", "UNLISTED"] },
                    status: { not: "ARCHIVED" },
                },
            }));
        });
        (0, vitest_1.it)("orders by likeCount desc when sort is popular (default)", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery());
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { likeCount: "desc" } }));
        });
        (0, vitest_1.it)("orders by createdAt desc when sort is newest", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery({ sort: "newest" }));
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { createdAt: "desc" } }));
        });
        (0, vitest_1.it)("orders by likeCount desc when sort is top_pnl (approximation)", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery({ sort: "top_pnl" }));
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { likeCount: "desc" } }));
        });
        (0, vitest_1.it)("orders by forkCount desc when sort is most_forked", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery({ sort: "most_forked" }));
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { forkCount: "desc" } }));
        });
        (0, vitest_1.it)("caps limit at 50 even if a higher value is supplied", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery({ limit: 200 }));
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ take: 50 }));
        });
        (0, vitest_1.it)("defaults page to 1 and limit to 20 when not provided", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", {});
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ skip: 0, take: 20 }));
        });
        (0, vitest_1.it)("calculates skip correctly for page 2", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery({ page: 2, limit: 10 }));
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ skip: 10, take: 10 }));
        });
        (0, vitest_1.it)("includes user relation in the query", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.discover("user-uuid-1", makeDiscoverQuery());
            (0, vitest_1.expect)(db.strategy.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                        },
                    },
                },
            }));
        });
        (0, vitest_1.it)("strips triggers/conditions/actions/safety from UNLISTED strategies", async () => {
            const unlistedStrategy = makeStrategy({
                visibility: "UNLISTED",
                triggers: [{ type: "PRICE_ABOVE" }],
                conditions: [{ type: "SOME_COND" }],
                actions: [{ type: "BUY" }],
                safety: [{ type: "STOP_LOSS" }],
            });
            db.strategy.findMany.mockResolvedValue([unlistedStrategy]);
            db.strategy.count.mockResolvedValue(1);
            const result = await service.discover("user-uuid-1", makeDiscoverQuery());
            const returned = result.data[0];
            (0, vitest_1.expect)(returned.triggers).toEqual([]);
            (0, vitest_1.expect)(returned.conditions).toEqual([]);
            (0, vitest_1.expect)(returned.actions).toEqual([]);
            (0, vitest_1.expect)(returned.safety).toEqual([]);
        });
        (0, vitest_1.it)("returns strategies with author field instead of user", async () => {
            const strategy = makeStrategy();
            db.strategy.findMany.mockResolvedValue([strategy]);
            db.strategy.count.mockResolvedValue(1);
            const result = await service.discover("user-uuid-1", makeDiscoverQuery());
            const returned = result.data[0];
            (0, vitest_1.expect)(returned.author).toEqual({
                id: "user-uuid-1",
                username: "alice",
                displayName: "Alice",
                avatarUrl: null,
            });
            (0, vitest_1.expect)(returned).not.toHaveProperty("user");
        });
        (0, vitest_1.it)("does NOT strip block fields from PUBLIC strategies", async () => {
            const publicStrategy = makeStrategy({ visibility: "PUBLIC" });
            db.strategy.findMany.mockResolvedValue([publicStrategy]);
            db.strategy.count.mockResolvedValue(1);
            const result = await service.discover("user-uuid-1", makeDiscoverQuery());
            const returned = result.data[0];
            (0, vitest_1.expect)(returned.triggers).toEqual([{ type: "PRICE_ABOVE" }]);
        });
    });
    // ── leaderboard ───────────────────────────────────────────────────────────
    (0, vitest_1.describe)("leaderboard", () => {
        (0, vitest_1.it)("returns a paginated leaderboard with user data", async () => {
            const snapshots = [
                { userId: "user-uuid-1", _sum: { realizedPnl: { toString: () => "500.00" } } },
                { userId: "user-uuid-2", _sum: { realizedPnl: { toString: () => "200.00" } } },
            ];
            const tradeCounts = [
                { userId: "user-uuid-1", _count: 10 },
                { userId: "user-uuid-2", _count: 5 },
            ];
            const users = [
                {
                    id: "user-uuid-1",
                    username: "alice",
                    displayName: "Alice",
                    avatarUrl: null,
                },
                {
                    id: "user-uuid-2",
                    username: "bob",
                    displayName: "Bob",
                    avatarUrl: null,
                },
            ];
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce(snapshots)
                .mockResolvedValueOnce(snapshots); // count query
            db.order.groupBy.mockResolvedValue(tradeCounts);
            db.user.findMany.mockResolvedValue(users);
            const result = await service.leaderboard(makeLeaderboardQuery());
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.total).toBe(2);
            (0, vitest_1.expect)(result.data[0]).toMatchObject({
                rank: 1,
                userId: "user-uuid-1",
                username: "alice",
            });
            (0, vitest_1.expect)(result.data[1]).toMatchObject({ rank: 2, userId: "user-uuid-2" });
        });
        (0, vitest_1.it)("defaults period to 30d", async () => {
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            db.user.findMany.mockResolvedValue([]);
            // Just checking it completes without error with no period specified
            const result = await service.leaderboard({});
            (0, vitest_1.expect)(result.data).toEqual([]);
        });
        (0, vitest_1.it)("handles the 7d period", async () => {
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            db.user.findMany.mockResolvedValue([]);
            const result = await service.leaderboard(makeLeaderboardQuery({ period: "7d" }));
            (0, vitest_1.expect)(result.data).toEqual([]);
        });
        (0, vitest_1.it)("handles the allTime period", async () => {
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            db.user.findMany.mockResolvedValue([]);
            const result = await service.leaderboard(makeLeaderboardQuery({ period: "allTime" }));
            (0, vitest_1.expect)(result.data).toEqual([]);
        });
        (0, vitest_1.it)("caps limit at 100", async () => {
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            db.user.findMany.mockResolvedValue([]);
            // Should not throw even with limit=200 — the service caps it internally
            await (0, vitest_1.expect)(service.leaderboard(makeLeaderboardQuery({ limit: 200 }))).resolves.toBeDefined();
        });
        (0, vitest_1.it)("fills unknown users with empty string fallbacks", async () => {
            const snapshots = [
                { userId: "user-uuid-orphan", _sum: { realizedPnl: { toString: () => "100" } } },
            ];
            const tradeCounts = [
                { userId: "user-uuid-orphan", _count: 1 },
            ];
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce(snapshots)
                .mockResolvedValueOnce(snapshots);
            db.order.groupBy.mockResolvedValue(tradeCounts);
            db.user.findMany.mockResolvedValue([]); // no user record found
            const result = await service.leaderboard(makeLeaderboardQuery());
            (0, vitest_1.expect)(result.data[0]).toMatchObject({
                username: "",
                displayName: "",
                avatarUrl: null,
            });
        });
        (0, vitest_1.it)("handles null pnl in rows gracefully", async () => {
            const snapshots = [
                { userId: "user-uuid-1", _sum: { realizedPnl: null } },
            ];
            const tradeCounts = [
                { userId: "user-uuid-1", _count: 0 },
            ];
            const users = [
                {
                    id: "user-uuid-1",
                    username: "alice",
                    displayName: "Alice",
                    avatarUrl: null,
                },
            ];
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce(snapshots)
                .mockResolvedValueOnce(snapshots);
            db.order.groupBy.mockResolvedValue(tradeCounts);
            db.user.findMany.mockResolvedValue(users);
            const result = await service.leaderboard(makeLeaderboardQuery());
            (0, vitest_1.expect)(result.data[0].pnl).toBe("0");
        });
        (0, vitest_1.it)("handles empty groupBy count result", async () => {
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            db.user.findMany.mockResolvedValue([]);
            const result = await service.leaderboard(makeLeaderboardQuery());
            (0, vitest_1.expect)(result.total).toBe(0);
        });
        (0, vitest_1.it)("assigns correct rank numbers with pagination offset", async () => {
            const snapshots = [
                { userId: "user-uuid-1", _sum: { realizedPnl: { toString: () => "100" } } },
            ];
            // For count, return 21 items worth
            const allSnapshots = Array.from({ length: 21 }, (_, i) => ({
                userId: `user-uuid-${i}`,
                _sum: { realizedPnl: { toString: () => "100" } },
            }));
            const tradeCounts = [
                { userId: "user-uuid-1", _count: 2 },
            ];
            const users = [
                {
                    id: "user-uuid-1",
                    username: "alice",
                    displayName: "Alice",
                    avatarUrl: null,
                },
            ];
            db.pnlSnapshot.groupBy
                .mockResolvedValueOnce(snapshots)
                .mockResolvedValueOnce(allSnapshots);
            db.order.groupBy.mockResolvedValue(tradeCounts);
            db.user.findMany.mockResolvedValue(users);
            const result = await service.leaderboard(makeLeaderboardQuery({ page: 2, limit: 20 }));
            (0, vitest_1.expect)(result.data[0].rank).toBe(21);
        });
    });
});
//# sourceMappingURL=discover.service.spec.js.map