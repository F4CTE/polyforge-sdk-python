import { describe, it, expect } from "vitest";
import {
  IfThenElseBlock,
  AndGateBlock,
  OrGateBlock,
  NotGateBlock,
  DelayBlock,
} from "./logic.blocks";
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

// ─── AND Gate ───────────────────────────────────────────────────────────────

describe("AndGateBlock", () => {
  it("returns true when all inputs are true", () => {
    const result = AndGateBlock.evaluate({}, [true, true], makeCtx());
    expect(result.value).toBe(true);
  });

  it("returns false when any input is false", () => {
    expect(AndGateBlock.evaluate({}, [true, false], makeCtx()).value).toBe(
      false,
    );
    expect(AndGateBlock.evaluate({}, [false, true], makeCtx()).value).toBe(
      false,
    );
  });

  it("returns false when all inputs are false", () => {
    const result = AndGateBlock.evaluate({}, [false, false], makeCtx());
    expect(result.value).toBe(false);
  });

  it("returns false when no inputs", () => {
    const result = AndGateBlock.evaluate({}, [], makeCtx());
    expect(result.value).toBe(false);
  });
});

// ─── OR Gate ────────────────────────────────────────────────────────────────

describe("OrGateBlock", () => {
  it("returns true when any input is true", () => {
    expect(OrGateBlock.evaluate({}, [true, false], makeCtx()).value).toBe(true);
    expect(OrGateBlock.evaluate({}, [false, true], makeCtx()).value).toBe(true);
  });

  it("returns true when all inputs are true", () => {
    expect(OrGateBlock.evaluate({}, [true, true], makeCtx()).value).toBe(true);
  });

  it("returns false when all inputs are false", () => {
    expect(OrGateBlock.evaluate({}, [false, false], makeCtx()).value).toBe(
      false,
    );
  });

  it("returns false when no inputs", () => {
    expect(OrGateBlock.evaluate({}, [], makeCtx()).value).toBe(false);
  });
});

// ─── NOT Gate ───────────────────────────────────────────────────────────────

describe("NotGateBlock", () => {
  it("inverts true to false", () => {
    expect(NotGateBlock.evaluate({}, [true], makeCtx()).value).toBe(false);
  });

  it("inverts false to true", () => {
    expect(NotGateBlock.evaluate({}, [false], makeCtx()).value).toBe(true);
  });

  it("returns true when no inputs", () => {
    expect(NotGateBlock.evaluate({}, [], makeCtx()).value).toBe(true);
  });
});

// ─── IF / THEN / ELSE ──────────────────────────────────────────────────────

describe("IfThenElseBlock", () => {
  it("routes to true output when condition is truthy", () => {
    const result = IfThenElseBlock.evaluate(
      { condition: "1 > 0" },
      [],
      makeCtx(),
    );
    expect(result.value).toBe(true);
    expect(result.activeOutput).toBe("true");
  });

  it("routes to false output when condition is falsy", () => {
    const result = IfThenElseBlock.evaluate(
      { condition: "1 > 2" },
      [],
      makeCtx(),
    );
    expect(result.value).toBe(false);
    expect(result.activeOutput).toBe("false");
  });

  it("uses variables from context", () => {
    const ctx = makeCtx({ variables: { price: 0.75 } });
    const result = IfThenElseBlock.evaluate(
      { condition: "price > 0.5" },
      [],
      ctx,
    );
    expect(result.value).toBe(true);
    expect(result.activeOutput).toBe("true");
  });

  it("returns false for empty condition", () => {
    const result = IfThenElseBlock.evaluate({ condition: "" }, [], makeCtx());
    expect(result.value).toBe(false);
    expect(result.activeOutput).toBe("false");
  });

  it("returns false for invalid expression", () => {
    const result = IfThenElseBlock.evaluate(
      { condition: "invalid!!!" },
      [],
      makeCtx(),
    );
    expect(result.value).toBe(false);
    expect(result.activeOutput).toBe("false");
  });

  it("reads condition from params.condition", () => {
    const result = IfThenElseBlock.evaluate(
      { params: { condition: "2 + 2 == 4" } },
      [],
      makeCtx(),
    );
    expect(result.value).toBe(true);
  });
});

// ─── Delay Block ────────────────────────────────────────────────────────────

describe("DelayBlock", () => {
  it("passes through input value", () => {
    const result = DelayBlock.evaluate({ seconds: 5 }, [true], makeCtx());
    expect(result.value).toBe(true);
  });

  it("passes through false input", () => {
    const result = DelayBlock.evaluate({ seconds: 5 }, [false], makeCtx());
    expect(result.value).toBe(false);
  });

  it("reports delayed output when seconds > 0", () => {
    const result = DelayBlock.evaluate({ seconds: 10 }, [true], makeCtx());
    expect(result.activeOutput).toBe("delayed");
  });

  it("reads seconds from params.seconds", () => {
    const result = DelayBlock.evaluate(
      { params: { seconds: 3 } },
      [true],
      makeCtx(),
    );
    expect(result.value).toBe(true);
    expect(result.activeOutput).toBe("delayed");
  });

  it("returns no activeOutput when seconds is 0", () => {
    const result = DelayBlock.evaluate({ seconds: 0 }, [true], makeCtx());
    expect(result.value).toBe(true);
    expect(result.activeOutput).toBeUndefined();
  });

  it("defaults to false when no inputs provided", () => {
    const result = DelayBlock.evaluate({ seconds: 5 }, [], makeCtx());
    expect(result.value).toBe(false);
  });
});

// ─── Edge Cases: missing/null inputs ─────────────────────────────────────────

describe("Logic blocks — edge cases", () => {
  it("IfThenElseBlock: uses state variables for condition evaluation", () => {
    const ctx = makeCtx({
      state: {
        betsToday: 10,
        dailyPnl: -50,
        consecutiveLoss: 3,
        consecutiveWin: 0,
        lastTradeAt: 0,
        tradedTokensToday: [],
        totalOrders: 25,
      },
    });
    const result = IfThenElseBlock.evaluate(
      { condition: "betsToday > 5" },
      [],
      ctx,
    );
    expect(result.value).toBe(true);
    expect(result.activeOutput).toBe("true");
  });

  it("IfThenElseBlock: whitespace-only condition returns false", () => {
    const result = IfThenElseBlock.evaluate(
      { condition: "   " },
      [],
      makeCtx(),
    );
    expect(result.value).toBe(false);
  });

  it("AndGateBlock: single true input returns true", () => {
    expect(AndGateBlock.evaluate({}, [true], makeCtx()).value).toBe(true);
  });

  it("AndGateBlock: single false input returns false", () => {
    expect(AndGateBlock.evaluate({}, [false], makeCtx()).value).toBe(false);
  });

  it("OrGateBlock: single true input returns true", () => {
    expect(OrGateBlock.evaluate({}, [true], makeCtx()).value).toBe(true);
  });

  it("OrGateBlock: single false input returns false", () => {
    expect(OrGateBlock.evaluate({}, [false], makeCtx()).value).toBe(false);
  });

  it("NotGateBlock: multiple inputs only inverts the first", () => {
    // First input is true, so result is false (ignores second input)
    expect(NotGateBlock.evaluate({}, [true, false], makeCtx()).value).toBe(
      false,
    );
  });
});
