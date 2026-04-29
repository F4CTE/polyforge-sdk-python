import { Logger } from "@nestjs/common";
import { createRequire } from "node:module";
import {
  assertWasmEvaluationBudget,
  MAX_WASM_EVALUATION_MS,
} from "./wasm-evaluation-limits";

const logger = new Logger("WasmEvaluator");

// Load WASM engine — MANDATORY, no fallback
const _require = createRequire(__filename);

interface WasmEngineModule {
  evaluateTick(
    safety: unknown[],
    triggers: unknown[],
    conditions: unknown[],
    actions: unknown[],
    context: unknown,
  ): WasmEvalResult;
}

const wasmEngine = (() => {
  try {
    const engine = _require("@polyforge/engine") as WasmEngineModule;
    logger.log("WASM strategy engine loaded — sandboxed evaluation active");
    return engine;
  } catch (err: unknown) {
    throw new Error(
      `SECURITY: @polyforge/engine WASM module is REQUIRED but not available: ${err instanceof Error ? err.message : String(err)}\n` +
        "The strategy-engine MUST use the Rust WASM evaluator for expression sandboxing. " +
        "Build with: cd packages/polyforge-engine && wasm-pack build --target nodejs",
      { cause: err },
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
  assertWasmEvaluationBudget([safety, triggers, conditions, actions]);
  const startedAt = Date.now();
  const result = wasmEngine.evaluateTick(
    safety,
    triggers,
    conditions,
    actions,
    context,
  );
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > MAX_WASM_EVALUATION_MS) {
    throw new Error(
      `WASM tick deadline exceeded: ${elapsedMs}ms/${MAX_WASM_EVALUATION_MS}ms`,
    );
  }
  return result;
}

/** Always true — WASM engine is mandatory */
export function isWasmAvailable(): boolean {
  return true;
}
