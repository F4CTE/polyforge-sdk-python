import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WatchlistService } from "./watchlist.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeWatchlistItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "wl-1",
    userId: "user-1",
    marketId: "market-1",
    createdAt: new Date("2025-06-01"),
    market: {
      id: "market-1",
      title: "Will ETH reach $5000?",
      category: "crypto",
      image: "https://example.com/eth.png",
      closed: false,
      volume24h: "100000.00",
      tokens: [
        { id: "token-1", outcome: "YES", price: "0.65" },
        { id: "token-2", outcome: "NO", price: "0.35" },
      ],
    },
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("WatchlistService", () => {
  let service: WatchlistService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new WatchlistService(db as any);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns mapped markets with watchlistId and addedAt", async () => {
      const items = [makeWatchlistItem()];
      db.watchlistItem.findMany.mockResolvedValue(items as any);

      const result = await service.list("user-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "market-1",
        title: "Will ETH reach $5000?",
        watchlistId: "wl-1",
      });
      expect(result[0].addedAt).toEqual(new Date("2025-06-01"));
    });

    it("returns an empty array when user has no watchlist items", async () => {
      db.watchlistItem.findMany.mockResolvedValue([]);

      const result = await service.list("user-1");

      expect(result).toEqual([]);
    });

    it("queries with correct userId and ordering", async () => {
      db.watchlistItem.findMany.mockResolvedValue([]);

      await service.list("user-1");

      expect(db.watchlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  // ── add ───────────────────────────────────────────────────────────────────

  describe("add", () => {
    it("upserts a watchlist item for the user and market", async () => {
      const item = {
        id: "wl-1",
        userId: "user-1",
        marketId: "market-1",
        createdAt: new Date(),
      };
      db.watchlistItem.upsert.mockResolvedValue(item as any);

      const result = await service.add("user-1", "market-1");

      expect(result).toEqual(item);
      expect(db.watchlistItem.upsert).toHaveBeenCalledWith({
        where: { userId_marketId: { userId: "user-1", marketId: "market-1" } },
        create: { userId: "user-1", marketId: "market-1" },
        update: {},
      });
    });

    it("throws MAX_WATCHLIST_ITEMS when the user has reached the item cap", async () => {
      db.watchlistItem.findUnique.mockResolvedValue(null);
      db.watchlistItem.count.mockResolvedValue(500);

      await expect(service.add("user-1", "market-1")).rejects.toMatchObject({
        response: {
          code: "MAX_WATCHLIST_ITEMS",
        },
      });
      expect(db.watchlistItem.upsert).not.toHaveBeenCalled();
    });

    it("throws NotFoundException with MARKET_NOT_FOUND when P2003 error occurs", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "5.0.0" },
      );
      db.watchlistItem.upsert.mockRejectedValue(prismaError);

      await expect(service.add("user-1", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.add("user-1", "nonexistent")).rejects.toMatchObject({
        response: expect.objectContaining({ code: "MARKET_NOT_FOUND" }),
      });
    });

    it("re-throws non-P2003 Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0" },
      );
      db.watchlistItem.upsert.mockRejectedValue(prismaError);

      await expect(service.add("user-1", "market-1")).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
      await expect(service.add("user-1", "market-1")).rejects.not.toThrow(
        NotFoundException,
      );
    });

    it("re-throws non-Prisma errors", async () => {
      db.watchlistItem.upsert.mockRejectedValue(
        new Error("DB connection lost"),
      );

      await expect(service.add("user-1", "market-1")).rejects.toThrow(
        "DB connection lost",
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes matching watchlist items for user and market", async () => {
      db.watchlistItem.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.remove("user-1", "market-1");

      expect(db.watchlistItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", marketId: "market-1" },
      });
    });

    it("does not throw when no items match", async () => {
      db.watchlistItem.deleteMany.mockResolvedValue({ count: 0 } as any);

      await expect(
        service.remove("user-1", "nonexistent"),
      ).resolves.toBeUndefined();
    });
  });

  // ── isWatched ─────────────────────────────────────────────────────────────

  describe("isWatched", () => {
    it("returns true when the item exists", async () => {
      db.watchlistItem.findUnique.mockResolvedValue({ id: "wl-1" } as any);

      const result = await service.isWatched("user-1", "market-1");

      expect(result).toBe(true);
    });

    it("returns false when the item does not exist", async () => {
      db.watchlistItem.findUnique.mockResolvedValue(null);

      const result = await service.isWatched("user-1", "market-1");

      expect(result).toBe(false);
    });

    it("queries with the correct compound key", async () => {
      db.watchlistItem.findUnique.mockResolvedValue(null);

      await service.isWatched("user-1", "market-1");

      expect(db.watchlistItem.findUnique).toHaveBeenCalledWith({
        where: { userId_marketId: { userId: "user-1", marketId: "market-1" } },
      });
    });
  });
});
