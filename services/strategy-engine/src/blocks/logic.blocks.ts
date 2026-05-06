import { LogicBlockEvaluator, LogicBlockResult } from "./block.types";
import { safeEvaluate } from "../common/safe-evaluate";

// ─── IF / THEN / ELSE ──────────────────────────────────────────────────────

export const IfThenElseBlock: LogicBlockEvaluator = {
  evaluate(block, inputs, ctx): LogicBlockResult {
    const rawCondition =
      block.condition ??
      (block.params as Record<string, unknown> | undefined)?.condition ??
      "";
    const condition =
      typeof rawCondition === "string" || typeof rawCondition === "number"
        ? String(rawCondition)
        : "";
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
      const truthy = Number.isFinite(result) && result !== 0;
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
  evaluate(block, inputs, _ctx): LogicBlockResult {
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
