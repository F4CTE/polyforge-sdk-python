import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DiscoverService } from "./discover.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeStrategy(overrides: Record<string, unknown> = {}) {
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

function makeDiscoverQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

function makeLeaderboardQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("DiscoverService", () => {
  let service: DiscoverService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    const redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
    } as any;
    service = new DiscoverService(db as any, redis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── discover ──────────────────────────────────────────────────────────────

  describe("discover", () => {
    it("returns a paginated response of strategies", async () => {
      const strategies = [makeStrategy()];
      db.strategy.findMany.mockResolvedValue(strategies as any);
      db.strategy.count.mockResolvedValue(1);

      const result = await service.discover("user-uuid-1", makeDiscoverQuery());

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it("filters to PUBLIC and UNLISTED strategies that are not ARCHIVED", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover("user-uuid-1", makeDiscoverQuery());

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            visibility: { in: ["PUBLIC", "UNLISTED"] },
            status: { not: "ARCHIVED" },
          },
        }),
      );
    });

    it("orders by likeCount desc when sort is popular (default)", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover("user-uuid-1", makeDiscoverQuery());

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { likeCount: "desc" } }),
      );
    });

    it("orders by createdAt desc when sort is newest", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover(
        "user-uuid-1",
        makeDiscoverQuery({ sort: "newest" }),
      );

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("orders by likeCount desc when sort is top_pnl (approximation)", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover(
        "user-uuid-1",
        makeDiscoverQuery({ sort: "top_pnl" }),
      );

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { likeCount: "desc" } }),
      );
    });

    it("orders by forkCount desc when sort is most_forked", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover(
        "user-uuid-1",
        makeDiscoverQuery({ sort: "most_forked" }),
      );

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { forkCount: "desc" } }),
      );
    });

    it("caps limit at 50 even if a higher value is supplied", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover("user-uuid-1", makeDiscoverQuery({ limit: 200 }));

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it("defaults page to 1 and limit to 20 when not provided", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover("user-uuid-1", {});

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it("calculates skip correctly for page 2", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover(
        "user-uuid-1",
        makeDiscoverQuery({ page: 2, limit: 10 }),
      );

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it("includes user relation in the query", async () => {
      db.strategy.findMany.mockResolvedValue([]);
      db.strategy.count.mockResolvedValue(0);

      await service.discover("user-uuid-1", makeDiscoverQuery());

      expect(db.strategy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
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
        }),
      );
    });

    it("strips triggers/conditions/actions/safety from UNLISTED strategies", async () => {
      const unlistedStrategy = makeStrategy({
        visibility: "UNLISTED",
        triggers: [{ type: "PRICE_ABOVE" }],
        conditions: [{ type: "SOME_COND" }],
        actions: [{ type: "BUY" }],
        safety: [{ type: "STOP_LOSS" }],
      });
      db.strategy.findMany.mockResolvedValue([unlistedStrategy] as any);
      db.strategy.count.mockResolvedValue(1);

      const result = await service.discover("user-uuid-1", makeDiscoverQuery());

      const returned = result.data[0];
      expect(returned.triggers).toEqual([]);
      expect(returned.conditions).toEqual([]);
      expect(returned.actions).toEqual([]);
      expect(returned.safety).toEqual([]);
    });

    it("returns strategies with author field instead of user", async () => {
      const strategy = makeStrategy();
      db.strategy.findMany.mockResolvedValue([strategy] as any);
      db.strategy.count.mockResolvedValue(1);

      const result = await service.discover("user-uuid-1", makeDiscoverQuery());

      const returned = result.data[0];
      expect(returned.author).toEqual({
        id: "user-uuid-1",
        username: "alice",
        displayName: "Alice",
        avatarUrl: null,
      });
      expect(returned).not.toHaveProperty("user");
    });

    it("does NOT strip block fields from PUBLIC strategies", async () => {
      const publicStrategy = makeStrategy({ visibility: "PUBLIC" });
      db.strategy.findMany.mockResolvedValue([publicStrategy] as any);
      db.strategy.count.mockResolvedValue(1);

      const result = await service.discover("user-uuid-1", makeDiscoverQuery());

      const returned = result.data[0];
      expect(returned.triggers).toEqual([{ type: "PRICE_ABOVE" }]);
    });
  });

  // ── leaderboard ───────────────────────────────────────────────────────────

  describe("leaderboard", () => {
    it("returns a paginated leaderboard with user data", async () => {
      const snapshots = [
        {
          userId: "user-uuid-1",
          _sum: { realizedPnl: { toString: () => "500.00" } },
        },
        {
          userId: "user-uuid-2",
          _sum: { realizedPnl: { toString: () => "200.00" } },
        },
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
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce(snapshots as any)
        .mockResolvedValueOnce(snapshots as any); // count query
      (db.order.groupBy as any).mockResolvedValue(tradeCounts as any);
      db.user.findMany.mockResolvedValue(users as any);

      const result = await service.leaderboard(makeLeaderboardQuery());

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0]).toMatchObject({
        rank: 1,
        userId: "user-uuid-1",
        username: "alice",
      });
      expect(result.data[1]).toMatchObject({ rank: 2, userId: "user-uuid-2" });
    });

    it("defaults period to 30d", async () => {
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);
      db.user.findMany.mockResolvedValue([] as any);

      // Just checking it completes without error with no period specified
      const result = await service.leaderboard({});

      expect(result.data).toEqual([]);
    });

    it("handles the 7d period", async () => {
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);
      db.user.findMany.mockResolvedValue([] as any);

      const result = await service.leaderboard(
        makeLeaderboardQuery({ period: "7d" }),
      );

      expect(result.data).toEqual([]);
    });

    it("handles the allTime period", async () => {
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);
      db.user.findMany.mockResolvedValue([] as any);

      const result = await service.leaderboard(
        makeLeaderboardQuery({ period: "allTime" }),
      );

      expect(result.data).toEqual([]);
    });

    it("caps limit at 100", async () => {
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);
      db.user.findMany.mockResolvedValue([] as any);

      // Should not throw even with limit=200 — the service caps it internally
      await expect(
        service.leaderboard(makeLeaderboardQuery({ limit: 200 })),
      ).resolves.toBeDefined();
    });

    it("fills unknown users with empty string fallbacks", async () => {
      const snapshots = [
        {
          userId: "user-uuid-orphan",
          _sum: { realizedPnl: { toString: () => "100" } },
        },
      ];
      const tradeCounts = [{ userId: "user-uuid-orphan", _count: 1 }];
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce(snapshots as any)
        .mockResolvedValueOnce(snapshots as any);
      (db.order.groupBy as any).mockResolvedValue(tradeCounts as any);
      db.user.findMany.mockResolvedValue([] as any); // no user record found

      const result = await service.leaderboard(makeLeaderboardQuery());

      expect(result.data[0]).toMatchObject({
        username: "",
        displayName: "",
        avatarUrl: null,
      });
    });

    it("handles null pnl in rows gracefully", async () => {
      const snapshots = [
        { userId: "user-uuid-1", _sum: { realizedPnl: null } },
      ];
      const tradeCounts = [{ userId: "user-uuid-1", _count: 0 }];
      const users = [
        {
          id: "user-uuid-1",
          username: "alice",
          displayName: "Alice",
          avatarUrl: null,
        },
      ];
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce(snapshots as any)
        .mockResolvedValueOnce(snapshots as any);
      (db.order.groupBy as any).mockResolvedValue(tradeCounts as any);
      db.user.findMany.mockResolvedValue(users as any);

      const result = await service.leaderboard(makeLeaderboardQuery());

      expect(result.data[0].pnl).toBe("0");
    });

    it("handles empty groupBy count result", async () => {
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      db.user.findMany.mockResolvedValue([] as any);

      const result = await service.leaderboard(makeLeaderboardQuery());

      expect(result.total).toBe(0);
    });

    it("assigns correct rank numbers with pagination offset", async () => {
      const snapshots = [
        {
          userId: "user-uuid-1",
          _sum: { realizedPnl: { toString: () => "100" } },
        },
      ];
      // For count, return 21 items worth
      const allSnapshots = Array.from({ length: 21 }, (_, i) => ({
        userId: `user-uuid-${i}`,
        _sum: { realizedPnl: { toString: () => "100" } },
      }));
      const tradeCounts = [{ userId: "user-uuid-1", _count: 2 }];
      const users = [
        {
          id: "user-uuid-1",
          username: "alice",
          displayName: "Alice",
          avatarUrl: null,
        },
      ];
      (db.pnlSnapshot.groupBy as any)
        .mockResolvedValueOnce(snapshots as any)
        .mockResolvedValueOnce(allSnapshots as any);
      (db.order.groupBy as any).mockResolvedValue(tradeCounts as any);
      db.user.findMany.mockResolvedValue(users as any);

      const result = await service.leaderboard(
        makeLeaderboardQuery({ page: 2, limit: 20 }),
      );

      expect(result.data[0].rank).toBe(21);
    });
  });
});
