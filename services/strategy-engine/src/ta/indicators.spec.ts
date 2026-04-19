import { describe, it, expect } from "vitest";
import {
  sma,
  ema,
  rsiWilder,
  macd,
  bollingerBands,
  atr,
  vwap,
} from "./indicators";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round(v: number, dp = 4): number {
  return Math.round(v * 10 ** dp) / 10 ** dp;
}

/** Generates an arithmetic price series: start, start+step, start+2*step, ... */
function linear(start: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

// ─── SMA ──────────────────────────────────────────────────────────────────────

describe("sma", () => {
  it("computes average of last N prices", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4); // (3+4+5)/3
  });

  it("returns NaN when fewer prices than period", () => {
    expect(sma([1, 2], 5)).toBeNaN();
  });

  it("returns NaN for period 0", () => {
    expect(sma([1, 2, 3], 0)).toBeNaN();
  });

  it("returns NaN for negative period", () => {
    expect(sma([1, 2, 3], -1)).toBeNaN();
  });

  it("returns the single value when period equals array length", () => {
    expect(sma([10, 20, 30], 3)).toBe(20);
  });

  it("handles flat prices", () => {
    expect(sma([5, 5, 5, 5, 5], 5)).toBe(5);
  });

  it("returns NaN for empty array", () => {
    expect(sma([], 3)).toBeNaN();
  });

  it("uses only the last N values from a longer series", () => {
    // [1,2,3,4,5,6] last 3 = [4,5,6] avg = 5
    expect(sma([1, 2, 3, 4, 5, 6], 3)).toBe(5);
  });
});

// ─── EMA ──────────────────────────────────────────────────────────────────────

describe("ema", () => {
  it("returns NaN when fewer prices than period", () => {
    expect(ema([1, 2], 5)).toBeNaN();
  });

  it("returns NaN for period 0", () => {
    expect(ema([1, 2, 3], 0)).toBeNaN();
  });

  it("equals the price for a series of 1 when period=1", () => {
    expect(ema([42], 1)).toBe(42);
  });

  it("equals SMA seed when exactly period values", () => {
    // EMA with no extra data = seed = SMA
    expect(ema([2, 4, 6], 3)).toBeCloseTo(4, 4);
  });

  it("weights recent prices more than older ones", () => {
    // Spike at end → EMA should be higher than at beginning
    const low = ema([10, 10, 10, 10, 10], 3);
    const spiked = ema([10, 10, 10, 10, 50], 3);
    expect(spiked).toBeGreaterThan(low);
  });

  it("converges toward a constant price", () => {
    const prices = Array(20).fill(100);
    expect(ema(prices, 5)).toBeCloseTo(100, 4);
  });

  it("handles flat prices", () => {
    expect(ema([7, 7, 7, 7, 7], 5)).toBeCloseTo(7, 5);
  });
});

// ─── RSI ──────────────────────────────────────────────────────────────────────

describe("rsiWilder", () => {
  it("returns NaN when insufficient data (need period+1 values)", () => {
    expect(rsiWilder([50, 51, 52], 14)).toBeNaN();
  });

  it("returns NaN for period 0", () => {
    expect(rsiWilder([1, 2, 3], 0)).toBeNaN();
  });

  it("returns 100 when all moves are gains (no losses)", () => {
    const prices = linear(1, 1, 16); // 1,2,3,...,16
    expect(rsiWilder(prices, 14)).toBe(100);
  });

  it("returns 0 when all moves are losses (no gains)", () => {
    const prices = linear(20, -1, 16); // 20,19,...,5
    expect(rsiWilder(prices, 14)).toBe(0);
  });

  it("returns ~50 for alternating gains/losses of equal size", () => {
    // Alternating +1 / -1 for enough bars
    const prices: number[] = [50];
    for (let i = 0; i < 30; i++) {
      prices.push(i % 2 === 0 ? prices[i] + 1 : prices[i] - 1);
    }
    const r = rsiWilder(prices, 14);
    expect(r).toBeGreaterThan(40);
    expect(r).toBeLessThan(60);
  });

  it("stays in [0, 100] range", () => {
    const prices = [
      44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45, 45.1, 45.15, 43.61,
      44.33, 44.83, 45, 45.1,
    ];
    const r = rsiWilder(prices, 14);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(100);
  });

  it("handles single-change dataset (period 1)", () => {
    const r = rsiWilder([10, 15], 1);
    expect(r).toBe(100);
  });
});

// ─── MACD ─────────────────────────────────────────────────────────────────────

