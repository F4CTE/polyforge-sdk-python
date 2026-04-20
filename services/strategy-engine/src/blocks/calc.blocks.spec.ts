import { describe, it, expect } from "vitest";
import {
  MathBlockEvaluator,
  AggregationBlockEvaluator,
  ComparisonBlockEvaluator,
  AbsRoundBlockEvaluator,
} from "./calc.blocks";
import type { EvalContext, StrategyState } from "./block.types";

function makeCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  const state: StrategyState = {
    betsToday: 0,
    dailyPnl: 0,
    consecutiveLoss: 0,
    consecutiveWin: 0,
    lastTradeAt: 0,
    tradedTokensToday: [],
    totalOrders: 0,
  };

  return {
    strategyId: "test-strategy",
    userId: "test-user",
    state,
    now: Date.now(),
    variables: {},
    ...overrides,
  };
}

// ─── Math Block ─────────────────────────────────────────────────────────────

describe("MathBlockEvaluator", () => {
  it("adds two numbers", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "add" },
      [3, 5],
      makeCtx(),
    );
    expect(result.value).toBe(8);
  });

  it("subtracts two numbers", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "subtract" },
      [10, 3],
      makeCtx(),
    );
    expect(result.value).toBe(7);
  });

  it("multiplies two numbers", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "multiply" },
      [4, 7],
      makeCtx(),
    );
    expect(result.value).toBe(28);
  });

  it("divides two numbers", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "divide" },
      [20, 4],
      makeCtx(),
    );
    expect(result.value).toBe(5);
  });

  it("returns NaN for divide by zero", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "divide" },
      [10, 0],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });

  it("computes modulo", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "modulo" },
      [10, 3],
      makeCtx(),
    );
    expect(result.value).toBe(1);
  });

  it("returns NaN for modulo by zero", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "modulo" },
      [10, 0],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });

  it("computes power", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "power" },
      [2, 8],
      makeCtx(),
    );
    expect(result.value).toBe(256);
  });

  it("computes min", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "min" },
      [5, 3],
      makeCtx(),
    );
    expect(result.value).toBe(3);
  });

  it("computes max", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "max" },
      [5, 3],
      makeCtx(),
    );
    expect(result.value).toBe(5);
  });

  it("reads operation from params.operation", () => {
    const result = MathBlockEvaluator.evaluate(
      { params: { operation: "multiply" } },
      [6, 7],
      makeCtx(),
    );
    expect(result.value).toBe(42);
  });

  it("defaults to add when no operation specified", () => {
    const result = MathBlockEvaluator.evaluate({}, [3, 4], makeCtx());
    expect(result.value).toBe(7);
  });
});

// ─── Aggregation Block ──────────────────────────────────────────────────────

describe("AggregationBlockEvaluator", () => {
  it("computes moving average (single value)", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { function: "moving_average", windowSize: 20 },
      [42],
      makeCtx(),
    );
    expect(result.value).toBe(42);
  });

  it("computes sum (single value)", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { function: "sum", windowSize: 10 },
      [15],
      makeCtx(),
    );
    expect(result.value).toBe(15);
  });

  it("computes min (single value)", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { function: "min", windowSize: 5 },
      [7],
      makeCtx(),
    );
    expect(result.value).toBe(7);
  });

  it("computes max (single value)", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { function: "max", windowSize: 5 },
      [99],
      makeCtx(),
    );
    expect(result.value).toBe(99);
  });

  it("computes count", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { function: "count", windowSize: 10 },
      [50],
      makeCtx(),
    );
    expect(result.value).toBe(1);
  });

  it("reads function from params.function", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { params: { function: "sum", windowSize: 5 } },
      [25],
      makeCtx(),
    );
    expect(result.value).toBe(25);
  });
});

// ─── Comparison Block ───────────────────────────────────────────────────────

describe("ComparisonBlockEvaluator", () => {
  it("evaluates greater than", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: ">" },
      [5, 3],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(true);
    expect(result.value).toBe(1);
  });

  it("evaluates greater than (false)", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: ">" },
      [3, 5],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(false);
    expect(result.value).toBe(0);
  });

  it("evaluates less than", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: "<" },
      [3, 5],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(true);
  });

  it("evaluates greater than or equal", () => {
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: ">=" }, [5, 5], makeCtx())
        .booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: ">=" }, [6, 5], makeCtx())
        .booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: ">=" }, [4, 5], makeCtx())
        .booleanValue,
    ).toBe(false);
  });

  it("evaluates less than or equal", () => {
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "<=" }, [5, 5], makeCtx())
        .booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "<=" }, [4, 5], makeCtx())
        .booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "<=" }, [6, 5], makeCtx())
        .booleanValue,
    ).toBe(false);
  });

  it("evaluates equal", () => {
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "==" }, [5, 5], makeCtx())
        .booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "==" }, [5, 6], makeCtx())
        .booleanValue,
    ).toBe(false);
  });

  it("evaluates not equal", () => {
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "!=" }, [5, 6], makeCtx())
        .booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate({ operator: "!=" }, [5, 5], makeCtx())
        .booleanValue,
    ).toBe(false);
  });

  it("evaluates between", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: "between", min: 2, max: 8 },
      [5, 0],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(true);
  });

  it("evaluates between (outside range)", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: "between", min: 2, max: 8 },
      [10, 0],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(false);
  });

  it("evaluates between (edge cases)", () => {
    expect(
      ComparisonBlockEvaluator.evaluate(
        { operator: "between", min: 2, max: 8 },
        [2, 0],
        makeCtx(),
      ).booleanValue,
    ).toBe(true);
    expect(
      ComparisonBlockEvaluator.evaluate(
        { operator: "between", min: 2, max: 8 },
        [8, 0],
        makeCtx(),
      ).booleanValue,
    ).toBe(true);
  });

  it("reads operator from params.operator", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { params: { operator: "<" } },
      [1, 10],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(true);
  });
});

