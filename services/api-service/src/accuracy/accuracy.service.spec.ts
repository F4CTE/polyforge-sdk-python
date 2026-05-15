import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccuracyService } from "./accuracy.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makePosition(overrides: Record<string, unknown> = {}) {
  return {
    id: "pos-1",
    userId: "user-1",
    marketId: "market-1",
    tokenId: "token-1",
    side: "BUY",
    avgPrice: "0.70",
    size: "100",
    realizedPnl: "10.00",
    resolutionStatus: "RESOLVED",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "market-1",
    category: "crypto",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("AccuracyService", () => {
  let service: AccuracyService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new AccuracyService(db as any);
  });

  it("returns defaults when user has no resolved positions", async () => {
    db.position.findMany.mockResolvedValue([]);

    const result = await service.getMyAccuracy("user-1");

    expect(result).toEqual({
      brierScore: null,
      totalPredictions: 0,
      correctPredictions: 0,
      winRate: "0",
      calibration: [],
      byCategory: {},
    });
  });

  it("counts a single winning position correctly", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ realizedPnl: "5.00", avgPrice: "0.70" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.totalPredictions).toBe(1);
    expect(result.correctPredictions).toBe(1);
    expect(result.winRate).toBe("100.0");
    expect(result.brierScore).toBeTypeOf("number");
  });

  it("counts a single losing position correctly", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ realizedPnl: "-5.00", avgPrice: "0.70" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.totalPredictions).toBe(1);
    expect(result.correctPredictions).toBe(0);
    expect(result.winRate).toBe("0.0");
  });

  it("groups positions by category from market data", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", marketId: "m1", realizedPnl: "5.00" }),
      makePosition({ id: "p2", marketId: "m2", realizedPnl: "-2.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([
      makeMarket({ id: "m1", category: "crypto" }),
      makeMarket({ id: "m2", category: "politics" }),
    ] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.byCategory).toHaveProperty("crypto");
    expect(result.byCategory).toHaveProperty("politics");
    expect(result.byCategory.crypto.count).toBe(1);
    expect(result.byCategory.crypto.correctPredictions).toBe(1);
    expect(result.byCategory.politics.count).toBe(1);
    expect(result.byCategory.politics.correctPredictions).toBe(0);
  });

  it("uses 'Other' category when market has null category", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ marketId: "m-no-cat", realizedPnl: "1.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([
      makeMarket({ id: "m-no-cat", category: null }),
    ] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.byCategory).toHaveProperty("Other");
  });

  it("computes Brier score for a perfect prediction (won at p=0.99)", async () => {
    // avgPrice=0.99, won => brier = (0.99 - 1)^2 = 0.0001
    db.position.findMany.mockResolvedValue([
      makePosition({ avgPrice: "0.99", realizedPnl: "10.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.brierScore).toBeCloseTo(0.0001, 4);
  });

  it("computes Brier score for a bad prediction (lost at p=0.99)", async () => {
    // avgPrice=0.99 clamped to 0.99, lost => brier = (0.99 - 0)^2 = 0.9801
    db.position.findMany.mockResolvedValue([
      makePosition({ avgPrice: "0.99", realizedPnl: "-10.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.brierScore).toBeCloseTo(0.9801, 4);
  });

  it("populates calibration buckets sorted by expectedRate", async () => {
    // Two positions: one at avgPrice=0.25 (bucket 20-30%), one at avgPrice=0.75 (bucket 70-80%)
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", avgPrice: "0.25", realizedPnl: "1.00" }),
      makePosition({ id: "p2", avgPrice: "0.75", realizedPnl: "-1.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    expect(result.calibration.length).toBe(2);
    // Should be sorted by expectedRate ascending
    expect(result.calibration[0].expectedRate).toBeLessThan(
      result.calibration[1].expectedRate,
    );
    expect(result.calibration[0].bucket).toBe("20-30%");
    expect(result.calibration[1].bucket).toBe("70-80%");
  });

  it("clamps avgPrice to [0.01, 0.99]", async () => {
    // avgPrice=0 should be clamped to 0.01, avgPrice=1 should be clamped to 0.99
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", avgPrice: "0", realizedPnl: "-1.00" }),
      makePosition({ id: "p2", avgPrice: "1.5", realizedPnl: "1.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    // Should not throw and should produce valid results
    expect(result.brierScore).toBeTypeOf("number");
    expect(result.totalPredictions).toBe(2);
  });

  it("defaults avgPrice to 0.5 when null", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ avgPrice: null, realizedPnl: "1.00" }),
    ] as any);
    db.market.findMany.mockResolvedValue([makeMarket()] as any);

    const result = await service.getMyAccuracy("user-1");

    // p=0.5, won => brier = (0.5-1)^2 = 0.25
    expect(result.brierScore).toBeCloseTo(0.25, 4);
  });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

describe("AccuracyService.getLeaderboard", () => {
  let service: AccuracyService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new AccuracyService(db as any);
  });

  it("returns empty paginated response when no resolved positions exist", async () => {
    db.position.findMany.mockResolvedValue([] as any);

    const result = await service.getLeaderboard({ period: "30d" });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(0);
    expect(result.hasNext).toBe(false);
  });

  it("ranks users by win-rate descending", async () => {
    // user-1: 2 positions, both won (100%)
    // user-2: 2 positions, 1 won (50%)
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", userId: "user-1", realizedPnl: "10.00" }),
      makePosition({ id: "p2", userId: "user-1", realizedPnl: "5.00" }),
      makePosition({ id: "p3", userId: "user-2", realizedPnl: "8.00" }),
      makePosition({ id: "p4", userId: "user-2", realizedPnl: "-2.00" }),
    ] as any);
    db.user.findMany.mockResolvedValue([
      { id: "user-1", username: "alice", displayName: "Alice", avatarUrl: null },
      { id: "user-2", username: "bob", displayName: null, avatarUrl: "/bob.png" },
    ] as any);

    const result = await service.getLeaderboard({ period: "30d" });

    expect(result.data.length).toBe(2);
    expect(result.data[0].userId).toBe("user-1");
    expect(result.data[0].winRate).toBe("100.0");
    expect(result.data[0].rank).toBe(1);
    expect(result.data[0].username).toBe("alice");
    expect(result.data[0].displayName).toBe("Alice");
    expect(result.data[1].userId).toBe("user-2");
    expect(result.data[1].winRate).toBe("50.0");
    expect(result.data[1].rank).toBe(2);
    expect(result.data[1].avatarUrl).toBe("/bob.png");
  });

  it("includes pnl and tradeCount in each entry", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", userId: "user-1", realizedPnl: "15.5" }),
      makePosition({ id: "p2", userId: "user-1", realizedPnl: "-3.2" }),
      makePosition({ id: "p3", userId: "user-1", realizedPnl: "7.0" }),
    ] as any);
    db.user.findMany.mockResolvedValue([
      { id: "user-1", username: "trader", displayName: null, avatarUrl: null },
    ] as any);

    const result = await service.getLeaderboard({ period: "allTime" });

    expect(result.data[0].pnl).toBe("19.3");
    expect(result.data[0].tradeCount).toBe(3);
    expect(result.data[0].winRate).toBe("66.7"); // 2 wins out of 3
  });

  it("respects page and limit pagination", async () => {
    const positions = Array.from({ length: 25 }, (_, i) =>
      makePosition({ id: `p${i}`, userId: `user-${i}`, realizedPnl: "10.00" }),
    );
    db.position.findMany.mockResolvedValue(positions as any);
    db.user.findMany.mockResolvedValue(
      positions.map((p) => ({
        id: p.userId,
        username: `user${p.userId}`,
        displayName: null,
        avatarUrl: null,
      })) as any,
    );

    const result = await service.getLeaderboard({ period: "7d", page: 2, limit: 10 });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.data.length).toBe(10);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.hasNext).toBe(true);
    expect(result.data[0].rank).toBe(11);
  });

  it("defaults to page=1 limit=20", async () => {
    db.position.findMany.mockResolvedValue([] as any);

    const result = await service.getLeaderboard({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("caps limit at 100", async () => {
    db.position.findMany.mockResolvedValue([] as any);

    const result = await service.getLeaderboard({ limit: 200 });

    expect(result.limit).toBe(100);
  });

  it("falls back to empty username when user profile is missing", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", userId: "ghost", realizedPnl: "1.00" }),
    ] as any);
    db.user.findMany.mockResolvedValue([] as any);

    const result = await service.getLeaderboard({ period: "30d" });

    expect(result.data[0].username).toBe("");
    expect(result.data[0].displayName).toBeNull();
    expect(result.data[0].avatarUrl).toBeNull();
  });

  it("clamps winRate to 0 when user has no resolved positions after filtering", async () => {
    db.position.findMany.mockResolvedValue([
      makePosition({ id: "p1", userId: "u1", realizedPnl: "0.00" }),
    ] as any);
    db.user.findMany.mockResolvedValue([
      { id: "u1", username: "zero", displayName: null, avatarUrl: null },
    ] as any);

    const result = await service.getLeaderboard({ period: "allTime" });

    expect(result.data[0].winRate).toBe("0.0"); // 0 wins, 0 total handled by total>0 guard
  });
});
