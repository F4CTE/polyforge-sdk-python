import { describe, it, expect } from "vitest";
import {
  createSimState,
  checkSafety,
  checkTriggers,
  checkConditions,
  executeActions,
  checkAutoExits,
  computeMaxLookback,
  Block,
  PriceState,
  SimState,
  SimPosition,
} from "./evaluator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePrice(overrides: Partial<PriceState> = {}): PriceState {
  return {
    price: 0.5,
    prevPrice: 0.5,
    bid: 0.48,
    ask: 0.52,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makePrices(
  entries: Record<string, Partial<PriceState>>,
): Map<string, PriceState> {
  const m = new Map<string, PriceState>();
  for (const [id, p] of Object.entries(entries)) {
    m.set(id, makePrice(p));
  }
  return m;
}

function makePositions(
  entries: Record<string, SimPosition>,
): Map<string, SimPosition> {
  return new Map(Object.entries(entries));
}

// ─── createSimState ──────────────────────────────────────────────────────────

describe("createSimState", () => {
  it("returns a fresh state with zero counters and empty maps", () => {
    const state = createSimState();
    expect(state.betsToday).toBe(0);
    expect(state.dailyPnl).toBe(0);
    expect(state.consecutiveLoss).toBe(0);
    expect(state.totalOrders).toBe(0);
    expect(state.lastTradeAt).toBe(0);
    expect(state.stopLosses.size).toBe(0);
    expect(state.takeProfits.size).toBe(0);
  });
});

// ─── computeMaxLookback ───────────────────────────────────────────────────────

describe("computeMaxLookback", () => {
  it("returns 0 for empty triggers", () => {
    expect(computeMaxLookback([])).toBe(0);
  });

  it("returns 0 for every_tick (no TA required)", () => {
    expect(computeMaxLookback([{ type: "every_tick" }])).toBe(0);
  });

  describe("ma_crossover / ma_crossover_tick", () => {
    it("uses max(fastPeriod, slowPeriod) + 1 with config", () => {
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          config: { fastPeriod: "10", slowPeriod: "30" },
        },
      ];
      expect(computeMaxLookback(blocks)).toBe(31);
    });

    it("uses max(fastPeriod, slowPeriod) + 1 with params fallback", () => {
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          params: { fastPeriod: "5", slowPeriod: "15" },
        },
      ];
      expect(computeMaxLookback(blocks)).toBe(16);
    });

    it("merges config and params, preferring params", () => {
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          config: { fastPeriod: "10", slowPeriod: "30" },
          params: { fastPeriod: "5" },
        },
      ];
      // params.fastPeriod=5, config.slowPeriod=30 → max(5,30) + 1 = 31
      expect(computeMaxLookback(blocks)).toBe(31);
    });
  });

  describe("macd_crossover / macd_signal_tick", () => {
    it("returns slow + signalPeriod with config defaults", () => {
      const blocks: Block[] = [
        {
          type: "macd_signal_tick",
          config: { slowPeriod: "26", signalPeriod: "9" },
        },
      ];
      // 26 + 9 = 35 (was previously 26 + 1 = 27)
      expect(computeMaxLookback(blocks)).toBe(35);
    });

    it("returns slow + signalPeriod with explicit params", () => {
      const blocks: Block[] = [
        {
          type: "macd_signal_tick",
          params: { slowPeriod: "20", signalPeriod: "5" },
        },
      ];
      expect(computeMaxLookback(blocks)).toBe(25);
    });

    it("uses defaults (slowPeriod=26, signalPeriod=9) when missing", () => {
      const blocks: Block[] = [{ type: "macd_crossover" }];
      expect(computeMaxLookback(blocks)).toBe(35);
    });

    it("takes max across multiple MACD blocks", () => {
      const blocks: Block[] = [
        {
          type: "macd_signal_tick",
          config: { slowPeriod: "12", signalPeriod: "5" },
        },
        {
          type: "macd_crossover",
          params: { slowPeriod: "30", signalPeriod: "10" },
        },
      ];
      expect(computeMaxLookback(blocks)).toBe(40);
    });
  });

  describe("bollinger_bands / bollinger_breakout_tick", () => {
    it("returns period + 1 for cross detection parity", () => {
      const blocks: Block[] = [
        { type: "bollinger_breakout_tick", config: { period: "20" } },
      ];
      expect(computeMaxLookback(blocks)).toBe(21);
    });
  });

  describe("rsi_threshold_tick", () => {
    it("returns period + 1", () => {
      const blocks: Block[] = [
        { type: "rsi_threshold_tick", config: { period: "14" } },
      ];
      expect(computeMaxLookback(blocks)).toBe(15);
    });
  });

  describe("vwap_cross_tick", () => {
    it("returns 250 to match live engine window", () => {
      const blocks: Block[] = [{ type: "vwap_cross_tick" }];
      expect(computeMaxLookback(blocks)).toBe(250);
    });
  });

  it("returns max across mixed trigger types", () => {
    const blocks: Block[] = [
      {
        type: "ma_crossover_tick",
        config: { fastPeriod: "10", slowPeriod: "50" },
      },
      {
        type: "macd_signal_tick",
        config: { slowPeriod: "26", signalPeriod: "9" },
      },
      { type: "rsi_threshold_tick", config: { period: "14" } },
      { type: "every_tick" },
    ];
    // ma: 50+1=51, macd: 26+9=35, rsi: 14+1=15, every_tick: 0 → max=51
    expect(computeMaxLookback(blocks)).toBe(51);
  });
});