// ─── AbsRound Block ────────────────────────────────────────────────────────

describe("AbsRoundBlockEvaluator", () => {
  it("computes absolute value of negative", () => {
    const result = AbsRoundBlockEvaluator.evaluate(
      { function: "abs" },
      [-7],
      makeCtx(),
    );
    expect(result.value).toBe(7);
  });

  it("computes absolute value of positive", () => {
    const result = AbsRoundBlockEvaluator.evaluate(
      { function: "abs" },
      [7],
      makeCtx(),
    );
    expect(result.value).toBe(7);
  });

  it("rounds to nearest integer", () => {
    expect(
      AbsRoundBlockEvaluator.evaluate({ function: "round" }, [3.7], makeCtx())
        .value,
    ).toBe(4);
    expect(
      AbsRoundBlockEvaluator.evaluate({ function: "round" }, [3.2], makeCtx())
        .value,
    ).toBe(3);
  });

  it("rounds to specified decimals", () => {
    const result = AbsRoundBlockEvaluator.evaluate(
      { function: "round", decimals: 2 },
      [3.14159],
      makeCtx(),
    );
    expect(result.value).toBeCloseTo(3.14, 10);
  });

  it("floors value", () => {
    expect(
      AbsRoundBlockEvaluator.evaluate({ function: "floor" }, [3.9], makeCtx())
        .value,
    ).toBe(3);
    expect(
      AbsRoundBlockEvaluator.evaluate({ function: "floor" }, [-3.1], makeCtx())
        .value,
    ).toBe(-4);
  });

  it("ceils value", () => {
    expect(
      AbsRoundBlockEvaluator.evaluate({ function: "ceil" }, [3.1], makeCtx())
        .value,
    ).toBe(4);
    expect(
      AbsRoundBlockEvaluator.evaluate({ function: "ceil" }, [-3.9], makeCtx())
        .value,
    ).toBe(-3);
  });

  it("applies toFixed", () => {
    const result = AbsRoundBlockEvaluator.evaluate(
      { function: "toFixed", decimals: 2 },
      [3.14159],
      makeCtx(),
    );
    expect(result.value).toBeCloseTo(3.14, 10);
  });

  it("reads function from params.function", () => {
    const result = AbsRoundBlockEvaluator.evaluate(
      { params: { function: "abs" } },
      [-42],
      makeCtx(),
    );
    expect(result.value).toBe(42);
  });

  it("defaults to abs", () => {
    const result = AbsRoundBlockEvaluator.evaluate({}, [-5], makeCtx());
    expect(result.value).toBe(5);
  });

  it("returns NaN for unknown function", () => {
    const result = AbsRoundBlockEvaluator.evaluate(
      { function: "unknown_fn" },
      [5],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });
});

// ─── Edge Cases: NaN propagation ────────────────────────────────────────────

describe("Calc blocks — NaN propagation", () => {
  it("MathBlock: NaN input propagates through add", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "add" },
      [NaN, 5],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });

  it("MathBlock: NaN input propagates through multiply", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "multiply" },
      [3, NaN],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });

  it("MathBlock: returns NaN for unknown operation", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "unknown_op" },
      [3, 5],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });

  it("ComparisonBlock: returns false for unknown operator", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: "invalid" },
      [3, 5],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(false);
    expect(result.value).toBe(0);
  });

  it("ComparisonBlock: between reads from params.min and params.max", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: "between", params: { min: 1, max: 10 } },
      [5, 0],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(true);
  });

  it("AggregationBlock: returns NaN for unknown function", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { function: "unknown_agg" },
      [5],
      makeCtx(),
    );
    expect(result.value).toBeNaN();
  });

  it("AggregationBlock: reads from params.function and params.windowSize", () => {
    const result = AggregationBlockEvaluator.evaluate(
      { params: { function: "count", windowSize: 10 } },
      [42],
      makeCtx(),
    );
    expect(result.value).toBe(1);
  });

  it("MathBlock: handles missing inputs (defaults to 0)", () => {
    const result = MathBlockEvaluator.evaluate(
      { operation: "add" },
      [],
      makeCtx(),
    );
    expect(result.value).toBe(0);
  });

  it("ComparisonBlock: handles missing inputs (defaults to 0)", () => {
    const result = ComparisonBlockEvaluator.evaluate(
      { operator: "==" },
      [],
      makeCtx(),
    );
    expect(result.booleanValue).toBe(true); // 0 === 0
    expect(result.value).toBe(1);
  });
});

