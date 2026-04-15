import { describe, it, expect, vi } from "vitest";
import {
  StopIfDailyLossBlock,
  StopIfOrdersPerMinBlock,
  StopIfConsecutiveLossBlock,
  StopIfExposureExceedsBlock,
  PauseAfterFillBlock,
  MaxOrdersTotalBlock,
} from "./safety.blocks";
import { block, makeCtx, makePrisma, makeRedis } from "./__helpers__";

describe("StopIfDailyLossBlock", () => {
  it("fires when daily loss is within limit", async () => {
    const ctx = makeCtx({ dailyPnl: -5 });
    const res = await StopIfDailyLossBlock.evaluate(
      block("stop_if_daily_loss", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("does NOT fire when daily loss exceeds limit", async () => {
    const ctx = makeCtx({ dailyPnl: -15 });
    const res = await StopIfDailyLossBlock.evaluate(
      block("stop_if_daily_loss", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/SAFETY STOP/);
  });

  it("fires when pnl is exactly at the limit boundary", async () => {
    const ctx = makeCtx({ dailyPnl: -10 });
    const res = await StopIfDailyLossBlock.evaluate(
      block("stop_if_daily_loss", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    // -10 > -10 is false → block fires = false (stops)
    expect(res.fired).toBe(false);
  });

  it("fires when pnl is positive", async () => {
    const ctx = makeCtx({ dailyPnl: 20 });
    const res = await StopIfDailyLossBlock.evaluate(
      block("stop_if_daily_loss", { maxLossUsdc: "10" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("defaults maxLossUsdc to 0 when not provided", async () => {
    const ctx = makeCtx({ dailyPnl: -1 });
    const res = await StopIfDailyLossBlock.evaluate(
      block("stop_if_daily_loss", {}),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false); // -1 > -0 is false
  });
});

describe("StopIfOrdersPerMinBlock", () => {
  it("fires when order rate is below limit", async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue("5") });
    const ctx = makeCtx();
    const res = await StopIfOrdersPerMinBlock.evaluate(
      block("stop_if_orders_per_min", { maxOrders: "10" }),
      ctx,
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("does NOT fire when order rate meets or exceeds limit", async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue("10") });
    const ctx = makeCtx();
    const res = await StopIfOrdersPerMinBlock.evaluate(
      block("stop_if_orders_per_min", { maxOrders: "10" }),
      ctx,
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/SAFETY STOP/);
  });

  it("treats null redis value as 0 orders", async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(null) });
    const ctx = makeCtx();
    const res = await StopIfOrdersPerMinBlock.evaluate(
      block("stop_if_orders_per_min", { maxOrders: "1" }),
      ctx,
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true); // 0 < 1
  });

  it("uses correct Redis key with strategyId", async () => {
    const get = vi.fn().mockResolvedValue("0");
    const redis = makeRedis({ get });
    const ctx = makeCtx();
    await StopIfOrdersPerMinBlock.evaluate(
      block("stop_if_orders_per_min", { maxOrders: "60" }),
      ctx,
      redis,
      makePrisma(),
    );
    expect(get).toHaveBeenCalledWith(`strategy:${ctx.strategyId}:orders:min`);
  });

  it("defaults maxOrders to 60 when not provided", async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue("59") });
    const ctx = makeCtx();
    const res = await StopIfOrdersPerMinBlock.evaluate(
      block("stop_if_orders_per_min", {}),
      ctx,
      redis,
      makePrisma(),
    );
    expect(res.fired).toBe(true); // 59 < 60
  });
});

describe("StopIfConsecutiveLossBlock", () => {
  it("fires when consecutive losses are below limit", async () => {
    const ctx = makeCtx({ consecutiveLoss: 2 });
    const res = await StopIfConsecutiveLossBlock.evaluate(
      block("stop_if_consecutive_loss", { maxLosses: "3" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("does NOT fire when consecutive losses meet limit", async () => {
    const ctx = makeCtx({ consecutiveLoss: 3 });
    const res = await StopIfConsecutiveLossBlock.evaluate(
      block("stop_if_consecutive_loss", { maxLosses: "3" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/SAFETY STOP/);
  });

  it("does NOT fire when consecutive losses exceed limit", async () => {
    const ctx = makeCtx({ consecutiveLoss: 5 });
    const res = await StopIfConsecutiveLossBlock.evaluate(
      block("stop_if_consecutive_loss", { maxLosses: "3" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fires when consecutiveLoss is 0", async () => {
    const ctx = makeCtx({ consecutiveLoss: 0 });
    const res = await StopIfConsecutiveLossBlock.evaluate(
      block("stop_if_consecutive_loss", { maxLosses: "3" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });
});

describe("StopIfExposureExceedsBlock", () => {
  it("fires when total exposure is below limit", async () => {
    const prisma = makePrisma();
    prisma.position.findMany.mockResolvedValue([
      { size: "10", currentPrice: "0.5" }, // 5 USDC
      { size: "20", currentPrice: "0.3" }, // 6 USDC
    ]);
    const ctx = makeCtx();
    const res = await StopIfExposureExceedsBlock.evaluate(
      block("stop_if_exposure_exceeds", { maxUsdc: "20" }),
      ctx,
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(true); // 11 < 20
  });

  it("does NOT fire when exposure equals or exceeds limit", async () => {
    const prisma = makePrisma();
    prisma.position.findMany.mockResolvedValue([
      { size: "100", currentPrice: "0.5" }, // 50 USDC
    ]);
    const ctx = makeCtx();
    const res = await StopIfExposureExceedsBlock.evaluate(
      block("stop_if_exposure_exceeds", { maxUsdc: "40" }),
      ctx,
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/SAFETY STOP/);
  });

  it("fires when user has no positions (exposure = 0)", async () => {
    const prisma = makePrisma(); // returns [] by default
    const ctx = makeCtx();
    const res = await StopIfExposureExceedsBlock.evaluate(
      block("stop_if_exposure_exceeds", { maxUsdc: "100" }),
      ctx,
      makeRedis(),
      prisma,
    );
    expect(res.fired).toBe(true);
  });

  it("queries positions for the correct userId", async () => {
    const prisma = makePrisma();
    const ctx = makeCtx();
    await StopIfExposureExceedsBlock.evaluate(
      block("stop_if_exposure_exceeds", { maxUsdc: "100" }),
      ctx,
      makeRedis(),
      prisma,
    );
    expect(prisma.position.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: ctx.userId } }),
    );
  });
});

describe("PauseAfterFillBlock", () => {
  it("fires when cooldown has elapsed", async () => {
    const now = Date.now();
    const ctx = makeCtx({ lastTradeAt: now - 10_000 }, now);
    const res = await PauseAfterFillBlock.evaluate(
      block("pause_after_fill", { pauseMs: "5000" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true); // 10s elapsed >= 5s
  });

  it("does NOT fire within cooldown window", async () => {
    const now = Date.now();
    const ctx = makeCtx({ lastTradeAt: now - 1_000 }, now);
    const res = await PauseAfterFillBlock.evaluate(
      block("pause_after_fill", { pauseMs: "5000" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/SAFETY PAUSE/);
  });

  it("fires when pauseMs is 0 (no cooldown)", async () => {
    const ctx = makeCtx({ lastTradeAt: Date.now() });
    const res = await PauseAfterFillBlock.evaluate(
      block("pause_after_fill", { pauseMs: "0" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("fires when lastTradeAt is 0 (never traded)", async () => {
    const ctx = makeCtx({ lastTradeAt: 0 });
    const res = await PauseAfterFillBlock.evaluate(
      block("pause_after_fill", { pauseMs: "60000" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    // elapsed = now - 0 = very large, >= 60000
    expect(res.fired).toBe(true);
  });
});

describe("MaxOrdersTotalBlock", () => {
  it("fires when total orders are below max", async () => {
    const ctx = makeCtx({ totalOrders: 49 });
    const res = await MaxOrdersTotalBlock.evaluate(
      block("max_orders_total", { max: "50" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });

  it("does NOT fire when total orders reach max", async () => {
    const ctx = makeCtx({ totalOrders: 50 });
    const res = await MaxOrdersTotalBlock.evaluate(
      block("max_orders_total", { max: "50" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
    expect(res.reason).toMatch(/SAFETY STOP/);
  });

  it("does NOT fire when total orders exceed max", async () => {
    const ctx = makeCtx({ totalOrders: 100 });
    const res = await MaxOrdersTotalBlock.evaluate(
      block("max_orders_total", { max: "50" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(false);
  });

  it("fires when totalOrders is 0", async () => {
    const ctx = makeCtx({ totalOrders: 0 });
    const res = await MaxOrdersTotalBlock.evaluate(
      block("max_orders_total", { max: "1" }),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(res.fired).toBe(true);
  });
});
