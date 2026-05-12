import { describe, it, expect, vi } from "vitest";
import {
  MinLiquidityBlock,
  MaxPositionBlock,
  MaxBetsPerDayBlock,
  DailyLossLimitBlock,
  CooldownAfterTradeBlock,
  PriceInRangeBlock,
  NoReentryBlock,
  NoExistingPositionBlock,
  TimeWindowBlock,
} from "./condition.blocks";
import { block, makeCtx, makePrisma, makeRedis } from "./__helpers__";

describe("MinLiquidityBlock", () => {
  it("passes when bid liquidity meets minimum", async () => {
    const book = {
      bids: [
        { price: "0.5", size: "200" }, // 100 USDC
        { price: "0.4", size: "100" }, // 40 USDC
      ],
    };
    const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
    const res = await MinLiquidityBlock.evaluate(
      block("min_liquidity", { tokenId: "tok1", minUsdc: "100" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true); // 140 >= 100
  });

  it("fails when bid liquidity is below minimum", async () => {
    const book = { bids: [{ price: "0.5", size: "10" }] }; // 5 USDC
    const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
    const res = await MinLiquidityBlock.evaluate(
      block("min_liquidity", { tokenId: "tok1", minUsdc: "100" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fails when no book data", async () => {
    const res = await MinLiquidityBlock.evaluate(
      block("min_liquidity", { tokenId: "tok1", minUsdc: "100" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/no book data/);
  });

  it("defaults minUsdc to 100 when not provided", async () => {
    const book = { bids: [{ price: "0.5", size: "250" }] }; // 125 USDC
    const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
    const res = await MinLiquidityBlock.evaluate(
      block("min_liquidity", { tokenId: "tok1" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails closed when bid liquidity data is not finite decimal", async () => {
    const book = { bids: [{ price: "0.5", size: "10abc" }] };
    const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
    const res = await MinLiquidityBlock.evaluate(
      block("min_liquidity", { tokenId: "tok1", minUsdc: "1" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid bid size/);
  });

  it("fails closed when minimum liquidity is not finite decimal", async () => {
    const book = { bids: [{ price: "0.5", size: "250" }] };
    const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
    const res = await MinLiquidityBlock.evaluate(
      block("min_liquidity", { tokenId: "tok1", minUsdc: "Infinity" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid minUsdc/);
  });
});

describe("MaxPositionBlock", () => {
  it("passes when no existing position", async () => {
    const prisma = makePrisma(); // findUnique returns null
    const res = await MaxPositionBlock.evaluate(
      block("max_position", { tokenId: "tok1", maxUsdc: "500" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(true);
    expect(res.reason).toMatch(/no existing position/);
  });

  it("passes when position value is below max", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "100",
      currentPrice: "0.3",
    }); // 30 USDC
    const res = await MaxPositionBlock.evaluate(
      block("max_position", { tokenId: "tok1", maxUsdc: "100" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(true); // 30 < 100
  });

  it("fails when position value meets or exceeds max", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "200",
      currentPrice: "0.6",
    }); // 120 USDC
    const res = await MaxPositionBlock.evaluate(
      block("max_position", { tokenId: "tok1", maxUsdc: "100" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(false); // 120 >= 100
  });

  it("queries by userId + tokenId composite key", async () => {
    const prisma = makePrisma();
    const ctx = makeCtx();
    await MaxPositionBlock.evaluate(
      block("max_position", { tokenId: "tok-abc", maxUsdc: "500" }),
      ctx,
      makeRedis(),
      prisma,
    );
    expect(prisma.position.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_tokenId: { userId: ctx.userId, tokenId: "tok-abc" } },
      }),
    );
  });

  it("fails closed when max position is not finite decimal", async () => {
    const res = await MaxPositionBlock.evaluate(
      block("max_position", { tokenId: "tok1", maxUsdc: "NaN" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid maxUsdc/);
  });

  it("fails closed when position valuation data is not finite decimal", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "100",
      currentPrice: "0.3abc",
    });
    const res = await MaxPositionBlock.evaluate(
      block("max_position", { tokenId: "tok1", maxUsdc: "100" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid position currentPrice/);
  });
});

describe("MaxBetsPerDayBlock", () => {
  it("passes when betsToday is below max", async () => {
    const ctx = makeCtx({ betsToday: 4 });
    const res = await MaxBetsPerDayBlock.evaluate(
      block("max_bets_per_day", { max: "5" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails when betsToday reaches max", async () => {
    const ctx = makeCtx({ betsToday: 5 });
    const res = await MaxBetsPerDayBlock.evaluate(
      block("max_bets_per_day", { max: "5" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("defaults max to 10", async () => {
    const ctx = makeCtx({ betsToday: 9 });
    const res = await MaxBetsPerDayBlock.evaluate(
      block("max_bets_per_day", {}),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true); // 9 < 10
  });
});

describe("DailyLossLimitBlock", () => {
  it("passes when daily loss is within limit", async () => {
    const ctx = makeCtx({ dailyPnl: -8 });
    const res = await DailyLossLimitBlock.evaluate(
      block("daily_loss_limit", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true); // -8 > -10
  });

  it("fails when daily loss exceeds limit", async () => {
    const ctx = makeCtx({ dailyPnl: -12 });
    const res = await DailyLossLimitBlock.evaluate(
      block("daily_loss_limit", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("passes when pnl is positive", async () => {
    const ctx = makeCtx({ dailyPnl: 5 });
    const res = await DailyLossLimitBlock.evaluate(
      block("daily_loss_limit", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails closed when max loss is not finite decimal", async () => {
    const ctx = makeCtx({ dailyPnl: -1 });
    const res = await DailyLossLimitBlock.evaluate(
      block("daily_loss_limit", { maxLossUsdc: "10loss" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid maxLossUsdc/);
  });
});

describe("CooldownAfterTradeBlock", () => {
  it("passes when sufficient time has passed since last trade", async () => {
    const now = Date.now();
    const ctx = makeCtx({ lastTradeAt: now - 10_000 }, now);
    const res = await CooldownAfterTradeBlock.evaluate(
      block("cooldown_after_trade", { cooldownMs: "5000" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails when still in cooldown window", async () => {
    const now = Date.now();
    const ctx = makeCtx({ lastTradeAt: now - 2_000 }, now);
    const res = await CooldownAfterTradeBlock.evaluate(
      block("cooldown_after_trade", { cooldownMs: "5000" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("passes when lastTradeAt is 0 (never traded)", async () => {
    const ctx = makeCtx({ lastTradeAt: 0 });
    const res = await CooldownAfterTradeBlock.evaluate(
      block("cooldown_after_trade", { cooldownMs: "60000" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });
});

describe("PriceInRangeBlock", () => {
  it("passes when price is within range", async () => {
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.55 }),
    });
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "0.60" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("passes when price equals the bounds (inclusive)", async () => {
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.4 }),
    });
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "0.60" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails when price is below range", async () => {
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.3 }),
    });
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "0.60" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fails when price is above range", async () => {
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.75 }),
    });
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "0.60" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fails when no price data", async () => {
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "0.60" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fails closed when price range bounds are not finite decimal", async () => {
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.55 }),
    });
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "NaN" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid max/);
  });

  it("fails closed when cached price is not finite decimal", async () => {
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: Number.POSITIVE_INFINITY }),
    });
    const res = await PriceInRangeBlock.evaluate(
      block("price_in_range", { tokenId: "tok1", min: "0.40", max: "0.60" }),
      makeCtx(),
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid price/);
  });
});

describe("NoReentryBlock", () => {
  it("passes when token has not been traded today", async () => {
    const ctx = makeCtx({ tradedTokensToday: ["other-tok"] });
    const res = await NoReentryBlock.evaluate(
      block("no_reentry", { tokenId: "tok1" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails when token has already been traded today", async () => {
    const ctx = makeCtx({ tradedTokensToday: ["tok1", "tok2"] });
    const res = await NoReentryBlock.evaluate(
      block("no_reentry", { tokenId: "tok1" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/already traded/);
  });

  it("passes when tokenId is not configured", async () => {
    const res = await NoReentryBlock.evaluate(
      block("no_reentry", {}),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true); // no tokenId = pass
  });

  it("passes when tradedTokensToday is empty", async () => {
    const ctx = makeCtx({ tradedTokensToday: [] });
    const res = await NoReentryBlock.evaluate(
      block("no_reentry", { tokenId: "tok1" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });
});

describe("NoExistingPositionBlock", () => {
  it("passes when no position exists", async () => {
    const prisma = makePrisma(); // findUnique returns null
    const res = await NoExistingPositionBlock.evaluate(
      block("no_existing_position", { tokenId: "tok1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(true);
  });

  it("fails when position with positive size exists", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({ size: "50.0" });
    const res = await NoExistingPositionBlock.evaluate(
      block("no_existing_position", { tokenId: "tok1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/existing position/);
  });

  it("passes when position exists but size is 0", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({ size: "0" });
    const res = await NoExistingPositionBlock.evaluate(
      block("no_existing_position", { tokenId: "tok1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(true); // size = 0 → no real position
  });

  it("passes when tokenId is not configured", async () => {
    const res = await NoExistingPositionBlock.evaluate(
      block("no_existing_position", {}),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails closed when position size is not finite decimal", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({ size: "1e309" });
    const res = await NoExistingPositionBlock.evaluate(
      block("no_existing_position", { tokenId: "tok1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/invalid position size/);
  });
});

describe("TimeWindowBlock", () => {
  it("passes when current UTC time is within window", async () => {
    // Force a known UTC time: 14:30
    const dt = new Date();
    dt.setUTCHours(14, 30, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "9",
        startMM: "0",
        endHH: "17",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails when current UTC time is before window", async () => {
    const dt = new Date();
    dt.setUTCHours(7, 0, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "9",
        startMM: "0",
        endHH: "17",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fails when current UTC time is after window", async () => {
    const dt = new Date();
    dt.setUTCHours(20, 0, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "9",
        startMM: "0",
        endHH: "17",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("passes at the exact start boundary (inclusive)", async () => {
    const dt = new Date();
    dt.setUTCHours(9, 0, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "9",
        startMM: "0",
        endHH: "17",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("passes at the exact end boundary (inclusive)", async () => {
    const dt = new Date();
    dt.setUTCHours(17, 0, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "9",
        startMM: "0",
        endHH: "17",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("passes late-night time within an overnight window", async () => {
    const dt = new Date();
    dt.setUTCHours(23, 30, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "22",
        startMM: "0",
        endHH: "6",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
    expect(res.reason).toMatch(/in \[22:00, 06:00\]: true/);
  });

  it("passes early-morning time within an overnight window", async () => {
    const dt = new Date();
    dt.setUTCHours(3, 0, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "22",
        startMM: "0",
        endHH: "6",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fails during daytime when outside an overnight window", async () => {
    const dt = new Date();
    dt.setUTCHours(14, 0, 0, 0);
    const ctx = makeCtx({}, dt.getTime());
    const res = await TimeWindowBlock.evaluate(
      block("time_window", {
        startHH: "22",
        startMM: "0",
        endHH: "6",
        endMM: "0",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });
});