// ─── TA Indicator Blocks ─────────────────────────────────────────────────────

import {
  SmaBlockEvaluator,
  EmaBlockEvaluator,
  MacdBlockEvaluator,
  BollingerBlockEvaluator,
  AtrBlockEvaluator,
} from "./calc.blocks";

describe("SmaBlockEvaluator", () => {
  it("returns pre-computed value from ctx.variables", () => {
    const ctx = makeCtx({ variables: { __ta_sma1: 0.55 } });
    const result = SmaBlockEvaluator.evaluate({ id: "sma1" }, [], ctx);
    expect(result.value).toBe(0.55);
  });

  it("returns NaN when ctx.variables key is missing", () => {
    const result = SmaBlockEvaluator.evaluate({ id: "sma1" }, [], makeCtx());
    expect(result.value).toBeNaN();
  });
});

describe("EmaBlockEvaluator", () => {
  it("returns pre-computed value from ctx.variables", () => {
    const ctx = makeCtx({ variables: { __ta_ema1: 0.62 } });
    const result = EmaBlockEvaluator.evaluate({ id: "ema1" }, [], ctx);
    expect(result.value).toBe(0.62);
  });

  it("returns NaN when ctx.variables key is missing", () => {
    const result = EmaBlockEvaluator.evaluate({ id: "ema1" }, [], makeCtx());
    expect(result.value).toBeNaN();
  });
});

describe("MacdBlockEvaluator", () => {
  it("returns macdLine by default", () => {
    const ctx = makeCtx({
      variables: {
        __ta_m1: 0.01,
        __ta_m1_signalLine: 0.008,
        __ta_m1_histogram: 0.002,
      },
    });
    expect(MacdBlockEvaluator.evaluate({ id: "m1" }, [], ctx).value).toBe(0.01);
  });

  it("returns signalLine when output=signalLine", () => {
    const ctx = makeCtx({
      variables: {
        __ta_m1: 0.01,
        __ta_m1_signalLine: 0.008,
        __ta_m1_histogram: 0.002,
      },
    });
    expect(
      MacdBlockEvaluator.evaluate({ id: "m1", output: "signalLine" }, [], ctx)
        .value,
    ).toBeCloseTo(0.008);
  });

  it("returns histogram when output=histogram", () => {
    const ctx = makeCtx({
      variables: {
        __ta_m1: 0.01,
        __ta_m1_signalLine: 0.008,
        __ta_m1_histogram: 0.002,
      },
    });
    expect(
      MacdBlockEvaluator.evaluate({ id: "m1", output: "histogram" }, [], ctx)
        .value,
    ).toBeCloseTo(0.002);
  });

  it("returns NaN when variables are missing", () => {
    expect(
      MacdBlockEvaluator.evaluate({ id: "m1" }, [], makeCtx()).value,
    ).toBeNaN();
  });
});

describe("BollingerBlockEvaluator", () => {
  it("returns middle band by default", () => {
    const ctx = makeCtx({
      variables: {
        __ta_b1: 0.5,
        __ta_b1_upper: 0.6,
        __ta_b1_lower: 0.4,
      },
    });
    expect(BollingerBlockEvaluator.evaluate({ id: "b1" }, [], ctx).value).toBe(
      0.5,
    );
  });

  it("returns upper band when output=upper", () => {
    const ctx = makeCtx({
      variables: {
        __ta_b1: 0.5,
        __ta_b1_upper: 0.6,
        __ta_b1_lower: 0.4,
      },
    });
    expect(
      BollingerBlockEvaluator.evaluate({ id: "b1", output: "upper" }, [], ctx)
        .value,
    ).toBe(0.6);
  });

  it("returns lower band when output=lower", () => {
    const ctx = makeCtx({
      variables: {
        __ta_b1: 0.5,
        __ta_b1_upper: 0.6,
        __ta_b1_lower: 0.4,
      },
    });
    expect(
      BollingerBlockEvaluator.evaluate({ id: "b1", output: "lower" }, [], ctx)
        .value,
    ).toBe(0.4);
  });

  it("returns NaN when variables are missing", () => {
    expect(
      BollingerBlockEvaluator.evaluate({ id: "b1" }, [], makeCtx()).value,
    ).toBeNaN();
  });
});

describe("AtrBlockEvaluator", () => {
  it("returns pre-computed value from ctx.variables", () => {
    const ctx = makeCtx({ variables: { __ta_atr1: 0.03 } });
    expect(AtrBlockEvaluator.evaluate({ id: "atr1" }, [], ctx).value).toBe(
      0.03,
    );
  });

  it("returns NaN when ctx.variables key is missing", () => {
    expect(
      AtrBlockEvaluator.evaluate({ id: "atr1" }, [], makeCtx()).value,
    ).toBeNaN();
  });
});
