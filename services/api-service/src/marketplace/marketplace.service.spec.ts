import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { MarketplaceService } from "./marketplace.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: "listing-1",
    strategyId: "strategy-1",
    sellerId: "seller-1",
    title: "My Strategy",
    description: "A great strategy",
    priceUsdc: 10,
    tags: ["crypto"],
    status: "ACTIVE",
    purchaseCount: 0,
    avgRating: 0,
    ratingCount: 0,
    createdAt: new Date("2025-06-01"),
    ...overrides,
  };
}

function makeStrategy(overrides: Record<string, unknown> = {}) {
  return {
    id: "strategy-1",
    userId: "seller-1",
    name: "My Strategy",
    description: "desc",
    ...overrides,
  };
}

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: "purchase-1",
    listingId: "listing-1",
    buyerId: "buyer-1",
    rating: null,
    review: null,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("MarketplaceService", () => {
  let service: MarketplaceService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new MarketplaceService(db as any);
  });

  // ── browse ────────────────────────────────────────────────────────────────

  describe("browse", () => {
    it("returns items, total, limit, and offset", async () => {
      const listings = [makeListing()];
      db.marketplaceListing.findMany.mockResolvedValue(listings as any);
      db.marketplaceListing.count.mockResolvedValue(1);

      const result = await service.browse({});

      expect(result.items).toEqual(listings);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it("sorts by createdAt desc by default (newest)", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({});

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("sorts by purchaseCount desc when sort=popular", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({ sort: "popular" });

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { purchaseCount: "desc" },
        }),
      );
    });

    it("sorts by avgRating desc when sort=rating", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({ sort: "rating" });

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { avgRating: "desc" },
        }),
      );
    });

    it("sorts by priceUsdc asc when sort=price_asc", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({ sort: "price_asc" });

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priceUsdc: "asc" },
        }),
      );
    });

    it("sorts by priceUsdc desc when sort=price_desc", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({ sort: "price_desc" });

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priceUsdc: "desc" },
        }),
      );
    });

    it("filters by tag when provided", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({ tag: "defi" });

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ACTIVE", tags: { has: "defi" } },
        }),
      );
    });

    it("does not filter by tag when not provided", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({});

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ACTIVE" },
        }),
      );
    });

    it("caps limit at 100", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.browse({ limit: 500 });

      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  // ── getListing ────────────────────────────────────────────────────────────

  describe("getListing", () => {
    it("returns listing with seller, strategy, and purchases", async () => {
      const listing = makeListing();
      db.marketplaceListing.findUnique.mockResolvedValue(listing as any);

      const result = await service.getListing("listing-1");

      expect(result).toEqual(listing);
    });

    it("throws NotFoundException when listing not found", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.getListing("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException for DELISTED listing", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(
        makeListing({ status: "DELISTED" }) as any,
      );

      await expect(service.getListing("listing-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws with NOT_FOUND code", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.getListing("nonexistent")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── createListing ─────────────────────────────────────────────────────────

  describe("createListing", () => {
    it("creates a listing successfully", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(null);
      db.marketplaceListing.count.mockResolvedValue(0);
      const created = makeListing({ status: "DRAFT" });
      db.marketplaceListing.create.mockResolvedValue(created as any);

      const result = await service.createListing("seller-1", {
        strategyId: "strategy-1",
        title: "My Strategy",
        priceUsdc: 10,
      });

      expect(result).toEqual(created);
      expect(db.marketplaceListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            strategyId: "strategy-1",
            sellerId: "seller-1",
            title: "My Strategy",
            priceUsdc: 10,
            status: "DRAFT",
          }),
        }),
      );
    });

    it("throws NotFoundException if strategy not found", async () => {
      db.strategy.findFirst.mockResolvedValue(null);

      await expect(
        service.createListing("seller-1", {
          strategyId: "nonexistent",
          title: "Test",
          priceUsdc: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws STRATEGY_NOT_FOUND code when strategy not found", async () => {
      db.strategy.findFirst.mockResolvedValue(null);

      await expect(
        service.createListing("seller-1", {
          strategyId: "nonexistent",
          title: "Test",
          priceUsdc: 5,
        }),
      ).rejects.toMatchObject({
        response: { code: "STRATEGY_NOT_FOUND" },
      });
    });

    it("throws UnprocessableEntityException if strategy already listed", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(makeListing() as any);

      await expect(
        service.createListing("seller-1", {
          strategyId: "strategy-1",
          title: "Test",
          priceUsdc: 5,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws ALREADY_LISTED code", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(makeListing() as any);

      await expect(
        service.createListing("seller-1", {
          strategyId: "strategy-1",
          title: "Test",
          priceUsdc: 5,
        }),
      ).rejects.toMatchObject({
        response: { code: "ALREADY_LISTED" },
      });
    });

    it("throws when marketplace listing limit reached", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(null);
      db.marketplaceListing.count.mockResolvedValue(100); // exceeds any limit

      await expect(
        service.createListing("seller-1", {
          strategyId: "strategy-1",
          title: "Test",
          priceUsdc: 5,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws INVALID_PRICE for negative price", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(null);
      db.marketplaceListing.count.mockResolvedValue(0);

      await expect(
        service.createListing("seller-1", {
          strategyId: "strategy-1",
          title: "Test",
          priceUsdc: -5,
        }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_PRICE" },
      });
    });

    it("allows price of 0", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(null);
      db.marketplaceListing.count.mockResolvedValue(0);
      db.marketplaceListing.create.mockResolvedValue(
        makeListing({ priceUsdc: 0 }) as any,
      );

      const result = await service.createListing("seller-1", {
        strategyId: "strategy-1",
        title: "Free Strategy",
        priceUsdc: 0,
      });

      expect(result.priceUsdc).toBe(0);
    });

    it("defaults tags to empty array when not provided", async () => {
      db.strategy.findFirst.mockResolvedValue(makeStrategy() as any);
      db.marketplaceListing.findUnique.mockResolvedValue(null);
      db.marketplaceListing.count.mockResolvedValue(0);
      db.marketplaceListing.create.mockResolvedValue(makeListing() as any);

      await service.createListing("seller-1", {
        strategyId: "strategy-1",
        title: "Test",
        priceUsdc: 5,
      });

      expect(db.marketplaceListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: [],
          }),
        }),
      );
    });
  });

  // ── updateListing ─────────────────────────────────────────────────────────

  describe("updateListing", () => {
    it("updates listing fields successfully", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(makeListing() as any);
      const updated = makeListing({ title: "Updated Title" });
      db.marketplaceListing.update.mockResolvedValue(updated as any);

      const result = await service.updateListing("seller-1", "listing-1", {
        title: "Updated Title",
      });

      expect(result.title).toBe("Updated Title");
    });

    it("throws NotFoundException if listing not found", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(
        service.updateListing("seller-1", "nonexistent", { title: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException if seller does not own listing", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(
        makeListing({ sellerId: "other-user" }) as any,
      );

      await expect(
        service.updateListing("seller-1", "listing-1", { title: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("only updates provided fields", async () => {
      db.marketplaceListing.findUnique.mockResolvedValue(makeListing() as any);
      db.marketplaceListing.update.mockResolvedValue(makeListing() as any);

      await service.updateListing("seller-1", "listing-1", {
        title: "New Title",
      });

      expect(db.marketplaceListing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { title: "New Title" },
      });
    });
  });

  // ── rateListing ───────────────────────────────────────────────────────────

  describe("rateListing", () => {
    it("rates a listing successfully", async () => {
      db.marketplacePurchase.findUnique.mockResolvedValue(
        makePurchase() as any,
      );
      db.marketplacePurchase.update.mockResolvedValue({} as any);
      db.marketplacePurchase.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 2 },
      } as any);
      db.marketplaceListing.update.mockResolvedValue({} as any);

      const result = await service.rateListing("buyer-1", "listing-1", {
        rating: 5,
        review: "Great!",
      });

      expect(result).toEqual({ rated: true });
    });

    it("throws UnprocessableEntityException for rating < 1", async () => {
      await expect(
        service.rateListing("buyer-1", "listing-1", { rating: 0 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws UnprocessableEntityException for rating > 5", async () => {
      await expect(
        service.rateListing("buyer-1", "listing-1", { rating: 6 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("throws INVALID_RATING code for invalid rating", async () => {
      await expect(
        service.rateListing("buyer-1", "listing-1", { rating: 0 }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_RATING" },
      });
    });

    it("throws ForbiddenException if user has not purchased", async () => {
      db.marketplacePurchase.findUnique.mockResolvedValue(null);

      await expect(
        service.rateListing("buyer-1", "listing-1", { rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NOT_PURCHASED code", async () => {
      db.marketplacePurchase.findUnique.mockResolvedValue(null);

      await expect(
        service.rateListing("buyer-1", "listing-1", { rating: 5 }),
      ).rejects.toMatchObject({
        response: { code: "NOT_PURCHASED" },
      });
    });

    it("updates aggregate rating on the listing after rating", async () => {
      db.marketplacePurchase.findUnique.mockResolvedValue(
        makePurchase() as any,
      );
      db.marketplacePurchase.update.mockResolvedValue({} as any);
      db.marketplacePurchase.aggregate.mockResolvedValue({
        _avg: { rating: 3.5 },
        _count: { rating: 4 },
      } as any);
      db.marketplaceListing.update.mockResolvedValue({} as any);

      await service.rateListing("buyer-1", "listing-1", { rating: 3 });

      expect(db.marketplaceListing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { avgRating: 3.5, ratingCount: 4 },
      });
    });
  });

  // ── myListings ────────────────────────────────────────────────────────────

  describe("myListings", () => {
    it("returns listings for the seller", async () => {
      const listings = [makeListing()];
      db.marketplaceListing.findMany.mockResolvedValue(listings as any);

      const result = await service.myListings("seller-1");

      expect(result).toEqual(listings);
      expect(db.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: "seller-1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("returns empty array when seller has no listings", async () => {
      db.marketplaceListing.findMany.mockResolvedValue([]);

      const result = await service.myListings("seller-1");

      expect(result).toEqual([]);
    });
  });
});
