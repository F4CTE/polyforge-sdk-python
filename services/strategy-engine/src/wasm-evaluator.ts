import { Logger } from "@nestjs/common";

const logger = new Logger("WasmEvaluator");

// Load WASM engine — MANDATORY, no fallback
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wasmEngine = (() => {
  try {
    const engine = require("@polyforge/engine");
    logger.log("WASM strategy engine loaded — sandboxed evaluation active");
    return engine;
  } catch (err: any) {
    throw new Error(
      `SECURITY: @polyforge/engine WASM module is REQUIRED but not available: ${err?.message}\n` +
      "The strategy-engine MUST use the Rust WASM evaluator for expression sandboxing. " +
      "Build with: cd packages/polyforge-engine && wasm-pack build --target nodejs"
    );
  }
})();

export interface WasmEvalContext {
  current_price: number;
  best_bid: number;
  best_ask: number;
  spread: number;
  volume_24h: number;
  daily_pnl: number;
  total_exposure: number;
  open_positions: number;
  consecutive_losses: number;
  orders_today: number;
  variables: Record<string, number>;
}

export interface WasmEvalResult {
  safety_passed: boolean;
  safety_reason: string | null;
  triggered: boolean;
  conditions_met: boolean;
  actions: Array<{
    action_type: string;
    side: string;
    outcome: string;
    size: number;
    price: number;
  }>;
}

/**
 * Evaluate a strategy tick using the Rust WASM engine.
 * MANDATORY — throws if WASM engine is not available.
 */
export function wasmEvaluateTick(
  safety: any[],
  triggers: any[],
  conditions: any[],
  actions: any[],
  context: WasmEvalContext,
): WasmEvalResult {
  return wasmEngine.evaluateTick(safety, triggers, conditions, actions, context);
}

/** Always true — WASM engine is mandatory */
export function isWasmAvailable(): boolean {
  return true;
}
