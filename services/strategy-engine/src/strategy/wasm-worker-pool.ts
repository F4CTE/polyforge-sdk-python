import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  Optional,
} from "@nestjs/common";
import { Worker } from "worker_threads";
import { join } from "path";
import * as os from "os";

export interface WasmEvalContext {
  current_price: number;
  previous_price?: number;
  best_bid: number;
  best_ask: number;
  spread: number;
  volume_24h: number;
  daily_pnl: number;
  total_exposure: number;
  open_positions: number;
  pending_orders: number;
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

interface EvalPayload {
  safety: unknown[];
  triggers: unknown[];
  conditions: unknown[];
  actions: unknown[];
  context: WasmEvalContext;
}

interface PendingRequest {
  id: number;
  payload: EvalPayload;
  resolve: (result: WasmEvalResult) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
  worker?: Worker;
}

interface WorkerMessage {
  id: number;
  result?: WasmEvalResult;
  error?: string;
}

const DEFAULT_POOL_SIZE: number = (() => {
  const available: number =
    typeof (os as Record<string, unknown>).availableParallelism === "function"
      ? (
          os as unknown as { availableParallelism(): number }
        ).availableParallelism()
      : os.cpus().length;
  return Math.max(1, available - 1);
})();
const EVAL_TIMEOUT_MS = 150;
const QUEUE_TIMEOUT_MS = 1000;
const MAX_WORKER_RESPAWN_RETRIES = 3;
const WORKER_RESPAWN_BASE_DELAY_MS = 200;

@Injectable()
export class WasmWorkerPoolService implements OnApplicationShutdown {
  private readonly logger = new Logger(WasmWorkerPoolService.name);
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private pending = new Map<number, PendingRequest>();
  private taskQueue: PendingRequest[] = [];
  private nextId = 0;
  private started = false;
  private stopping = false;
  private workerPath: string;
  private workerFailures = new Map<number, number>();
  private quarantined = new Set<Worker>();
  private respawnTimeouts = new Set<NodeJS.Timeout>();
  private workerIndex = 0;
  private workerSlot = new WeakMap<Worker, number>();

  constructor(@Optional() workerPath?: string) {
    this.workerPath = workerPath ?? join(__dirname, "wasm-worker.js");
    this.logger.log(
      `WasmWorkerPoolService created (target pool size: ${DEFAULT_POOL_SIZE})`,
    );
  }

  start(poolSize: number = DEFAULT_POOL_SIZE): void {
    if (this.started) return;
    this.started = true;

    for (let i = 0; i < poolSize; i++) {
      this.spawnWorker(this.workerIndex++);
    }

    this.logger.log(
      `WASM worker pool started with ${this.workers.length} workers`,
    );
  }

  evaluate(
    safety: unknown[],
    triggers: unknown[],
    conditions: unknown[],
    actions: unknown[],
    context: WasmEvalContext,
  ): Promise<WasmEvalResult> {
    if (this.workers.length === 0) {
      return Promise.reject(new Error("WASM worker pool has no live workers"));
    }

    const id = this.nextId++;
    const payload: EvalPayload = {
      safety,
      triggers,
      conditions,
      actions,
      context,
    };

    return new Promise<WasmEvalResult>((resolve, reject) => {
      const queueTimeout = setTimeout(() => {
        const req = this.pending.get(id);
        if (!req || req.worker !== undefined) return;
        this.pending.delete(id);
        this.taskQueue = this.taskQueue.filter((r) => r.id !== id);
        reject(
          new Error(
            `WASM evaluation queued too long (${QUEUE_TIMEOUT_MS}ms, id=${id})`,
          ),
        );
      }, QUEUE_TIMEOUT_MS);

      const req: PendingRequest = {
        id,
        payload,
        resolve,
        reject,
        timeout: queueTimeout,
      };
      this.pending.set(id, req);

      if (this.available.length > 0) {
        const worker = this.available.pop()!;
        this.dispatch(worker, req);
      } else {
        this.taskQueue.push(req);
      }
    });
  }

  private dispatch(worker: Worker, req: PendingRequest): void {
    const { id, payload } = req;
    req.worker = worker;
    clearTimeout(req.timeout);
    req.timeout = setTimeout(() => {
      if (!this.pending.delete(id)) return;
      if (req.worker && this.workers.includes(req.worker)) {
        this.quarantineWorker(req.worker);
      }
      req.reject(
        new Error(
          `WASM evaluation timed out after ${EVAL_TIMEOUT_MS}ms (id=${id})`,
        ),
      );
    }, EVAL_TIMEOUT_MS);
    worker.postMessage({
      id,
      safety: payload.safety,
      triggers: payload.triggers,
      conditions: payload.conditions,
      actions: payload.actions,
      context: payload.context,
    });
  }

  private onWorkerMessage(worker: Worker, msg: WorkerMessage): void {
    const req = this.pending.get(msg.id);
    if (!req) {
      if (!this.workers.includes(worker)) {
        this.logger.warn(
          `WASM worker produced stale response for id=${msg.id} after removal, discarding`,
        );
        return;
      }
      this.logger.warn(
        `WASM worker produced stale response for id=${msg.id}, marking idle`,
      );
      this.returnWorker(worker);
      return;
    }

    clearTimeout(req.timeout);
    this.pending.delete(msg.id);
    this.returnWorker(worker);

    if (msg.error) {
      req.reject(new Error(msg.error));
    } else if (msg.result) {
      req.resolve(msg.result);
    } else {
      req.reject(new Error("WASM worker returned empty response"));
    }
  }

