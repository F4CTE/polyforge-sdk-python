import { describe, it, expect, vi, beforeEach } from "vitest";
import { VenueSelectBlock } from "./venue-select.block";
import type { EvalContext } from "./block.types";

function makeCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    strategyId: "strat-1",
    userId: "user-1",
    state: {
      betsToday: 0,
      dailyPnl: 0,
      consecutiveLoss: 0,
      consecutiveWin: 0,
      lastTradeAt: 0,
      tradedTokensToday: [],
      totalOrders: 0,
    },
    now: Date.now(),
    ...overrides,
  };
}

function makePrisma() {
  return {
    token: {
      findUnique: vi.fn().mockResolvedValue({
        id: "tok-1",
        price: "0.50",
        market: { category: "politics" },
      }),
    },
    venueFeeSchedule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("VenueSelectBlock", () => {
  let prisma: ReturnType<typeof makePrisma>;
  const redis = {} as any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it("sets venue to polymarket when preference is polymarket", async () => {
    const ctx = makeCtx();
    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "polymarket" } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("polymarket");
  });

  it("sets venue to kalshi when preference is kalshi", async () => {
    const ctx = makeCtx();
    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "kalshi" } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("kalshi");
  });

  it("sets venue to best when preference is best", async () => {
    const ctx = makeCtx();
    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "best" } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("best");
  });

  it("defaults to best when no preference provided", async () => {
    const ctx = makeCtx();
    const result = await VenueSelectBlock.evaluate(
      { params: {} },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("best");
  });

  it("picks kalshi when minimize_fees and kalshi fee is lower", async () => {
    const ctx = makeCtx();
    prisma.venueFeeSchedule.findMany
      .mockResolvedValueOnce([
        { feeBps: 200, category: null, minPrice: null, maxPrice: null },
      ])
      .mockResolvedValueOnce([
        {
          feeBps: 70,
          category: null,
          minPrice: { toNumber: () => 0.25 },
          maxPrice: { toNumber: () => 0.75 },
        },
      ]);

    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "minimize_fees", tokenId: "tok-1", price: 0.5 } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("kalshi");
    expect(result.metadata?.kalshiFee).toBe(70);
    expect(result.metadata?.polyFee).toBe(200);
  });

  it("picks polymarket when minimize_fees and polymarket fee is lower", async () => {
    const ctx = makeCtx();
    prisma.venueFeeSchedule.findMany
      .mockResolvedValueOnce([
        { feeBps: 100, category: "politics", minPrice: null, maxPrice: null },
      ])
      .mockResolvedValueOnce([
        {
          feeBps: 300,
          category: null,
          minPrice: { toNumber: () => 0.25 },
          maxPrice: { toNumber: () => 0.75 },
        },
      ]);

    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "minimize_fees", tokenId: "tok-1", price: 0.5 } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("polymarket");
  });

  it("falls back to best when minimize_fees but no tokenId", async () => {
    const ctx = makeCtx();
    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "minimize_fees" } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("best");
    expect(result.reason).toContain("no tokenId");
  });

  it("falls back to best when minimize_fees but token not found", async () => {
    const ctx = makeCtx();
    prisma.token.findUnique.mockResolvedValue(null);

    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "minimize_fees", tokenId: "nonexistent" } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(true);
    expect(ctx.venue).toBe("best");
  });

  it("returns fired:false for unknown preference", async () => {
    const ctx = makeCtx();
    const result = await VenueSelectBlock.evaluate(
      { params: { preference: "invalid" } },
      ctx,
      redis,
      prisma as any,
    );

    expect(result.fired).toBe(false);
  });
});
