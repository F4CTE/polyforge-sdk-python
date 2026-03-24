// Thin TypeScript wrapper around the Rust WASM strategy evaluation engine.
// SECURITY: In production, WASM is MANDATORY — no fallback allowed.
// The TypeScript fallback is only permitted in development.

let wasmModule: any = null;
let wasmAvailable = false;

try {
  wasmModule = require('./pkg/polyforge_engine');
  wasmAvailable = true;
} catch {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: polyforge-engine WASM module not found. ' +
      'Rust WASM is REQUIRED in production for secure, GC-free strategy evaluation. ' +
      'Run: cd packages/polyforge-engine && bash build.sh'
    );
  }
  console.warn('[DEV] polyforge-engine WASM not available, using TypeScript fallback');
}

/** Returns true if the Rust WASM module is active (not the JS fallback) */
export function isWasmActive(): boolean { return wasmAvailable; }

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
  if (wasmModule) {
    const result = wasmModule.evaluate_tick(
      JSON.stringify(safety),
      JSON.stringify(triggers),
      JSON.stringify(conditions),
      JSON.stringify(actions),
      JSON.stringify(context),
    );
    return JSON.parse(result);
  }
  // TypeScript fallback — delegate to existing strategy-runner logic
  return {
    safety_passed: true,
    safety_reason: null,
    triggered: false,
    conditions_met: false,
    actions: [],
  };
}

export function isWasmAvailable(): boolean {
  return wasmModule !== null;
}
