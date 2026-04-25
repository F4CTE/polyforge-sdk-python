import { describe, it, expect, beforeEach, vi } from "vitest";
import { SportsService } from "./sports.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";
import { ConfigService } from "@nestjs/config";

function makeRedis(): RedisService {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    getClient: vi.fn(),
    getJson: vi.fn().mockResolvedValue(null),
    setJson: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    onModuleDestroy: vi.fn(),
  } as unknown as RedisService;
}

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: vi.fn((key: string) => overrides[key] ?? undefined),
  } as unknown as ConfigService;
}

describe("SportsService", () => {
  let service: SportsService;
  let db: MockDb;
  let redis: RedisService;

  beforeEach(() => {
    db = createMockDb();
    redis = makeRedis();
    const config = makeConfig({
      ORDER_SERVICE_URL: "http://order-service:3007",
    });
    service = new SportsService(db as any, redis, config);
  });

  describe("getCategories", () => {
    it("returns categories from cache when available", async () => {
      const cached = [
        {
          category: "NFL",
          label: "NFL Football",
          seriesTickers: ["NFL", "NFLSZN"],
          marketCount: 42,
        },
      ];
      (redis.get as any).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getCategories();
      expect(result).toEqual(cached);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("queries DB and caches when no cache hit", async () => {
      (db.$queryRaw as any).mockResolvedValueOnce([
        { category: "NFL", count: BigInt(25) },
        { category: "NBA", count: BigInt(15) },
      ]);

      const result = await service.getCategories();

      const nfl = result.find((c) => c.category === "NFL");
      expect(nfl).toBeDefined();
      expect(nfl!.marketCount).toBe(25);
      expect(redis.set).toHaveBeenCalledWith(
        "cache:sports:categories",
        expect.any(String),
        300,
      );
    });

    it("includes categories with 0 markets except OTHER", async () => {
      (db.$queryRaw as any).mockResolvedValueOnce([]);

      const result = await service.getCategories();
      const other = result.find((c) => c.category === "OTHER");
      expect(other).toBeUndefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("listMarkets", () => {
    it("returns paginated sports markets", async () => {
      const mockRows = [
        {
          id: "KALSHI-NFL-1",
          title: "Chiefs vs Bills: Over 45.5",
          category: "NFL",
          volume24h: "50000",
          tokens: [],
        },
      ];
      (db.$queryRaw as any)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await service.listMarkets({
        page: 1,
        limit: 20,
        category: "NFL",
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it("filters by search term", async () => {
      (db.$queryRaw as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.listMarkets({
        page: 1,
        limit: 20,
        search: "Chiefs",
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("filters live-only markets", async () => {
      (db.$queryRaw as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.listMarkets({
        page: 1,
        limit: 20,
        liveOnly: true,
      });

      expect(result.data).toHaveLength(0);
    });

    it("sorts by closing_soon", async () => {
      (db.$queryRaw as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.listMarkets({
        page: 1,
        limit: 20,
        sort: "closing_soon",
      });

      expect(result.data).toHaveLength(0);
    });
  });

  describe("listEvents", () => {
    it("returns paginated events", async () => {
      const mockRows = [
        {
          eventTicker: "NFL-WK1-CHIEFS-BILLS",
          title: "Chiefs vs Bills Week 1",
          marketCount: 8,
        },
      ];
      (db.$queryRaw as any)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await service.listEvents({
        page: 1,
        limit: 20,
        category: "NFL",
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("filters by seriesTicker", async () => {
      (db.$queryRaw as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.listEvents({
        page: 1,
        limit: 20,
        seriesTicker: "NBA",
      });

      expect(result.data).toHaveLength(0);
    });
  });

  describe("getEventDetail", () => {
    it("returns event with markets from cache", async () => {
      const cached = {
        event: { id: "EVT-1", title: "Test Event" },
        markets: [{ id: "MKT-1" }],
      };
      (redis.get as any).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getEventDetail("EVT-1");
      expect(result).toEqual(cached);
    });

    it("returns event with markets from DB when no cache", async () => {
      const event = {
        id: "EVT-1",
        title: "Chiefs vs Bills",
        slug: "chiefs-bills",
      };
      (db.event.findUnique as any).mockResolvedValueOnce(event);
      (db.market.findMany as any).mockResolvedValueOnce([
        { id: "MKT-1", title: "Over 45.5", tokens: [] },
      ]);

      const result = await service.getEventDetail("EVT-1");
      expect(result.event).toEqual(event);
      expect(result.markets).toHaveLength(1);
      expect(redis.set).toHaveBeenCalled();
    });

    it("returns unknown event when not found", async () => {
      (db.event.findUnique as any).mockResolvedValueOnce(null);

      const result = await service.getEventDetail("NONEXISTENT");
      expect(result.event).toEqual({
        id: "NONEXISTENT",
        title: "Unknown Event",
      });
      expect(result.markets).toHaveLength(0);
    });
  });

  describe("getMilestones", () => {
    it("returns milestones from cache", async () => {
      const cached = { milestones: [{ id: "ms-1" }], cursor: null };
      (redis.get as any).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getMilestones({ page: 1, limit: 20 });
      expect(result).toEqual(cached);
    });

    it("returns empty on proxy failure", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));

      const result = await service.getMilestones({ page: 1, limit: 20 });
      expect(result).toEqual({ milestones: [], cursor: null });

      globalThis.fetch = originalFetch;
    });
  });

  describe("getLiveData", () => {
    it("returns live data from cache", async () => {
      const cached = { liveData: { score: 21 } };
      (redis.get as any).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getLiveData("ms-1");
      expect(result).toEqual(cached);
    });

    it("returns null on proxy failure", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));

      const result = await service.getLiveData("ms-1");
      expect(result).toEqual({ liveData: null });

      globalThis.fetch = originalFetch;
    });
  });

  describe("listComboCollections", () => {
    it("returns combo collections from cache", async () => {
      const cached = { collections: [{ ticker: "combo-1" }], cursor: null };
      (redis.get as any).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.listComboCollections({
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(cached);
    });
  });

  describe("lookupComboTicker", () => {
    it("returns null on proxy failure", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));

      const result = await service.lookupComboTicker("COL-1", [
        { marketTicker: "MKT-1", eventTicker: "EVT-1", side: "yes" },
      ]);
      expect(result).toBeNull();

      globalThis.fetch = originalFetch;
    });
  });
});
