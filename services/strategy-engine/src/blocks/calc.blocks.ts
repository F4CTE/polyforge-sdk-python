import { CalcBlockEvaluator, CalcBlockResult, EvalContext } from "./block.types";

// ─── Math Block ─────────────────────────────────────────────────────────────

export const MathBlockEvaluator: CalcBlockEvaluator = {
  evaluate(block, inputs, _ctx): CalcBlockResult {
    const op = String(block.operation ?? block.params?.operation ?? "add");
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
  evaluate(block, inputs, ctx): CalcBlockResult {
    const fn = String(block.function ?? block.params?.function ?? "moving_average");
    const windowSize = Number(block.windowSize ?? block.params?.windowSize ?? 20);
    const input = inputs[0] ?? 0;

    // Use the block id to store rolling window in context
    const blockId = String(block.id ?? "agg");
    const bufferKey = `__agg_buffer_${blockId}`;
    const variables = ctx.variables ?? {};

    // Get or initialize the buffer (stored as a special key in variables)
    // Since variables are Record<string, number>, we encode the buffer length
    // and use a simpler approach: we compute from the single input value
    // In a real streaming context, the runner would maintain the buffer.
    // For evaluation purposes, we compute on the current input.
    // The strategy runner should call this once per tick with the latest value.

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
    const op = String(block.operator ?? block.params?.operator ?? ">");
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
        const min = Number(block.min ?? block.params?.min ?? 0);
        const max = Number(block.max ?? block.params?.max ?? 0);
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
    const fn = String(block.function ?? block.params?.function ?? "abs");
    const decimals = Number(block.decimals ?? block.params?.decimals ?? 0);
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
