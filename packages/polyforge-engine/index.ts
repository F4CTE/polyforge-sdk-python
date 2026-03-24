// Rust WASM strategy evaluation engine — NO FALLBACK
// SECURITY: If the WASM module is not built, the process crashes.
// This ensures we never run strategy evaluation in JS with GC pauses.
// Build with: cd packages/polyforge-engine && bash build.sh

const wasmModule = require('./pkg/polyforge_engine');

export interface EvalContext {
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

export interface EvalResult {
  safety_passed: boolean;
  safety_reason: string | null;
  triggered: boolean;
  conditions_met: boolean;
  actions: ActionIntent[];
}

export interface ActionIntent {
  action_type: string;
  side: string;
  outcome: string;
  size: number;
  price: number;
}

export interface Block {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export function evaluateTick(
  safety: Block[],
  triggers: Block[],
  conditions: Block[],
  actions: Block[],
  context: EvalContext,
): EvalResult {
  const result = wasmModule.evaluate_tick(
    JSON.stringify(safety),
    JSON.stringify(triggers),
    JSON.stringify(conditions),
    JSON.stringify(actions),
    JSON.stringify(context),
  );
  return JSON.parse(result);
}
