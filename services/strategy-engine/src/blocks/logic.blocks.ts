import { Parser } from "expr-eval";
import { LogicBlockEvaluator, LogicBlockResult, EvalContext } from "./block.types";

// ─── IF / THEN / ELSE ──────────────────────────────────────────────────────

export const IfThenElseBlock: LogicBlockEvaluator = {
  evaluate(block, inputs, ctx): LogicBlockResult {
    const condition = String(block.condition ?? block.params?.condition ?? "");
    if (!condition.trim()) {
      return { value: false, activeOutput: "false" };
    }

    try {
      const parser = new Parser();
      const scope: Record<string, number> = {
        ...ctx.variables,
        dailyPnl: ctx.state.dailyPnl,
        betsToday: ctx.state.betsToday,
        consecutiveLoss: ctx.state.consecutiveLoss,
        consecutiveWin: ctx.state.consecutiveWin,
        totalOrders: ctx.state.totalOrders,
      };

      const result = parser.evaluate(condition, scope);
      const truthy = Boolean(result);
      return { value: truthy, activeOutput: truthy ? "true" : "false" };
    } catch {
      return { value: false, activeOutput: "false" };
    }
  },
};

// ─── AND Gate ───────────────────────────────────────────────────────────────

export const AndGateBlock: LogicBlockEvaluator = {
  evaluate(_block, inputs): LogicBlockResult {
    const value = inputs.length > 0 && inputs.every(Boolean);
    return { value };
  },
};

// ─── OR Gate ────────────────────────────────────────────────────────────────

export const OrGateBlock: LogicBlockEvaluator = {
  evaluate(_block, inputs): LogicBlockResult {
    const value = inputs.some(Boolean);
    return { value };
  },
};

// ─── NOT Gate ───────────────────────────────────────────────────────────────

export const NotGateBlock: LogicBlockEvaluator = {
  evaluate(_block, inputs): LogicBlockResult {
    // Takes the first input and inverts it
    const value = inputs.length > 0 ? !inputs[0] : true;
    return { value };
  },
};

// ─── Delay Block ────────────────────────────────────────────────────────────

export const DelayBlock: LogicBlockEvaluator = {
  evaluate(block, inputs, ctx): LogicBlockResult {
    const seconds = Number(block.seconds ?? block.params?.seconds ?? 0);
    const delayMs = seconds * 1000;
    const inputValue = inputs.length > 0 ? inputs[0] : false;

    // The delay block passes through the input value.
    // Actual delay scheduling is handled by the strategy runner.
    // Here we just report the value and include delay metadata.
    return {
      value: inputValue,
      activeOutput: delayMs > 0 ? "delayed" : undefined,
    };
  },
};
