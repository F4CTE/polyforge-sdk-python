import { Logger } from "@nestjs/common";

const logger = new Logger("WasmEvaluator");

let wasmEngine: any = null;

/**
 * Lazy-load the WASM engine. Returns null if not available (graceful fallback to JS).
 */
function getEngine(): any {
  if (wasmEngine !== null) return wasmEngine;
  try {
    wasmEngine = require("@polyforge/engine");
    logger.log("WASM strategy engine loaded successfully");
  } catch (err: any) {
    logger.warn(`WASM engine not available, using JS fallback: ${err?.message}`);
    wasmEngine = false; // marker: tried and failed
  }
  return wasmEngine || null;
}

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
 * Returns null if the WASM engine is not available (caller should use JS fallback).
 */
export function wasmEvaluateTick(
  safety: any[],
  triggers: any[],
  conditions: any[],
  actions: any[],
  context: WasmEvalContext,
): WasmEvalResult | null {
  const engine = getEngine();
  if (!engine) return null;

  try {
    return engine.evaluateTick(safety, triggers, conditions, actions, context);
  } catch (err: any) {
    logger.error(`WASM evaluation failed: ${err?.message}`);
    return null; // fallback to JS
  }
}

/** Check if the WASM engine is available */
export function isWasmAvailable(): boolean {
  return getEngine() !== null;
}
