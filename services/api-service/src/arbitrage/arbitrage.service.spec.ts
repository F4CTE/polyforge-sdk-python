import { describe, it, expect, beforeEach, vi } from "vitest";
import { ArbitrageService } from "./arbitrage.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "market-1",
    title: "Will X happen?",
    category: "crypto",
    endDate: new Date("2026-06-01"),
    tokens: [
      { id: "yes-1", outcome: "YES", price: "0.40" },
      { id: "no-1", outcome: "NO", price: "0.50" },
    ],
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("ArbitrageService", () => {
  let service: ArbitrageService;
  let db: MockDb;
  let redis: RedisService;
  let mgetFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    mgetFn = vi.fn().mockResolvedValue([]);
    redis = {
      getClient: vi.fn().mockReturnValue({ mget: mgetFn }),
    } as unknown as RedisService;
    service = new ArbitrageService(db as any, redis);
  });

  it("returns [] when there are no open markets", async () => {
    db.market.findMany.mockResolvedValue([]);

    const result = await service.getOpportunities();

    expect(result).toEqual([]);
  });

  it("filters out non-binary markets (not exactly YES + NO)", async () => {
    const singleToken = makeMarket({
      tokens: [{ id: "t1", outcome: "YES", price: "0.40" }],
    });
    db.market.findMany.mockResolvedValue([singleToken] as any);

    const result = await service.getOpportunities();

    expect(result).toEqual([]);
  });

  it("filters out markets with 3 tokens", async () => {
    const triToken = makeMarket({
      tokens: [
        { id: "t1", outcome: "YES", price: "0.30" },
        { id: "t2", outcome: "NO", price: "0.30" },
        { id: "t3", outcome: "MAYBE", price: "0.30" },
      ],
    });
    db.market.findMany.mockResolvedValue([triToken] as any);

    const result = await service.getOpportunities();

    expect(result).toEqual([]);
  });

  it("returns valid arbitrage opportunity when margin > default minMargin", async () => {
    // sum = 0.40 + 0.50 = 0.90, marginPct = 10%
    const market = makeMarket();
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities();

    expect(result).toHaveLength(1);
    expect(result[0].marketId).toBe("market-1");
    expect(parseFloat(result[0].marginPct)).toBeCloseTo(10, 1);
    expect(parseFloat(result[0].costPerUnit)).toBeCloseTo(0.9, 2);
    expect(parseFloat(result[0].profitPerUnit)).toBeCloseTo(0.1, 2);
  });

  it("excludes markets where margin < minMargin", async () => {
    // sum = 0.50 + 0.50 = 1.00, marginPct = 0%
    const market = makeMarket({
      tokens: [
        { id: "yes-1", outcome: "YES", price: "0.50" },
        { id: "no-1", outcome: "NO", price: "0.50" },
      ],
    });
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities();

    expect(result).toEqual([]);
  });

  it("sorts opportunities by marginPct descending", async () => {
    // market A: sum=0.90 margin=10%, market B: sum=0.80 margin=20%
    const marketA = makeMarket({
      id: "mA",
      tokens: [
        { id: "yA", outcome: "YES", price: "0.45" },
        { id: "nA", outcome: "NO", price: "0.45" },
      ],
    });
    const marketB = makeMarket({
      id: "mB",
      tokens: [
        { id: "yB", outcome: "YES", price: "0.40" },
        { id: "nB", outcome: "NO", price: "0.40" },
      ],
    });
    db.market.findMany.mockResolvedValue([marketA, marketB] as any);
    mgetFn.mockResolvedValue([null, null, null, null]);

    const result = await service.getOpportunities();

    expect(result).toHaveLength(2);
    expect(parseFloat(result[0].marginPct)).toBeGreaterThan(
      parseFloat(result[1].marginPct),
    );
    expect(result[0].marketId).toBe("mB");
  });

  it("uses Redis cache prices over DB prices", async () => {
    const market = makeMarket();
    db.market.findMany.mockResolvedValue([market] as any);
    // Redis returns cached prices: YES=0.30, NO=0.30 => sum=0.60, margin=40%
    mgetFn.mockResolvedValue([
      JSON.stringify({ price: "0.30" }),
      JSON.stringify({ price: "0.30" }),
    ]);

    const result = await service.getOpportunities();

    expect(result).toHaveLength(1);
    expect(result[0].yesPrice).toBe("0.300000");
    expect(result[0].noPrice).toBe("0.300000");
    expect(parseFloat(result[0].marginPct)).toBeCloseTo(40, 1);
  });

  it("falls back to DB price when Redis parse fails", async () => {
    const market = makeMarket();
    db.market.findMany.mockResolvedValue([market] as any);
    // invalid JSON for YES, null for NO
    mgetFn.mockResolvedValue(["not-valid-json", null]);

    const result = await service.getOpportunities();

    expect(result).toHaveLength(1);
    // Should use DB prices: 0.40 and 0.50
    expect(result[0].yesPrice).toBe("0.400000");
    expect(result[0].noPrice).toBe("0.500000");
  });

  it("filters out markets with NaN prices", async () => {
    const market = makeMarket({
      tokens: [
        { id: "yes-1", outcome: "YES", price: "not-a-number" },
        { id: "no-1", outcome: "NO", price: "0.50" },
      ],
    });
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities();

    expect(result).toEqual([]);
  });

  it("filters out markets with zero prices", async () => {
    const market = makeMarket({
      tokens: [
        { id: "yes-1", outcome: "YES", price: "0" },
        { id: "no-1", outcome: "NO", price: "0.50" },
      ],
    });
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities();

    expect(result).toEqual([]);
  });

  it("respects custom minMargin parameter", async () => {
    // sum = 0.90, marginPct = 10%. With minMargin=15, should be excluded
    const market = makeMarket();
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities(15);

    expect(result).toEqual([]);
  });

  it("includes opportunity with custom minMargin when margin is sufficient", async () => {
    // sum = 0.80, marginPct = 20%. With minMargin=15, should be included
    const market = makeMarket({
      tokens: [
        { id: "yes-1", outcome: "YES", price: "0.40" },
        { id: "no-1", outcome: "NO", price: "0.40" },
      ],
    });
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities(15);

    expect(result).toHaveLength(1);
  });

  it("sets category to empty string when market category is null", async () => {
    const market = makeMarket({ category: null });
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities();

    expect(result[0].category).toBe("");
  });

  it("sets endDate to null when market endDate is null", async () => {
    const market = makeMarket({ endDate: null });
    db.market.findMany.mockResolvedValue([market] as any);
    mgetFn.mockResolvedValue([null, null]);

    const result = await service.getOpportunities();

    expect(result[0].endDate).toBeNull();
  });
});