  private returnWorker(worker: Worker): void {
    this.available.push(worker);
    this.tryDequeue();
  }

  private tryDequeue(): void {
    if (this.taskQueue.length === 0 || this.available.length === 0) return;

    // Find the first queued request that hasn't timed out
    while (this.taskQueue.length > 0) {
      const req = this.taskQueue.shift()!;
      if (this.pending.has(req.id)) {
        const worker = this.available.pop()!;
        this.dispatch(worker, req);
        return;
      }
    }
  }

  private spawnWorker(index: number): void {
    const worker = new Worker(this.workerPath);
    this.workerSlot.set(worker, index);
    let respawned = false;

    const maybeRespawn = () => {
      if (respawned) return;
      respawned = true;
      this.removeWorker(worker);

      if (this.stopping) return;

      const failures = (this.workerFailures.get(index) ?? 0) + 1;
      this.workerFailures.set(index, failures);

      if (failures > MAX_WORKER_RESPAWN_RETRIES) {
        this.logger.error(
          `WASM worker #${index} exceeded max respawn retries (${MAX_WORKER_RESPAWN_RETRIES}), giving up`,
        );
        return;
      }

      const delayMs = WORKER_RESPAWN_BASE_DELAY_MS * Math.pow(2, failures - 1);
      const timer = setTimeout(() => {
        this.respawnTimeouts.delete(timer);
        if (this.stopping) return;
        this.spawnWorker(index);
      }, delayMs);
      this.respawnTimeouts.add(timer);
    };

    worker.on("message", (msg: WorkerMessage) => {
      // Reset failure counter on first successful message
      this.workerFailures.delete(index);
      this.onWorkerMessage(worker, msg);
    });

    worker.on("error", (err: Error) => {
      this.logger.error(`WASM worker #${index} error: ${err.message}`);
      for (const [reqId, req] of this.pending) {
        if (req.worker === worker) {
          clearTimeout(req.timeout);
          this.pending.delete(reqId);
          req.reject(
            new Error(`WASM worker #${index} crashed: ${err.message}`),
          );
          break;
        }
      }
      maybeRespawn();
    });

    worker.on("exit", (code) => {
      if (respawned) return;
      if (!this.workers.includes(worker)) return;
      if (!this.stopping && code !== 0) {
        this.logger.warn(
          `WASM worker #${index} exited with code ${code}, respawning`,
        );
        this.removeWorker(worker);
        maybeRespawn();
      } else {
        this.removeWorker(worker);
      }
    });

    this.workers.push(worker);
    this.available.push(worker);
    this.tryDequeue();
  }

  private quarantineWorker(worker: Worker): void {
    this.quarantined.add(worker);

    const existingIndex = this.workerSlot.get(worker);
    this.removeWorker(worker);
    if (this.stopping) return;

    if (existingIndex !== undefined) {
      const failures = (this.workerFailures.get(existingIndex) ?? 0) + 1;
      this.workerFailures.set(existingIndex, failures);

      if (failures > MAX_WORKER_RESPAWN_RETRIES) {
        this.logger.error(
          `WASM worker slot #${existingIndex} exceeded max respawn retries (${MAX_WORKER_RESPAWN_RETRIES}), giving up`,
        );
        return;
      }

      this.logger.warn(
        `WASM worker timed out, quarantining and respawning slot #${existingIndex} (attempt ${failures}/${MAX_WORKER_RESPAWN_RETRIES})`,
      );
      const delayMs =
        WORKER_RESPAWN_BASE_DELAY_MS * Math.pow(2, failures - 1);
      const timer = setTimeout(() => {
        this.respawnTimeouts.delete(timer);
        if (this.stopping) return;
        this.spawnWorker(existingIndex);
      }, delayMs);
      this.respawnTimeouts.add(timer);
    } else {
      const index = this.workerIndex++;
      this.logger.warn(
        `WASM worker timed out, quarantining and respawning as #${index}`,
      );
      this.spawnWorker(index);
    }
  }

  private removeWorker(worker: Worker): void {
    const wIndex = this.workers.indexOf(worker);
    if (wIndex !== -1) this.workers.splice(wIndex, 1);
    const aIndex = this.available.indexOf(worker);
    if (aIndex !== -1) this.available.splice(aIndex, 1);
    this.quarantined.delete(worker);
    try {
      worker.terminate().catch(() => {});
    } catch {
      // Best effort
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;

    for (const timer of this.respawnTimeouts) {
      clearTimeout(timer);
    }
    this.respawnTimeouts.clear();

    const timeout = setTimeout(() => {
      this.logger.warn(
        "WASM worker pool shutdown timed out, forcing terminate",
      );
      for (const worker of this.workers) {
        try {
          worker.terminate().catch(() => {});
        } catch {
          /* Best effort — worker may already be dead */
        }
      }
    }, 5000);

    await Promise.all(
      this.workers.map((w) => {
        return w.terminate().catch(() => {});
      }),
    );

    clearTimeout(timeout);
    this.workers = [];
    this.available = [];
    this.taskQueue = [];

    for (const [, req] of this.pending) {
      clearTimeout(req.timeout);
      req.reject(new Error("WASM worker pool is shutting down"));
    }
    this.pending.clear();

    this.logger.log("WASM worker pool shut down");
  }
}
