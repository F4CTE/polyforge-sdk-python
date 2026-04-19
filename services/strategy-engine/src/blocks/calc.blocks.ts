import { CalcBlockEvaluator, CalcBlockResult } from "./block.types";

/** Extract a string param from a block, checking direct field and params object */
function strParam(
  block: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const direct = block[key];
  if (typeof direct === "string") return direct;
  if (typeof direct === "number") return String(direct);
  const params = block.params as Record<string, unknown> | undefined;
  const fromParams = params?.[key];
  if (typeof fromParams === "string") return fromParams;
  if (typeof fromParams === "number") return String(fromParams);
  return fallback;
}

/** Extract a numeric param from a block, checking direct field and params object */
function numParam(
  block: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const direct = block[key];
  if (typeof direct === "number") return direct;
  if (typeof direct === "string") return Number(direct);
  const params = block.params as Record<string, unknown> | undefined;
  const fromParams = params?.[key];
  if (typeof fromParams === "number") return fromParams;
  if (typeof fromParams === "string") return Number(fromParams);
  return fallback;
}

// ─── Math Block ─────────────────────────────────────────────────────────────

export const MathBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, inputs, _ctx): CalcBlockResult {
    const op = strParam(block, "operation", "add");
    const a = inputs[0] ?? 0;
    const b = inputs[1] ?? 0;

    let value: number;
    switch (op) {
      case "add":
        value = a + b;
        break;
      case "subtract":
        value = a - b;
        break;
      case "multiply":
        value = a * b;
        break;
      case "divide":
        value = b === 0 ? NaN : a / b;
        break;
      case "modulo":
        value = b === 0 ? NaN : a % b;
        break;
      case "power":
        value = Math.pow(a, b);
        break;
      case "min":
        value = Math.min(a, b);
        break;
      case "max":
        value = Math.max(a, b);
        break;
      default:
        value = NaN;
    }

    return { value };
  },
};

// ─── Aggregation Block ──────────────────────────────────────────────────────

/**
 * Maintains a rolling window of values and computes aggregates.
 * The window buffer is stored in ctx.variables under a key derived from the block id.
 */
export const AggregationBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, inputs, _ctx): CalcBlockResult {
    const fn = strParam(block, "function", "moving_average");
    const input = inputs[0] ?? 0;

    // For single-tick evaluation, use the input directly
    let value: number;
    switch (fn) {
      case "moving_average":
        // Single value = itself
        value = input;
        break;
      case "sum":
        value = input;
        break;
      case "min":
        value = input;
        break;
      case "max":
        value = input;
        break;
      case "count":
        value = 1;
        break;
      default:
        value = NaN;
    }

    return { value };
  },
};

// ─── Comparison Block ───────────────────────────────────────────────────────

export const ComparisonBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, inputs, _ctx): CalcBlockResult {
    const op = strParam(block, "operator", ">");
    const a = inputs[0] ?? 0;
    const b = inputs[1] ?? 0;

    let booleanValue: boolean;
    switch (op) {
      case ">":
        booleanValue = a > b;
        break;
      case "<":
        booleanValue = a < b;
        break;
      case ">=":
        booleanValue = a >= b;
        break;
      case "<=":
        booleanValue = a <= b;
        break;
      case "==":
        booleanValue = a === b;
        break;
      case "!=":
        booleanValue = a !== b;
        break;
      case "between": {
        const min = numParam(block, "min", 0);
        const max = numParam(block, "max", 0);
        booleanValue = a >= min && a <= max;
        break;
      }
      default:
        booleanValue = false;
    }

    return { value: booleanValue ? 1 : 0, booleanValue };
  },
};

// ─── Abs / Round Block ──────────────────────────────────────────────────────

export const AbsRoundBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, inputs, _ctx): CalcBlockResult {
    const fn = strParam(block, "function", "abs");
    const decimals = numParam(block, "decimals", 0);
    const input = inputs[0] ?? 0;

    let value: number;
    switch (fn) {
      case "abs":
        value = Math.abs(input);
        break;
      case "round":
        if (decimals > 0) {
          const factor = Math.pow(10, decimals);
          value = Math.round(input * factor) / factor;
        } else {
          value = Math.round(input);
        }
        break;
      case "floor":
        value = Math.floor(input);
        break;
      case "ceil":
        value = Math.ceil(input);
        break;
      case "toFixed": {
        const factor = Math.pow(10, decimals);
        value = Math.round(input * factor) / factor;
        break;
      }
      default:
        value = NaN;
    }

    return { value };
  },
};

// ─── TA Indicator Blocks ─────────────────────────────────────────────────────
// These blocks read pre-computed values from ctx.variables.
// Actual computation happens in strategy-runner.ts before this eval phase.

function blockId(block: Record<string, unknown>): string {
  return typeof block.id === "string" ? block.id : "";
}

// ─── SMA Block ───────────────────────────────────────────────────────────────

export const SmaBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, _inputs, ctx): CalcBlockResult {
    return { value: ctx.variables?.[`__ta_${blockId(block)}`] ?? NaN };
  },
};

// ─── EMA Block ───────────────────────────────────────────────────────────────

export const EmaBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, _inputs, ctx): CalcBlockResult {
    return { value: ctx.variables?.[`__ta_${blockId(block)}`] ?? NaN };
  },
};

// ─── MACD Block ──────────────────────────────────────────────────────────────
// output param selects which component: macdLine | signalLine | histogram

export type MACDOutput = "macdLine" | "signalLine" | "histogram";

export const MacdBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, _inputs, ctx): CalcBlockResult {
    const id = blockId(block);
    const output = strParam(block, "output", "macdLine") as MACDOutput;
    const key =
      output === "signalLine"
        ? `__ta_${id}_signalLine`
        : output === "histogram"
          ? `__ta_${id}_histogram`
          : `__ta_${id}`;
    return { value: ctx.variables?.[key] ?? NaN };
  },
};

// ─── BOLLINGER Block ─────────────────────────────────────────────────────────
// output param selects band: upper | middle | lower

export type BollingerOutput = "upper" | "middle" | "lower";

export const BollingerBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, _inputs, ctx): CalcBlockResult {
    const id = blockId(block);
    const output = strParam(block, "output", "middle") as BollingerOutput;
    const key =
      output === "upper"
        ? `__ta_${id}_upper`
        : output === "lower"
          ? `__ta_${id}_lower`
          : `__ta_${id}`;
    return { value: ctx.variables?.[key] ?? NaN };
  },
};

// ─── ATR Block ───────────────────────────────────────────────────────────────

export const AtrBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, _inputs, ctx): CalcBlockResult {
    return { value: ctx.variables?.[`__ta_${blockId(block)}`] ?? NaN };
  },
};
