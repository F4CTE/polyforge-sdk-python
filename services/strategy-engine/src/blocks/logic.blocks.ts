import { evaluate as mathEvaluate } from "mathjs";
import {
  LogicBlockEvaluator,
  LogicBlockResult,
  EvalContext,
} from "./block.types";

/** Safe wrapper around expr-eval to prevent DoS via long/malicious expressions */
function safeEvaluate(
  expression: string,
  scope: Record<string, number>,
  maxLength = 200,
): number {
  if (expression.length > maxLength) {
    throw new Error(`Expression too long: ${expression.length} > ${maxLength}`);
  }
  // Reject potentially dangerous patterns and CPU-exhausting exponentiation
  if (
    /while|for|function|eval|require|import|__proto__|constructor|prototype/.test(
      expression,
    )
  ) {
    throw new Error("Expression contains forbidden keywords");
  }
  // Block nested exponentiation (e.g., 9^9^9) which causes CPU exhaustion
  if ((expression.match(/\^/g) || []).length > 2) {
    throw new Error("Expression contains too many exponentiation operators");
  }
  try {
    return Number(mathEvaluate(expression, scope));
  } catch {
    return 0; // Safe fallback
  }
}

// ─── IF / THEN / ELSE ──────────────────────────────────────────────────────

export const IfThenElseBlock: LogicBlockEvaluator = {
  evaluate(block, inputs, ctx): LogicBlockResult {
    const condition = String(
      block.condition ??
        (block.params as Record<string, unknown>)?.condition ??
        "",
    );
    if (!condition.trim()) {
      return { value: false, activeOutput: "false" };
    }

    try {
      const scope: Record<string, number> = {
        ...ctx.variables,
        dailyPnl: ctx.state.dailyPnl,
        betsToday: ctx.state.betsToday,
        consecutiveLoss: ctx.state.consecutiveLoss,
        consecutiveWin: ctx.state.consecutiveWin,
        totalOrders: ctx.state.totalOrders,
      };

      const result = safeEvaluate(condition, scope);
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
    const seconds = Number(
      block.seconds ?? (block.params as Record<string, unknown>)?.seconds ?? 0,
    );
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
