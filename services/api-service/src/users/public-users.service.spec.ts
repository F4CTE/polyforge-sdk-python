import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { PublicUsersService } from "./public-users.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: "user-uuid-1", username: "alice", ...overrides };
}

describe("PublicUsersService", () => {
  let service: PublicUsersService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new PublicUsersService(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getPerformance ──────────────────────────────────────────────────────

  describe("getPerformance", () => {
    it("returns performance data for a valid user", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.pnlSnapshot.findMany.mockResolvedValue([
        { time: new Date("2026-04-01"), pnl: 10.5, realizedPnl: 5 },
        { time: new Date("2026-04-02"), pnl: -3.2, realizedPnl: 2 },
      ] as any);

      const result = await service.getPerformance("alice", "30d");

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        date: "2026-04-01",
        pnl: 10.5,
        cumPnl: 10.5,
      });
      expect(result.data[1]).toEqual({
        date: "2026-04-02",
        pnl: -3.2,
        cumPnl: 10.5 + -3.2,
      });
    });

    it("throws NotFoundException for unknown username", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getPerformance("ghost", "30d")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns empty data when no snapshots exist", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.pnlSnapshot.findMany.mockResolvedValue([]);

      const result = await service.getPerformance("alice", "7d");
      expect(result.data).toEqual([]);
    });

    it("defaults to 30 days when period is invalid", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.pnlSnapshot.findMany.mockResolvedValue([]);

      await service.getPerformance("alice", "invalid");

      const call = db.pnlSnapshot.findMany.mock.calls[0][0];
      const timeFilter = call?.where?.time as { gte: Date };
      const since = timeFilter.gte;
      const diffDays = Math.round(
        (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(30);
    });
  });

  // ── getStrategies ───────────────────────────────────────────────────────

  describe("getStrategies", () => {
    it("returns public strategies for a valid user", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.strategy.findMany.mockResolvedValue([
        {
          id: "strat-1",
          name: "Alpha",
          description: "Trend follower",
          forkCount: 3,
          likeCount: 10,
          _count: { orders: 42 },
        },
      ] as any);

      const result = await service.getStrategies("alice", "PUBLIC", 6);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "strat-1",
        name: "Alpha",
        tradeCount: 42,
        forkCount: 3,
        likeCount: 10,
      });
    });

    it("throws NotFoundException for unknown username", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getStrategies("ghost", "PUBLIC", 6)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("respects the limit parameter", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.strategy.findMany.mockResolvedValue([]);

      await service.getStrategies("alice", "PUBLIC", 3);

      const call = db.strategy.findMany.mock.calls[0][0];
      expect(call?.take).toBe(3);
    });

    it("caps limit at 50", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.strategy.findMany.mockResolvedValue([]);

      await service.getStrategies("alice", "PUBLIC", 100);

      const call = db.strategy.findMany.mock.calls[0][0];
      expect(call?.take).toBe(50);
    });

    it("returns empty array when user has no public strategies", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.strategy.findMany.mockResolvedValue([]);

      const result = await service.getStrategies("alice", "PUBLIC", 6);
      expect(result.data).toEqual([]);
    });
  });

  // ── getActivity ───────────────────────────���─────────────────────────────

  describe("getActivity", () => {
    it("returns resolved positions as activity items", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findMany.mockResolvedValue([
        {
          id: "pos-1",
          marketId: "market-1",
          outcome: "YES",
          size: 100,
          realizedPnl: 25.5,
          resolutionOutcome: "WON",
          updatedAt: new Date("2026-04-20T12:00:00Z"),
        },
      ] as any);
      db.market.findMany.mockResolvedValue([
        { id: "market-1", title: "Will BTC reach 100k?" },
      ] as any);

      const result = await service.getActivity("alice", 5);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "pos-1",
        marketQuestion: "Will BTC reach 100k?",
        outcome: "YES",
        side: "WON",
        size: 100,
        pnl: 25.5,
      });
    });

    it("throws NotFoundException for unknown username", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getActivity("ghost", 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("uses market ID as fallback when market question not found", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findMany.mockResolvedValue([
        {
          id: "pos-2",
          marketId: "unknown-market",
          outcome: "NO",
          size: 50,
          realizedPnl: -10,
          resolutionOutcome: "LOST",
          updatedAt: new Date("2026-04-19T12:00:00Z"),
        },
      ] as any);
      db.market.findMany.mockResolvedValue([]);

      const result = await service.getActivity("alice", 5);

      expect(result.data[0].marketQuestion).toBe("unknown-market");
    });

    it("returns empty data when no resolved positions", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findMany.mockResolvedValue([]);

      const result = await service.getActivity("alice", 5);
      expect(result.data).toEqual([]);
    });

    it("does not query markets when no positions exist", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.position.findMany.mockResolvedValue([]);

      await service.getActivity("alice", 5);

      expect(db.market.findMany).not.toHaveBeenCalled();
    });
  });

  // ── getBadges ────────────────────────────────────���──────────────────────

  describe("getBadges", () => {
    it("returns badges mapped to frontend format", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.traderBadge.findMany.mockResolvedValue([
        { type: "WHALE_HUNTER", earnedAt: new Date("2026-03-15T00:00:00Z") },
        { type: "TOP_10", earnedAt: new Date("2026-04-01T00:00:00Z") },
      ] as any);

      const result = await service.getBadges("alice");

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: "WHALE_HUNTER",
        unlockedAt: "2026-03-15T00:00:00.000Z",
      });
      expect(result.data[1]).toEqual({
        id: "TOP_10",
        unlockedAt: "2026-04-01T00:00:00.000Z",
      });
    });

    it("throws NotFoundException for unknown username", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getBadges("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns empty data when user has no badges", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.traderBadge.findMany.mockResolvedValue([]);

      const result = await service.getBadges("alice");
      expect(result.data).toEqual([]);
    });
  });
});
