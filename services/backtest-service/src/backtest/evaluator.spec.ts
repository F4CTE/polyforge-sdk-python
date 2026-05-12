import { describe, it, expect } from "vitest";
import {
  createSimState,
  checkSafety,
  checkTriggers,
  checkConditions,
  executeActions,
  checkAutoExits,
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

  it("returns false for unknown safety block type (fail closed)", () => {
    const state = createSimState();
    const blocks: Block[] = [{ type: "unknown_safety_block" }];
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

  it("returns false for unknown trigger block type (fail closed)", () => {
    const blocks: Block[] = [{ type: "unknown_trigger_type" }];
    expect(checkTriggers(blocks, new Map())).toBe(false);
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

  it("returns false for unknown condition block type (fail closed)", () => {
    const state = createSimState();
    const blocks: Block[] = [{ type: "unknown_condition_type" }];
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

  it("returns empty fills for unknown action block type (graceful skip)", () => {
    const state = createSimState();
    const blocks: Block[] = [{ type: "unknown_action_type" }];
    const fills = executeActions(blocks, new Map(), new Map(), state);
    expect(fills).toEqual([]);
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
      // Build a series where the last bar causes a crossover
      // 20 bars of flat price then sudden spike causes fast(5) > slow(10)
      const hist = [
        0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
        0.5, 0.5, 0.5, 0.5, 0.5, 0.9,
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
      // 20 bars at 0.5 → bands at 0.5 ± 0. Then spike to 0.9 → above upper
      const hist = Array.from({ length: 20 }, () => 0.5);
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
      const hist = Array.from({ length: 20 }, () => 0.5);
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
      const hist = Array.from({ length: 20 }, () => 0.5);
      const prices = makePrices({ "tok-a": { price: 0.5 } });
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
});