describe("macd", () => {
  it("returns NaN fields when insufficient data", () => {
    const result = macd([1, 2, 3], 12, 26, 9);
    expect(result.macdLine).toBeNaN();
    expect(result.signalLine).toBeNaN();
    expect(result.histogram).toBeNaN();
  });

  it("histogram equals macdLine minus signalLine", () => {
    const prices = linear(10, 0.5, 50);
    const result = macd(prices, 12, 26, 9);
    expect(round(result.histogram, 8)).toBe(
      round(result.macdLine - result.signalLine, 8),
    );
  });

  it("macdLine is positive when fast EMA > slow EMA (uptrend)", () => {
    // Strong uptrend: fast EMA will be above slow EMA
    const prices = linear(1, 2, 50);
    const result = macd(prices, 12, 26, 9);
    expect(result.macdLine).toBeGreaterThan(0);
  });

  it("macdLine is negative when fast EMA < slow EMA (downtrend)", () => {
    const prices = linear(100, -2, 50);
    const result = macd(prices, 12, 26, 9);
    expect(result.macdLine).toBeLessThan(0);
  });

  it("works with minimum required data", () => {
    // Need slow + signal - 1 = 26 + 9 - 1 = 34 bars
    const prices = linear(10, 0.1, 34);
    const result = macd(prices, 12, 26, 9);
    expect(result.macdLine).not.toBeNaN();
    expect(result.signalLine).not.toBeNaN();
  });

  it("macdLine is near zero for flat prices", () => {
    const prices = Array(50).fill(100);
    const result = macd(prices, 12, 26, 9);
    expect(Math.abs(result.macdLine)).toBeCloseTo(0, 6);
  });
});

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

describe("bollingerBands", () => {
  it("returns NaN fields when insufficient data", () => {
    const result = bollingerBands([1, 2], 20, 2);
    expect(result.upper).toBeNaN();
    expect(result.middle).toBeNaN();
    expect(result.lower).toBeNaN();
  });

  it("middle equals SMA of last period prices", () => {
    const prices = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = bollingerBands(prices, 8, 2);
    expect(round(result.middle, 4)).toBe(round(sma(prices, 8), 4));
  });

  it("upper is above middle and lower is below middle", () => {
    const prices = linear(10, 1, 20);
    const result = bollingerBands(prices, 20, 2);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.lower).toBeLessThan(result.middle);
  });

  it("bands are symmetric around the middle", () => {
    const prices = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = bollingerBands(prices, 8, 2);
    const upDiff = result.upper - result.middle;
    const loDiff = result.middle - result.lower;
    expect(round(upDiff, 8)).toBeCloseTo(round(loDiff, 8), 8);
  });

  it("bands collapse to middle for flat prices (zero variance)", () => {
    const prices = Array(20).fill(50);
    const result = bollingerBands(prices, 20, 2);
    expect(result.upper).toBe(50);
    expect(result.middle).toBe(50);
    expect(result.lower).toBe(50);
  });

  it("respects custom stdDev multiplier", () => {
    const prices = linear(1, 1, 20);
    const bb2 = bollingerBands(prices, 20, 2);
    const bb3 = bollingerBands(prices, 20, 3);
    expect(bb3.upper).toBeGreaterThan(bb2.upper);
    expect(bb3.lower).toBeLessThan(bb2.lower);
  });
});

// ─── ATR ──────────────────────────────────────────────────────────────────────

describe("atr", () => {
  it("returns NaN when insufficient data (need period+1 candles)", () => {
    const h = [10, 11, 12];
    const l = [9, 10, 11];
    const c = [9.5, 10.5, 11.5];
    expect(atr(h, l, c, 14)).toBeNaN();
  });

  it("returns NaN for period 0", () => {
    expect(atr([10], [9], [9.5], 0)).toBeNaN();
  });

  it("computes correct ATR for a known simple case (no gaps)", () => {
    // Flat candles: high=11, low=10, close=10.5 always
    // TR = max(HL=1, |11-10.5|=0.5, |10-10.5|=0.5) = 1 for every bar
    const n = 15;
    const highs = Array(n).fill(11);
    const lows = Array(n).fill(10);
    const closes = Array(n).fill(10.5);
    expect(round(atr(highs, lows, closes, 14), 4)).toBe(1);
  });

  it("is always positive for reasonable price data", () => {
    const h = linear(15, 1, 20);
    const l = linear(10, 1, 20);
    const c = linear(12, 1, 20);
    expect(atr(h, l, c, 14)).toBeGreaterThan(0);
  });

  it("handles mismatched array lengths gracefully (uses shortest)", () => {
    const h = [15, 16, 17];
    const l = [10, 11, 12, 13];
    const c = [12, 13, 14, 15, 16];
    // shortest = 3, period=2 → need 3, should work
    const result = atr(h, l, c, 2);
    expect(result).not.toBeNaN();
    expect(result).toBeGreaterThan(0);
  });
});

// ─── VWAP ─────────────────────────────────────────────────────────────────────

describe("vwap", () => {
  it("returns NaN for empty arrays", () => {
    expect(vwap([], [])).toBeNaN();
  });

  it("returns NaN when total volume is zero", () => {
    expect(vwap([100, 200], [0, 0])).toBeNaN();
  });

  it("computes weighted average correctly", () => {
    // price 10 with vol 100, price 20 with vol 200
    // VWAP = (10*100 + 20*200) / 300 = 5000/300 ≈ 16.667
    expect(round(vwap([10, 20], [100, 200]), 4)).toBe(16.6667);
  });

  it("equals price when single data point", () => {
    expect(vwap([42], [1000])).toBe(42);
  });

  it("equals SMA when all volumes are equal", () => {
    const prices = [10, 20, 30, 40];
    const volumes = [1, 1, 1, 1];
    const expectedSma = (10 + 20 + 30 + 40) / 4;
    expect(vwap(prices, volumes)).toBe(expectedSma);
  });

  it("uses shortest array when lengths differ", () => {
    // 2 prices, 3 volumes → uses first 2 pairs
    const result = vwap([10, 20], [100, 100, 100]);
    expect(result).toBe(15);
  });
});