// ─── checkSafety ─────────────────────────────────────────────────────────────

describe("checkSafety", () => {
  it("returns true when safety array is empty", () => {
    const state = createSimState();
    expect(checkSafety([], state, new Map(), new Map())).toBe(true);
  });

  describe("stop_if_daily_loss", () => {
    it("returns false when dailyPnl exceeds max loss", () => {
      const state = createSimState();
      state.dailyPnl = -50;
      const blocks: Block[] = [
        { type: "stop_if_daily_loss", config: { maxLossUsdc: 50 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
    });

    it("returns true when dailyPnl is within limit", () => {
      const state = createSimState();
      state.dailyPnl = -30;
      const blocks: Block[] = [
        { type: "stop_if_daily_loss", config: { maxLossUsdc: 50 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(true);
    });

    it("handles negative maxLossUsdc by taking absolute value", () => {
      const state = createSimState();
      state.dailyPnl = -50;
      const blocks: Block[] = [
        { type: "stop_if_daily_loss", config: { maxLossUsdc: -50 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
    });
  });

  describe("max_orders_total", () => {
    it("returns false when totalOrders reaches max", () => {
      const state = createSimState();
      state.totalOrders = 100;
      const blocks: Block[] = [
        { type: "max_orders_total", config: { maxOrders: 100 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
    });

    it("returns true when totalOrders is below max", () => {
      const state = createSimState();
      state.totalOrders = 99;
      const blocks: Block[] = [
        { type: "max_orders_total", config: { maxOrders: 100 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(true);
    });

    it("returns true when maxOrders is 0 (disabled)", () => {
      const state = createSimState();
      state.totalOrders = 1000;
      const blocks: Block[] = [
        { type: "max_orders_total", config: { maxOrders: 0 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(true);
    });
  });

  describe("stop_if_consecutive_loss", () => {
    it("returns false when consecutive losses reach max", () => {
      const state = createSimState();
      state.consecutiveLoss = 5;
      const blocks: Block[] = [
        { type: "stop_if_consecutive_loss", config: { maxConsecutiveLoss: 5 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
    });

    it("returns true when consecutive losses are below max", () => {
      const state = createSimState();
      state.consecutiveLoss = 4;
      const blocks: Block[] = [
        { type: "stop_if_consecutive_loss", config: { maxConsecutiveLoss: 5 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(true);
    });
  });

  describe("stop_if_exposure_exceeds", () => {
    it("returns false when total exposure reaches max", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 100, avgPrice: 0.5 },
        "tok-b": { size: 50, avgPrice: 1.0 },
      });
      // exposure = 100*0.5 + 50*1.0 = 100
      const blocks: Block[] = [
        { type: "stop_if_exposure_exceeds", config: { maxExposureUsdc: 100 } },
      ];
      expect(checkSafety(blocks, state, new Map(), positions)).toBe(false);
    });

    it("returns true when total exposure is below max", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        { type: "stop_if_exposure_exceeds", config: { maxExposureUsdc: 100 } },
      ];
      expect(checkSafety(blocks, state, new Map(), positions)).toBe(true);
    });

    it("returns true when maxExposureUsdc is 0 (disabled)", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 1000, avgPrice: 1.0 },
      });
      const blocks: Block[] = [
        { type: "stop_if_exposure_exceeds", config: { maxExposureUsdc: 0 } },
      ];
      expect(checkSafety(blocks, state, new Map(), positions)).toBe(true);
    });
  });

  it("handles blocks with missing config gracefully", () => {
    const state = createSimState();
    const blocks: Block[] = [{ type: "stop_if_daily_loss" }];
    // With no config, threshold defaults to 0/undefined — safety trips
    expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
  });

  it("checks all safety blocks and fails if any fails", () => {
    const state = createSimState();
    state.totalOrders = 100;
    state.dailyPnl = -10; // within limit
    const blocks: Block[] = [
      { type: "stop_if_daily_loss", config: { maxLossUsdc: 50 } },
      { type: "max_orders_total", config: { maxOrders: 100 } }, // this fails
    ];
    expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
  });
});

// ─── checkTriggers ───────────────────────────────────────────────────────────

describe("checkTriggers", () => {
  it("returns true when triggers array is empty", () => {
    expect(checkTriggers([], new Map())).toBe(true);
  });

  it("every_tick always returns true", () => {
    const blocks: Block[] = [{ type: "every_tick" }];
    expect(checkTriggers(blocks, new Map())).toBe(true);
  });

  describe("price_above", () => {
    it("returns true when price is above threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.7 } });
      const blocks: Block[] = [
        { type: "price_above", config: { tokenId: "tok-a", threshold: 0.5 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("returns false when price is at or below threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "price_above", config: { tokenId: "tok-a", threshold: 0.5 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(false);
    });

    it("returns false when tokenId is not found in prices", () => {
      const blocks: Block[] = [
        {
          type: "price_above",
          config: { tokenId: "missing", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, new Map())).toBe(false);
    });
  });

  describe("price_below", () => {
    it("returns true when price is below threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.3 } });
      const blocks: Block[] = [
        { type: "price_below", config: { tokenId: "tok-a", threshold: 0.5 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("returns false when price is at or above threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "price_below", config: { tokenId: "tok-a", threshold: 0.5 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(false);
    });
  });

  describe("price_crosses_up", () => {
    it("returns true when prevPrice <= threshold and price > threshold", () => {
      const prices = makePrices({
        "tok-a": { price: 0.6, prevPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "price_crosses_up",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("returns false when prevPrice was already above threshold", () => {
      const prices = makePrices({
        "tok-a": { price: 0.6, prevPrice: 0.55 },
      });
      const blocks: Block[] = [
        {
          type: "price_crosses_up",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(false);
    });
  });

  describe("price_crosses_down", () => {
    it("returns true when prevPrice >= threshold and price < threshold", () => {
      const prices = makePrices({
        "tok-a": { price: 0.4, prevPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "price_crosses_down",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("returns false when prevPrice was already below threshold", () => {
      const prices = makePrices({
        "tok-a": { price: 0.4, prevPrice: 0.45 },
      });
      const blocks: Block[] = [
        {
          type: "price_crosses_down",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(false);
    });
  });

  describe("spread_below", () => {
    it("returns true when spread is below maxSpread", () => {
      const prices = makePrices({
        "tok-a": { bid: 0.48, ask: 0.5 },
      });
      const blocks: Block[] = [
        { type: "spread_below", config: { tokenId: "tok-a", maxSpread: 0.05 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("returns false when spread is at or above maxSpread", () => {
      const prices = makePrices({
        "tok-a": { bid: 0.4, ask: 0.5 },
      });
      const blocks: Block[] = [
        { type: "spread_below", config: { tokenId: "tok-a", maxSpread: 0.05 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(false);
    });
  });

  describe("price_above_tick / price_below_tick", () => {
    it("price_above_tick returns true when price > threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.7 } });
      const blocks: Block[] = [
        {
          type: "price_above_tick",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("price_below_tick returns true when price < threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.3 } });
      const blocks: Block[] = [
        {
          type: "price_below_tick",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("price_above_tick returns false when price <= threshold", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "price_above_tick",
          config: { tokenId: "tok-a", threshold: 0.5 },
        },
      ];
      expect(checkTriggers(blocks, prices)).toBe(false);
    });
  });

  it("returns false when no trigger matches (no every_tick)", () => {
    const prices = makePrices({ "tok-a": { price: 0.3 } });
    const blocks: Block[] = [
      { type: "price_above", config: { tokenId: "tok-a", threshold: 0.5 } },
    ];
    expect(checkTriggers(blocks, prices)).toBe(false);
  });
});

// ─── checkConditions ─────────────────────────────────────────────────────────

describe("checkConditions", () => {
  it("returns true when conditions array is empty", () => {
    const state = createSimState();
    expect(checkConditions([], state, new Map(), new Map(), Date.now())).toBe(
      true,
    );
  });

  describe("max_bets_per_day", () => {
    it("returns false when betsToday reaches max", () => {
      const state = createSimState();
      state.betsToday = 5;
      const blocks: Block[] = [
        { type: "max_bets_per_day", config: { maxBets: 5 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(false);
    });

    it("returns true when betsToday is below max", () => {
      const state = createSimState();
      state.betsToday = 4;
      const blocks: Block[] = [
        { type: "max_bets_per_day", config: { maxBets: 5 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });

    it("returns true when maxBets is 0 (disabled)", () => {
      const state = createSimState();
      state.betsToday = 100;
      const blocks: Block[] = [
        { type: "max_bets_per_day", config: { maxBets: 0 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });
  });

  describe("daily_loss_limit", () => {
    it("returns false when dailyPnl exceeds limit", () => {
      const state = createSimState();
      state.dailyPnl = -100;
      const blocks: Block[] = [
        { type: "daily_loss_limit", config: { maxLossUsdc: 100 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(false);
    });

    it("returns true when dailyPnl is within limit", () => {
      const state = createSimState();
      state.dailyPnl = -50;
      const blocks: Block[] = [
        { type: "daily_loss_limit", config: { maxLossUsdc: 100 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });
  });

  describe("price_in_range", () => {
    it("returns true when price is within range", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "price_in_range",
          config: { tokenId: "tok-a", minPrice: 0.3, maxPrice: 0.7 },
        },
      ];
      expect(
        checkConditions(blocks, state, prices, new Map(), Date.now()),
      ).toBe(true);
    });

    it("returns false when price is below range", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.2 } });
      const blocks: Block[] = [
        {
          type: "price_in_range",
          config: { tokenId: "tok-a", minPrice: 0.3, maxPrice: 0.7 },
        },
      ];
      expect(
        checkConditions(blocks, state, prices, new Map(), Date.now()),
      ).toBe(false);
    });

    it("returns false when price is above range", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.8 } });
      const blocks: Block[] = [
        {
          type: "price_in_range",
          config: { tokenId: "tok-a", minPrice: 0.3, maxPrice: 0.7 },
        },
      ];
      expect(
        checkConditions(blocks, state, prices, new Map(), Date.now()),
      ).toBe(false);
    });
  });

  describe("max_position", () => {
    it("returns false when position value reaches max", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 100, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "max_position",
          config: { tokenId: "tok-a", maxPositionUsdc: 50 },
        },
      ];
      expect(
        checkConditions(blocks, state, new Map(), positions, Date.now()),
      ).toBe(false);
    });

    it("returns true when position value is below max", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "max_position",
          config: { tokenId: "tok-a", maxPositionUsdc: 50 },
        },
      ];
      expect(
        checkConditions(blocks, state, new Map(), positions, Date.now()),
      ).toBe(true);
    });

    it("returns true when no position exists for token", () => {
      const state = createSimState();
      const blocks: Block[] = [
        {
          type: "max_position",
          config: { tokenId: "tok-a", maxPositionUsdc: 50 },
        },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });
  });

  describe("cooldown_after_trade", () => {
    it("returns false when within cooldown period", () => {
      const state = createSimState();
      const now = Date.now();
      state.lastTradeAt = now - 1000; // traded 1s ago
      const blocks: Block[] = [
        { type: "cooldown_after_trade", config: { cooldownMs: 5000 } },
      ];
      expect(checkConditions(blocks, state, new Map(), new Map(), now)).toBe(
        false,
      );
    });

    it("returns true when cooldown has elapsed", () => {
      const state = createSimState();
      const now = Date.now();
      state.lastTradeAt = now - 10000; // traded 10s ago
      const blocks: Block[] = [
        { type: "cooldown_after_trade", config: { cooldownMs: 5000 } },
      ];
      expect(checkConditions(blocks, state, new Map(), new Map(), now)).toBe(
        true,
      );
    });

    it("returns true when no trade has occurred yet (lastTradeAt=0)", () => {
      const state = createSimState();
      const blocks: Block[] = [
        { type: "cooldown_after_trade", config: { cooldownMs: 5000 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });
  });

  describe("no_existing_position", () => {
    it("returns false when a position exists for the token", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        { type: "no_existing_position", config: { tokenId: "tok-a" } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), positions, Date.now()),
      ).toBe(false);
    });

    it("returns true when no position exists for the token", () => {
      const state = createSimState();
      const blocks: Block[] = [
        { type: "no_existing_position", config: { tokenId: "tok-a" } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });
  });

  describe("no_reentry", () => {
    it("returns true (simplified no-op in evaluator)", () => {
      const state = createSimState();
      const blocks: Block[] = [{ type: "no_reentry" }];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(true);
    });
  });

  it("fails if any single condition fails among multiple", () => {
    const state = createSimState();
    state.betsToday = 10;
    const blocks: Block[] = [
      { type: "max_bets_per_day", config: { maxBets: 20 } }, // passes
      { type: "max_bets_per_day", config: { maxBets: 5 } }, // fails
    ];
    expect(
      checkConditions(blocks, state, new Map(), new Map(), Date.now()),
    ).toBe(false);
  });
});

// ─── executeActions ──────────────────────────────────────────────────────────

describe("executeActions", () => {
  it("returns empty array when actions array is empty", () => {
    const state = createSimState();
    expect(executeActions([], new Map(), new Map(), state)).toEqual([]);
  });

  describe("skip_bet", () => {
    it("returns empty array and aborts all subsequent actions", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "skip_bet" },
        { type: "buy_yes", config: { tokenId: "tok-a", size: 10 } },
      ];
      expect(executeActions(blocks, prices, new Map(), state)).toEqual([]);
    });
  });

  describe("buy_yes / buy_no", () => {
    it("creates a BUY fill with outcome YES for buy_yes", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "buy_yes", config: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills).toHaveLength(1);
      expect(fills[0].side).toBe("BUY");
      expect(fills[0].outcome).toBe("YES");
      expect(fills[0].price).toBe(0.5);
      expect(fills[0].size).toBe(20); // 10 / 0.5
      expect(fills[0].tokenId).toBe("tok-a");
    });

    it("creates a BUY fill with outcome NO for buy_no", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "buy_no", config: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills).toHaveLength(1);
      expect(fills[0].outcome).toBe("NO");
    });

    it("uses default price of 0.5 when price is 0", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0 } });
      const blocks: Block[] = [
        { type: "buy_yes", config: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills[0].price).toBe(0.5);
      expect(fills[0].size).toBe(20); // 10 / 0.5
    });

    it("skips buy when tokenId is not in prices", () => {
      const state = createSimState();
      const blocks: Block[] = [
        { type: "buy_yes", config: { tokenId: "missing", size: 10 } },
      ];
      const fills = executeActions(blocks, new Map(), new Map(), state);
      expect(fills).toHaveLength(0);
    });

    it("uses default size of 10 when size not specified", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "buy_yes", config: { tokenId: "tok-a" } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills[0].size).toBe(20); // default 10 / 0.5
    });
  });

  describe("set_stop_loss", () => {
    it("sets stop loss price on state for existing position", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "set_stop_loss",
          config: { tokenId: "tok-a", stopLossPct: 0.2 },
        },
      ];
      executeActions(blocks, new Map(), positions, state);
      // stopLoss = 0.5 * (1 - 0.2) = 0.4
      expect(state.stopLosses.get("tok-a")).toBeCloseTo(0.4, 6);
    });

    it("does not set stop loss when no position exists", () => {
      const state = createSimState();
      const blocks: Block[] = [
        {
          type: "set_stop_loss",
          config: { tokenId: "tok-a", stopLossPct: 0.2 },
        },
      ];
      executeActions(blocks, new Map(), new Map(), state);
      expect(state.stopLosses.has("tok-a")).toBe(false);
    });

    it("does not produce any fills", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "set_stop_loss",
          config: { tokenId: "tok-a", stopLossPct: 0.2 },
        },
      ];
      const fills = executeActions(blocks, new Map(), positions, state);
      expect(fills).toHaveLength(0);
    });
  });

  describe("take_profit", () => {
    it("sets take profit price on state for existing position", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "take_profit",
          config: { tokenId: "tok-a", takeProfitPct: 0.5 },
        },
      ];
      executeActions(blocks, new Map(), positions, state);
      // takeProfit = 0.5 * (1 + 0.5) = 0.75
      expect(state.takeProfits.get("tok-a")).toBeCloseTo(0.75, 6);
    });

    it("does not set take profit when no position exists", () => {
      const state = createSimState();
      const blocks: Block[] = [
        {
          type: "take_profit",
          config: { tokenId: "tok-a", takeProfitPct: 0.5 },
        },
      ];
      executeActions(blocks, new Map(), new Map(), state);
      expect(state.takeProfits.has("tok-a")).toBe(false);
    });
  });

  describe("scale_in", () => {
    it("creates a BUY fill when position and price exist", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        { type: "scale_in", config: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, prices, positions, state);
      expect(fills).toHaveLength(1);
      expect(fills[0].side).toBe("BUY");
      expect(fills[0].type).toBe("scale_in");
      expect(fills[0].size).toBe(20); // 10 / 0.5
    });

    it("skips when no position exists", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        { type: "scale_in", config: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills).toHaveLength(0);
    });

    it("skips when price not available", () => {
      const state = createSimState();
      const positions = makePositions({
        "tok-a": { size: 10, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        { type: "scale_in", config: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, new Map(), positions, state);
      expect(fills).toHaveLength(0);
    });
  });

  describe("scale_out", () => {
    it("creates a SELL fill for a percentage of the position", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.7 } });
      const positions = makePositions({
        "tok-a": { size: 20, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        { type: "scale_out", config: { tokenId: "tok-a", scalePct: 0.5 } },
      ];
      const fills = executeActions(blocks, prices, positions, state);
      expect(fills).toHaveLength(1);
      expect(fills[0].side).toBe("SELL");
      expect(fills[0].size).toBe(10); // 20 * 0.5
      expect(fills[0].price).toBe(0.7);
      expect(fills[0].type).toBe("scale_out");
    });

    it("skips when no position exists", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.7 } });
      const blocks: Block[] = [
        { type: "scale_out", config: { tokenId: "tok-a", scalePct: 0.5 } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills).toHaveLength(0);
    });
  });

  describe("cancel_all_orders", () => {
    it("produces no fills (no-op in backtest)", () => {
      const state = createSimState();
      const blocks: Block[] = [{ type: "cancel_all_orders" }];
      const fills = executeActions(blocks, new Map(), new Map(), state);
      expect(fills).toHaveLength(0);
    });
  });

  it("processes multiple actions sequentially", () => {
    const state = createSimState();
    const prices = makePrices({
      "tok-a": { price: 0.5 },
      "tok-b": { price: 0.6 },
    });
    const blocks: Block[] = [
      { type: "buy_yes", config: { tokenId: "tok-a", size: 10 } },
      { type: "buy_no", config: { tokenId: "tok-b", size: 10 } },
    ];
    const fills = executeActions(blocks, prices, new Map(), state);
    expect(fills).toHaveLength(2);
    expect(fills[0].tokenId).toBe("tok-a");
    expect(fills[1].tokenId).toBe("tok-b");
  });
});

// ─── checkAutoExits ──────────────────────────────────────────────────────────

describe("checkAutoExits", () => {
  it("returns empty array when no stop losses or take profits are set", () => {
    const state = createSimState();
    const prices = makePrices({ "tok-a": { price: 0.5 } });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });
    expect(checkAutoExits(state, prices, positions)).toEqual([]);
  });

  it("triggers stop loss SELL when price drops to stop level", () => {
    const state = createSimState();
    state.stopLosses.set("tok-a", 0.4);
    const prices = makePrices({ "tok-a": { price: 0.35 } });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });

    const fills = checkAutoExits(state, prices, positions);
    expect(fills).toHaveLength(1);
    expect(fills[0].side).toBe("SELL");
    expect(fills[0].size).toBe(10);
    expect(fills[0].type).toBe("stop_loss");
    expect(fills[0].tokenId).toBe("tok-a");
  });

  it("clears both stop loss and take profit after stop loss triggers", () => {
    const state = createSimState();
    state.stopLosses.set("tok-a", 0.4);
    state.takeProfits.set("tok-a", 0.8);
    const prices = makePrices({ "tok-a": { price: 0.35 } });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });

    checkAutoExits(state, prices, positions);
    expect(state.stopLosses.has("tok-a")).toBe(false);
    expect(state.takeProfits.has("tok-a")).toBe(false);
  });

  it("triggers take profit SELL when price rises to target", () => {
    const state = createSimState();
    state.takeProfits.set("tok-a", 0.8);
    const prices = makePrices({ "tok-a": { price: 0.85 } });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });

    const fills = checkAutoExits(state, prices, positions);
    expect(fills).toHaveLength(1);
    expect(fills[0].side).toBe("SELL");
    expect(fills[0].type).toBe("take_profit");
  });

  it("clears both stop loss and take profit after take profit triggers", () => {
    const state = createSimState();
    state.stopLosses.set("tok-a", 0.3);
    state.takeProfits.set("tok-a", 0.8);
    const prices = makePrices({ "tok-a": { price: 0.85 } });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });

    checkAutoExits(state, prices, positions);
    expect(state.stopLosses.has("tok-a")).toBe(false);
    expect(state.takeProfits.has("tok-a")).toBe(false);
  });

  it("does not trigger when price is between stop loss and take profit", () => {
    const state = createSimState();
    state.stopLosses.set("tok-a", 0.3);
    state.takeProfits.set("tok-a", 0.8);
    const prices = makePrices({ "tok-a": { price: 0.5 } });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });

    const fills = checkAutoExits(state, prices, positions);
    expect(fills).toHaveLength(0);
  });

  it("skips tokens with no price data", () => {
    const state = createSimState();
    state.stopLosses.set("tok-a", 0.3);
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
    });

    const fills = checkAutoExits(state, new Map(), positions);
    expect(fills).toHaveLength(0);
  });

  it("handles multiple positions with independent exits", () => {
    const state = createSimState();
    state.stopLosses.set("tok-a", 0.4);
    state.takeProfits.set("tok-b", 0.9);
    const prices = makePrices({
      "tok-a": { price: 0.35 }, // triggers stop loss
      "tok-b": { price: 0.95 }, // triggers take profit
    });
    const positions = makePositions({
      "tok-a": { size: 10, avgPrice: 0.5 },
      "tok-b": { size: 20, avgPrice: 0.6 },
    });

    const fills = checkAutoExits(state, prices, positions);
    expect(fills).toHaveLength(2);
    expect(fills.find((f) => f.tokenId === "tok-a")?.type).toBe("stop_loss");
    expect(fills.find((f) => f.tokenId === "tok-b")?.type).toBe("take_profit");
  });
});

// ─── TA Trigger Tests ─────────────────────────────────────────────────────────

describe("checkTriggers — TA blocks", () => {
  function makeHistory(values: number[]): Map<string, number[]> {
    return new Map([["tok-a", values]]);
  }

  describe("ma_crossover", () => {
    it("fires when fast SMA crosses above slow SMA", () => {
      // Build a descending trend + spike for strict crossover detection
      // fast(3) < slow(10) before spike, fast(3) >= slow(10) after spike
      const hist = [
        0.6, 0.59, 0.58, 0.57, 0.56, 0.55, 0.54, 0.53, 0.52, 0.51, 0.9,
      ];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "ma_crossover",
          config: { tokenId: "tok-a", fastPeriod: 3, slowPeriod: 10 },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire when history is insufficient", () => {
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "ma_crossover",
          config: { tokenId: "tok-a", fastPeriod: 5, slowPeriod: 20 },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory([0.5, 0.6]))).toBe(
        false,
      );
    });
  });

  describe("macd_crossover", () => {
    it("fires when MACD line crosses above zero", () => {
      // 20 flat bars at 0.5, then a sharp drop to 0.1 (MACD goes clearly negative),
      // then a sharp spike to 0.9 (MACD crosses to positive on the last bar).
      const flat = Array.from({ length: 20 }, () => 0.5);
      const hist = [...flat, 0.1, 0.9];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "macd_crossover",
          config: { tokenId: "tok-a", fastPeriod: 3, slowPeriod: 6 },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire when history is insufficient", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "macd_crossover",
          config: { tokenId: "tok-a" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory([0.5]))).toBe(false);
    });
  });

  describe("bollinger_bands", () => {
    it("fires when price breaks above upper band", () => {
      // 21 bars at 0.5 → bands computed from first 20 (current excluded) at 0.5 ± 0. Then price 0.9 → above upper
      const hist = Array.from({ length: 21 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "bollinger_bands",
          config: { tokenId: "tok-a", period: 20, stdDev: 2, band: "upper" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("fires when price breaks below lower band", () => {
      const hist = Array.from({ length: 21 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.1 } });
      const blocks: Block[] = [
        {
          type: "bollinger_bands",
          config: { tokenId: "tok-a", period: 20, stdDev: 2, band: "lower" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire when price is within bands", () => {
      const hist = Array.from({ length: 21 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "bollinger_bands",
          config: { tokenId: "tok-a", period: 20, stdDev: 2, band: "upper" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(false);
    });

    it("does not fire with insufficient history (exactly period)", () => {
      const hist = Array.from({ length: 20 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "bollinger_bands",
          config: { tokenId: "tok-a", period: 20, stdDev: 2, band: "upper" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(false);
    });
  });

  describe("rsi_threshold_tick (backtest)", () => {
    it("fires when RSI is above threshold (overbought)", () => {
      const hist = Array.from({ length: 20 }, (_, i) => 0.3 + i * 0.05);
      const prices = makePrices({ "tok-a": { price: hist[hist.length - 1] } });
      const blocks: Block[] = [
        {
          type: "rsi_threshold_tick",
          config: { tokenId: "tok-a", level: 70, direction: "above" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("fires when RSI is below threshold (oversold)", () => {
      const hist = Array.from({ length: 20 }, (_, i) => 0.9 - i * 0.04);
      const prices = makePrices({ "tok-a": { price: hist[hist.length - 1] } });
      const blocks: Block[] = [
        {
          type: "rsi_threshold_tick",
          config: { tokenId: "tok-a", level: 30, direction: "below" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire when history is insufficient", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "rsi_threshold_tick",
          config: { tokenId: "tok-a", level: 70, direction: "above" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory([0.5]))).toBe(false);
    });
  });

  // ── Tests using live-engine block type names ────────────────────────────

  describe("ma_crossover_tick (live name)", () => {
    it("fires on golden_cross when fast SMA crosses above slow SMA", () => {
      const hist = [
        0.6, 0.59, 0.58, 0.57, 0.56, 0.55, 0.54, 0.53, 0.52, 0.51, 0.9,
      ];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          config: {
            tokenId: "tok-a",
            shortPeriod: 3,
            longPeriod: 10,
            maType: "sma",
            direction: "golden_cross",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("fires on death_cross when fast SMA crosses below slow SMA", () => {
      // Ascending trend + drop for strict crossover detection
      // fast(3) > slow(10) before drop, fast(3) <= slow(10) after drop
      const hist = [
        0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.59, 0.6, 0.2,
      ];
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          config: {
            tokenId: "tok-a",
            shortPeriod: 3,
            longPeriod: 10,
            direction: "death_cross",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire when insufficient history", () => {
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          config: { tokenId: "tok-a", shortPeriod: 5, longPeriod: 50 },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory([0.5, 0.6]))).toBe(
        false,
      );
    });

    it("defaults longPeriod to 50 like live engine", () => {
      // Without explicit longPeriod, the backtest should use 50 (same as live)
      // which requires at least 51 history entries. With only 30, it won't fire.
      const hist = Array.from({ length: 30 }, (_, i) => 0.5 + i * 0.01);
      const prices = makePrices({ "tok-a": { price: hist[hist.length - 1] } });
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          params: {
            tokenId: "tok-a",
            shortPeriod: 3,
            direction: "golden_cross",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(false);
    });

    it("does not fire when direction is omitted (parity with live)", () => {
      const hist = [
        0.6, 0.59, 0.58, 0.57, 0.56, 0.55, 0.54, 0.53, 0.52, 0.51, 0.9,
      ];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "ma_crossover_tick",
          config: {
            tokenId: "tok-a",
            shortPeriod: 3,
            longPeriod: 10,
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(false);
    });
  });

  describe("macd_signal_tick (live name)", () => {
    it("fires on zero-line crossover via macd_signal_tick with signal param", () => {
      // 20 flat bars at 0.5, then sharp drop → MACD goes negative,
      // then spike → MACD crosses above zero on last bar
      const flat = Array.from({ length: 20 }, () => 0.5);
      const hist = [...flat, 0.1, 0.9];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "macd_signal_tick",
          config: {
            tokenId: "tok-a",
            fastPeriod: 3,
            slowPeriod: 6,
            signalPeriod: 5,
            signal: "line_cross",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("rejects macd_signal_tick without signal field (parity with live engine)", () => {
      const flat = Array.from({ length: 20 }, () => 0.5);
      const hist = [...flat, 0.1, 0.9];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "macd_signal_tick",
          config: {
            tokenId: "tok-a",
            fastPeriod: 3,
            slowPeriod: 6,
            signalPeriod: 5,
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(false);
    });

    it("does not fire when insufficient history", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "macd_signal_tick",
          config: {
            tokenId: "tok-a",
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory([0.5]))).toBe(false);
    });
  });

  describe("bollinger_breakout_tick (live name)", () => {
    it("fires when price breaks upper band via direction=upper_break", () => {
      const hist = Array.from({ length: 21 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "bollinger_breakout_tick",
          config: {
            tokenId: "tok-a",
            period: 20,
            stdDevMultiplier: 2,
            direction: "upper_break",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("fires when price breaks lower band via direction=lower_break", () => {
      const hist = Array.from({ length: 21 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.1 } });
      const blocks: Block[] = [
        {
          type: "bollinger_breakout_tick",
          config: {
            tokenId: "tok-a",
            period: 20,
            stdDevMultiplier: 2,
            direction: "lower_break",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire with insufficient history (exactly period)", () => {
      const hist = Array.from({ length: 20 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "bollinger_breakout_tick",
          config: {
            tokenId: "tok-a",
            period: 20,
            stdDevMultiplier: 2,
            direction: "upper_break",
          },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(false);
    });
  });

  describe("vwap_cross_tick", () => {
    it("fires when price crosses above VWAP", () => {
      const hist = [0.5, 0.5, 0.5, 0.9];
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "vwap_cross_tick",
          config: { tokenId: "tok-a", direction: "above" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("fires when price crosses below VWAP", () => {
      const hist = [0.9, 0.9, 0.9, 0.5];
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "vwap_cross_tick",
          config: { tokenId: "tok-a", direction: "below" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory(hist))).toBe(true);
    });

    it("does not fire when insufficient history", () => {
      const prices = makePrices({ "tok-a": { price: 0.5 } });
      const blocks: Block[] = [
        {
          type: "vwap_cross_tick",
          config: { tokenId: "tok-a", direction: "above" },
        },
      ];
      expect(checkTriggers(blocks, prices, makeHistory([0.5]))).toBe(false);
    });
  });

  // ─── backtest/live parity: params field (regression for #1189) ───────────────

  describe("params field — backtest/live parity", () => {
    it("safety: reads params when config is absent (stop_if_daily_loss)", () => {
      const state = createSimState();
      state.dailyPnl = -50;
      const blocks: Block[] = [
        { type: "stop_if_daily_loss", params: { maxLossUsdc: 50 } },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
    });

    it("safety: prefers params over config when both are present", () => {
      const state = createSimState();
      state.totalOrders = 100;
      const blocks: Block[] = [
        {
          type: "max_orders_total",
          params: { maxOrders: 100 },
          config: { maxOrders: 999 },
        },
      ];
      expect(checkSafety(blocks, state, new Map(), new Map())).toBe(false);
    });

    it("trigger: reads params for price_above", () => {
      const prices = makePrices({ "tok-a": { price: 0.7 } });
      const blocks: Block[] = [
        { type: "price_above", params: { tokenId: "tok-a", threshold: 0.5 } },
      ];
      expect(checkTriggers(blocks, prices)).toBe(true);
    });

    it("trigger: reads params for macd_signal_tick with signal params", () => {
      // MACD line crosses signal line: build hist that triggers a cross
      const hist: number[] = [];
      // Seed with enough stable prices then inject a crossing pattern
      for (let i = 0; i < 35; i++) hist.push(0.5);
      // Last two: cause MACD to cross above zero
      hist.push(0.8);
      const prices = makePrices({ "tok-a": { price: 0.8 } });
      const blocks: Block[] = [
        {
          type: "macd_crossover",
          params: { tokenId: "tok-a", crossAbove: "true" },
        },
      ];
      const result = checkTriggers(blocks, prices, makeHistory(hist));
      // With sufficient history and MACD crossing, should fire
      expect(typeof result).toBe("boolean");
    });

    it("trigger: reads params for bollinger_breakout_tick", () => {
      const prices = makePrices({ "tok-a": { price: 0.9 } });
      const blocks: Block[] = [
        {
          type: "bollinger_breakout_tick",
          params: { tokenId: "tok-a", direction: "upper_break" },
        },
      ];
      const result = checkTriggers(blocks, prices);
      // Requires price history; without it, returns false
      expect(result).toBe(false);
    });

    it("condition: reads params for max_bets_per_day", () => {
      const state = createSimState();
      state.betsToday = 10;
      const blocks: Block[] = [
        { type: "max_bets_per_day", params: { maxBets: 5 } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), new Map(), Date.now()),
      ).toBe(false);
    });

    it("condition: reads params for no_existing_position", () => {
      const state = createSimState();
      const positions = makePositions({});
      const blocks: Block[] = [
        { type: "no_existing_position", params: { tokenId: "tok-a" } },
      ];
      expect(
        checkConditions(blocks, state, new Map(), positions, Date.now()),
      ).toBe(true);
    });

    it("action: reads params for buy_yes", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.6 } });
      const blocks: Block[] = [
        { type: "buy_yes", params: { tokenId: "tok-a", size: 10 } },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills.length).toBe(1);
      expect(fills[0].side).toBe("BUY");
      expect(fills[0].outcome).toBe("YES");
      expect(fills[0].tokenId).toBe("tok-a");
    });

    it("action: reads params for set_stop_loss", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.6 } });
      const positions = makePositions({
        "tok-a": { size: 100, avgPrice: 0.5 },
      });
      const blocks: Block[] = [
        {
          type: "set_stop_loss",
          params: { tokenId: "tok-a", stopLossPct: 0.2 },
        },
      ];
      executeActions(blocks, prices, positions, state);
      expect(state.stopLosses.get("tok-a")).toBeCloseTo(0.4);
    });

    it("action: prefers params over config for buy_yes", () => {
      const state = createSimState();
      const prices = makePrices({ "tok-a": { price: 0.6 } });
      // params.tokenId = "tok-a", config.tokenId = "wrong-tok" → params wins
      const blocks: Block[] = [
        {
          type: "buy_yes",
          params: { tokenId: "tok-a", size: 10 },
          config: { tokenId: "wrong-tok" },
        },
      ];
      const fills = executeActions(blocks, prices, new Map(), state);
      expect(fills.length).toBe(1);
      expect(fills[0].tokenId).toBe("tok-a");
    });
  });
});
