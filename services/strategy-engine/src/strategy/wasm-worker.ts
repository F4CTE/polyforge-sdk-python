import { parentPort } from "worker_threads";
import { createRequire } from "node:module";

const _require = createRequire(__filename);

interface WasmEngineModule {
  evaluate_tick(
    safety_json: string,
    triggers_json: string,
    conditions_json: string,
    actions_json: string,
    context_json: string,
  ): string;
}

const wasmEngine: WasmEngineModule = _require("@polyforge/engine");

interface EvalRequest {
  id: number;
  safety: unknown[];
  triggers: unknown[];
  conditions: unknown[];
  actions: unknown[];
  context: Record<string, unknown>;
}

parentPort?.on("message", (msg: EvalRequest) => {
  const { id, safety, triggers, conditions, actions, context } = msg;
  try {
    const resultJson = wasmEngine.evaluate_tick(
      JSON.stringify(safety),
      JSON.stringify(triggers),
      JSON.stringify(conditions),
      JSON.stringify(actions),
      JSON.stringify(context),
    );
    parentPort?.postMessage({ id, result: JSON.parse(resultJson) });
  } catch (err) {
    parentPort?.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
