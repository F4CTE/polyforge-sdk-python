import { Logger } from "@nestjs/common";
import { StrategyStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, BetaLimitsConfigService } from "@polyforge/shared-redis";
import { StrategyVariable, SubStrategyMode } from "@polyforge/shared-types";
import type { VenueId } from "@polyforge/shared-types";
import { EvalContext, OrderIntent } from "../blocks/block.types";
import {
  SAFETY_REGISTRY,
  TRIGGER_REGISTRY,
  CONDITION_REGISTRY,
  ACTION_REGISTRY,
  LOGIC_REGISTRY,
  CALC_REGISTRY,
} from "../blocks/registry";
import { resolveParams } from "../blocks/resolve-params";
import { StateService } from "../state/state.service";
import { safeEvaluate } from "../common/safe-evaluate";
import { sma, ema, macd, bollingerBands, atr } from "../ta/indicators";
import { readPriceWindow } from "../ta/price-window";
import { TickMutex } from "./tick-mutex";
import { WasmWorkerPoolService, WasmEvalContext } from "./wasm-worker-pool";
import { assertWasmEvaluationBudget } from "../wasm-evaluation-limits";
import { parseFiniteDecimal } from "@polyforge/shared-types";

const WASM_SAFETY_TYPES = new Set([
  "STOP_IF_DAILY_LOSS",
  "MAX_ORDERS_TOTAL",
  "STOP_IF_CONSECUTIVE_LOSS",
  "STOP_IF_EXPOSURE_EXCEEDS",
  "MAX_BETS_PER_DAY",
  "MAX_DRAWDOWN",
]);

const WASM_TRIGGER_TYPES = new Set([
  "EVERY_TICK",
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "PRICE_CROSSES_UP",
  "PRICE_CROSSES_DOWN",
  "SPREAD_BELOW",
]);

const WASM_CONDITION_TYPES = new Set([
  "SPREAD_BELOW_CONDITION",
  "DAILY_LOSS_LIMIT",
]);

const TOKEN_SCOPED_WASM_TYPES = new Set([
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "PRICE_CROSSES_UP",
  "PRICE_CROSSES_DOWN",
  "SPREAD_BELOW",
  "SPREAD_BELOW_CONDITION",
]);

const SAFETY_PARAM_NORMALIZE: Record<string, Record<string, string>> = {
  STOP_IF_DAILY_LOSS: { maxLossUsdc: "maxLoss" },
  MAX_ORDERS_TOTAL: { max: "maxOrders" },
  STOP_IF_CONSECUTIVE_LOSS: { maxLosses: "maxLosses" },
  STOP_IF_EXPOSURE_EXCEEDS: { maxUsdc: "maxExposure" },
  MAX_BETS_PER_DAY: { max: "maxBets" },
  MAX_DRAWDOWN: { max: "maxDrawdown" },
};

const TRIGGER_CONDITION_PARAM_NORMALIZE: Record<
  string,
  Record<string, string>
> = {
  PRICE_ABOVE: { price: "threshold" },
  PRICE_BELOW: { price: "threshold" },
  PRICE_CROSSES_UP: { price: "threshold" },
  PRICE_CROSSES_DOWN: { price: "threshold" },
  SPREAD_BELOW: { minSpread: "threshold", maxSpread: "threshold" },
  SPREAD_BELOW_CONDITION: { minSpread: "maxSpread" },
  DAILY_LOSS_LIMIT: { maxLossUsdc: "limit", maxLoss: "limit" },
};

const WASM_TYPE_CANONICAL: Record<string, string> = {
  stop_if_daily_loss: "STOP_IF_DAILY_LOSS",
  max_orders_total: "MAX_ORDERS_TOTAL",
  CONSECUTIVE_LOSS: "STOP_IF_CONSECUTIVE_LOSS",
  stop_if_consecutive_loss: "STOP_IF_CONSECUTIVE_LOSS",
  EXPOSURE_EXCEEDS: "STOP_IF_EXPOSURE_EXCEEDS",
  stop_if_exposure_exceeds: "STOP_IF_EXPOSURE_EXCEEDS",
  every_tick: "EVERY_TICK",
  TICK: "EVERY_TICK",
  price_above: "PRICE_ABOVE",
  price_above_tick: "PRICE_ABOVE",
  price_below: "PRICE_BELOW",
  price_below_tick: "PRICE_BELOW",
  price_crosses_up: "PRICE_CROSSES_UP",
  price_crosses_down: "PRICE_CROSSES_DOWN",
  spread_below_tick: "SPREAD_BELOW",
  SPREAD_ABOVE: "SPREAD_BELOW",
  spread_below_condition: "SPREAD_BELOW_CONDITION",
  daily_loss_limit: "DAILY_LOSS_LIMIT",
  max_drawdown: "MAX_DRAWDOWN",
};

function canonicalWasmType(
  type: string,
  category?: "safety" | "trigger" | "condition",
): string {
  if (category === "safety" && type === "DAILY_LOSS_LIMIT")
    return "STOP_IF_DAILY_LOSS";
  return WASM_TYPE_CANONICAL[type] ?? type;
}

function toWasmBlock(
  block: Block,
  variables?: Record<string, number>,
  category?: "safety" | "trigger" | "condition",
): {
  id: string;
  type: string;
  config: Record<string, unknown>;
} {
  const merged = { ...(block.config ?? {}), ...(block.params ?? {}) };
  const config =
    Object.keys(merged).length > 0
      ? resolveParams(merged, variables ?? {})
      : {};

  const toWasmParam = (
    remap: Record<string, string>,
    aliasWins = false,
  ): void => {
    // `aliasWins`: tsKey (alias) takes precedence over rustKey
    // (canonical) when both exist in the TS evaluator's ?? chain
    // (e.g. maxLossUsdc ?? maxLoss, max ?? maxOrders).
    // `!aliasWins`: canonical-first — rustKey is preserved when
    // already present (e.g. threshold ?? price).
    const written = new Set<string>();
    for (const [tsKey, rustKey] of Object.entries(remap)) {
      if (tsKey in config) {
        const isIdentity = tsKey === rustKey;
        if (aliasWins) {
          if (!written.has(rustKey)) {
            config[rustKey] = config[tsKey];
            written.add(rustKey);
          }
        } else if (!(rustKey in config)) {
          config[rustKey] = config[tsKey];
        }
        if (tsKey !== rustKey) delete config[tsKey];
      }
    }
  };

  const canonicalType = canonicalWasmType(block.type, category);

  if (category === "safety") {
    const safetyRemap = SAFETY_PARAM_NORMALIZE[canonicalType];
    if (safetyRemap) {
      // Safety block aliases normally take precedence over canonical keys
      // in the TS evaluator (e.g. maxLossUsdc ?? maxLoss).
      //
      // Exception: MAX_DRAWDOWN uses maxDrawdown ?? max, so the canonical
      // key (maxDrawdown) must not be overwritten by the legacy alias (max).
      toWasmParam(safetyRemap, canonicalType !== "MAX_DRAWDOWN");
    }
  }

  if (category === "trigger" || category === "condition") {
    const tcRemap = TRIGGER_CONDITION_PARAM_NORMALIZE[canonicalType];
    if (tcRemap) {
      // SPREAD_BELOW_CONDITION has minSpread alias taking TS precedence
      // over maxSpread; DAILY_LOSS_LIMIT uses maxLossUsdc ?? maxLoss
      // (alias-first).  All other tcRemap entries are canonical-first.
      toWasmParam(
        tcRemap,
        canonicalType === "SPREAD_BELOW" ||
          canonicalType === "SPREAD_BELOW_CONDITION" ||
          canonicalType === "DAILY_LOSS_LIMIT",
      );
    }
  }

  // Keep TS parity for legacy/default spread conditions:
  // SpreadBelowTickBlock defaults to 0.05 when no threshold is provided.
  // Rust defaults missing maxSpread to 0.0, which is stricter and can
  // incorrectly fail otherwise-valid condition blocks.
  if (canonicalType === "SPREAD_BELOW_CONDITION" && !("maxSpread" in config)) {
    config.maxSpread = "0.05";
  }

  return {
    id: block.id,
    type: canonicalType,
    config,
  };
}

/** Redis key for daily execution counter — resets at midnight UTC */
const dailyExecKey = (strategyId: string): string => {
  const d = new Date();
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return `beta:executions:${strategyId}:${date}`;
};

const MIN_TICK_MS = 200;
const TICK_LOCK_TTL_MS = 10_000;
const STALE_PRICE_MS = 5_000;
const MAX_STALE_CHECK_BACKOFF_MS = 60_000;
const HYBRID_LOCK_MISS_RETRY_MS = 200;
const HYBRID_MAX_CONSECUTIVE_LOCK_MISS_RETRIES = 3;

/** Historical safety block types that were dual-purpose (safety +
 *  conditions) but later moved to CONDITION_REGISTRY-only.  Legacy
 *  persisted strategies may still reference these under safety.
 *  Evaluating them via the condition registry as a safety guard
 *  introduces an allowlist gate because misconfigured condition-only
 *  types (e.g. VENUE_SELECT) would return fired=true and render the
 *  fail-closed safety boundary fail-open. */
const LEGACY_SAFETY_ALIASES = new Set(["MAX_POSITION_SIZE", "max_position"]);

function isMissingLegacySafetyMax(maxUsdc: unknown): boolean {
  return (
    maxUsdc === undefined ||
    maxUsdc === null ||
    String(maxUsdc) === "" ||
    parseFloat(String(maxUsdc)) === 0
  );
}

function normalizeLegacyMaxPositionSafetyBlock(block: Block): Block | null {
  if (!LEGACY_SAFETY_ALIASES.has(block.type)) return block;
  const source = { ...(block.config ?? {}), ...(block.params ?? {}) } as Record<
    string,
    unknown
  >;
  const maxUsdc =
    source.maxUsdc !== undefined &&
    source.maxUsdc !== null &&
    String(source.maxUsdc) !== ""
      ? source.maxUsdc
      : source.maxSizeUsdc;
  if (isMissingLegacySafetyMax(maxUsdc)) {
    return null;
  }
  return {
    ...block,
    // Route legacy MAX_POSITION_SIZE-in-safety through the canonical
    // global exposure safety evaluator.
    type: "EXPOSURE_EXCEEDS",
    params: {
      ...(block.params ?? {}),
      maxUsdc,
    },
  };
}

function secondsUntilNextUtcMidnight(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

const LOCK_RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

const LOCK_RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2] * 1000)
else
  return 0
end
`;

export type StrategyRunnerStatus = "RUNNING" | "PAUSED" | "STOPPED";

export interface Block {
  id: string;
  type: string;
  params?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface LogicBlock extends Block {
  outputs?: string[];
}

export interface LogicConnection {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

/**
 * Runs a single strategy's evaluation loop.
 *
 * Tick mode: setInterval at strategy.tickMs (min 200ms)
 * Event mode: driven externally by StrategyRegistryService.onPriceEvent()
 * Hybrid: both
 */
export class StrategyRunner {
  private readonly logger: Logger;
  status: StrategyRunnerStatus = "RUNNING";
  private timer: NodeJS.Timeout | null = null;
  private _pauseReason: string | null = null;
  get pauseReason() {
    return this._pauseReason;
  }
  private delayedActions: Map<string, NodeJS.Timeout> = new Map();
  /** Throttles EVENT-mode ticks to prevent bursty in-order evaluation */
  private lastTickMs = -MIN_TICK_MS;
  private lastStaleCheckMs = 0;
  private staleCheckBackoffMs = STALE_PRICE_MS;
  readonly tickMutex = new TickMutex();
  private tickInFlight = false;
  private pendingTick = false;
  /** True when a follow-up tick is scheduled — bypasses the min-tick throttle */
  private scheduledFollowUp = false;
  private deferredRetryTick: NodeJS.Timeout | null = null;

  private _warnedSafetyFallbackIds: Set<string> | null = null;

  /** Delayed follow-up timeout for TICK/HYBRID modes — cleared on stop() */
  private followUpTimer: NodeJS.Timeout | null = null;

  /** Tracks the active lock token for the currently in-flight tick.
   *  Set to the per-acquisition `randomUUID()` after lock acquisition.
   *  Cleared to `null` by the lock-refresh handler when ownership is lost
   *  mid-tick.  `evaluate()` checks this before emitting order intents to
   *  prevent duplicate orders if another instance re-acquires the lock.
   *
   *  Scope is per-tick: a stale refresh callback from a prior tick is
   *  ignored because its captured `lockToken` no longer matches.  This
   *  prevents a late rejection / ownership-loss from incorrectly aborting
   *  a newer valid tick. */
  private activeLockToken: string | null = null;

  /** Pending Redis unlock promise from the most recent tick.
   *  Set in the finally block when a tick acquired the lock and the
   *  fire-and-forget unlock is in flight.  Cleared to null on completion.
   *
   *  EVENT-mode lock-miss paths check this so they know whether a failed
   *  SET NX is because our own unlock hasn't completed yet (race window)
   *  vs. another instance holding the lock (multi-instance dedup). */
  private pendingRedisUnlock: Promise<unknown> | null = null;

  /** Unlock promise generation that already has a chained EVENT retry.
   *  Guard is scoped per unlock promise, not globally, so a newer unlock
   *  generation can still arm exactly one retry. */
  private pendingRedisUnlockRetryFor: Promise<unknown> | null = null;
  private pendingRedisUnlockGeneration = 0;

  /** Consecutive HYBRID lock-miss retries (contention path only). */
  private hybridLockMissRetryCount = 0;

  /** Tracks child strategy IDs launched by RUN_STRATEGY action blocks */
  readonly childStrategies: Set<string> = new Set();
  /** Maps child strategy IDs to their sub-strategy mode */
  private readonly childModes: Map<string, SubStrategyMode> = new Map();

  constructor(
    private readonly strategyId: string,
    private readonly userId: string,
    private readonly execMode: string,
    private readonly tickMs: number,
    private readonly triggers: Block[],
    private readonly conditions: Block[],
    private readonly actions: Block[],
    private readonly safety: Block[],
    private readonly variables: StrategyVariable[],
    private readonly redis: RedisService,
    private readonly betaLimits: BetaLimitsConfigService,
    private readonly prisma: PrismaService,
    private readonly state: StateService,
    private readonly onIntents: (intents: OrderIntent[]) => Promise<void>,
    private readonly onStatusChange: (
      status: StrategyRunnerStatus,
      reason?: string,
    ) => Promise<void>,
    private readonly logicBlocks: LogicBlock[] = [],
    private readonly logicConnections: LogicConnection[] = [],
    private readonly calcBlocks: Block[] = [],
    private readonly onRunStrategy?: (
      childStrategyId: string,
      parentId: string,
      mode: SubStrategyMode,
      context?: { userId: string },
    ) => Promise<void>,
    private readonly venue?: VenueId | "best",
    private readonly kalshiSubaccount?: number,
    private readonly wasmWorkerPool?: WasmWorkerPoolService,
  ) {
    this.logger = new Logger(`StrategyRunner:${strategyId}`);
    this.wasmGateCompatible = this.checkWasmGateCompatible();
  }

  /** True when safety, trigger, and condition blocks are all WASM-compatible. */
  readonly wasmGateCompatible: boolean;

  private getWasmGateToken(): string | null | undefined {
    const tokens = new Set<string>();
    for (const block of this.triggers) {
      if (
        !TOKEN_SCOPED_WASM_TYPES.has(canonicalWasmType(block.type, "trigger"))
      )
        continue;
      const merged = StrategyRunner.mergedParams(block);
      const tokenId = merged.tokenId;
      if (typeof tokenId !== "string" || tokenId.length === 0) return null;
      tokens.add(tokenId);
    }
    for (const block of this.conditions) {
      if (
        !TOKEN_SCOPED_WASM_TYPES.has(canonicalWasmType(block.type, "condition"))
      )
        continue;
      const merged = StrategyRunner.mergedParams(block);
      const tokenId = merged.tokenId;
      if (typeof tokenId !== "string" || tokenId.length === 0) return null;
      tokens.add(tokenId);
    }
    if (tokens.size > 1) return null;
    if (tokens.size === 0) return undefined;
    return [...tokens][0];
  }

  private checkWasmGateCompatible(): boolean {
    if (!this.wasmWorkerPool) return false;
    if (
      this.safety.length === 0 &&
      this.triggers.length === 0 &&
      this.conditions.length === 0
    )
      return false;
    if (
      this.safety.some(
        (b) => !WASM_SAFETY_TYPES.has(canonicalWasmType(b.type, "safety")),
      )
    )
      return false;
    if (
      this.triggers.length > 0 &&
      this.triggers.some(
        (b) => !WASM_TRIGGER_TYPES.has(canonicalWasmType(b.type, "trigger")),
      )
    )
      return false;
    if (
      this.conditions.length > 0 &&
      this.conditions.some(
        (b) =>
          !WASM_CONDITION_TYPES.has(canonicalWasmType(b.type, "condition")),
      )
    )
      return false;

    // The WASM ABI uses a single orders_today field for both MAX_ORDERS_TOTAL
    // (totalOrders) and MAX_BETS_PER_DAY (betsToday).  When both safety types
    // are present, the field cannot correctly represent both counters, so fall
    // back to TS evaluators.
    const hasMaxOrdersTotal = this.safety.some(
      (b) => canonicalWasmType(b.type, "safety") === "MAX_ORDERS_TOTAL",
    );
    const hasMaxBetsPerDay = this.safety.some(
      (b) => canonicalWasmType(b.type, "safety") === "MAX_BETS_PER_DAY",
    );
    if (hasMaxOrdersTotal && hasMaxBetsPerDay) return false;

    const gateToken = this.getWasmGateToken();
    if (gateToken === null) return false;

    return true;
  }

  private hasSpreadDependentBlocks(): boolean {
    return (
      this.triggers.some(
        (b) => canonicalWasmType(b.type, "trigger") === "SPREAD_BELOW",
      ) ||
      this.conditions.some(
        (b) =>
          canonicalWasmType(b.type, "condition") === "SPREAD_BELOW_CONDITION",
      )
    );
  }

  private hasExposureDependentBlocks(): boolean {
    return this.safety.some((b) => {
      const ct = canonicalWasmType(b.type, "safety");
      return ct === "STOP_IF_EXPOSURE_EXCEEDS";
    });
  }

  private hasMaxOrdersTotalBlock(): boolean {
    return this.safety.some((b) => {
      const ct = canonicalWasmType(b.type, "safety");
      return ct === "MAX_ORDERS_TOTAL";
    });
  }

  private validateSafetyParamsForWasm(vars: Record<string, number>): void {
    for (const block of this.safety) {
      const resolved = resolveParams(StrategyRunner.mergedParams(block), vars);
      const ct = canonicalWasmType(block.type, "safety");
      if (ct === "STOP_IF_DAILY_LOSS") {
        const maxLoss = parseFiniteDecimal(
          String(resolved.maxLossUsdc ?? resolved.maxLoss ?? "0"),
        );
        if (maxLoss === null || maxLoss <= 0)
          throw new Error("WASM safety param maxLoss invalid");
      } else if (ct === "MAX_ORDERS_TOTAL") {
        const raw = String(resolved.max ?? resolved.maxOrders ?? "0");
        const max = parseInt(raw, 10);
        if (!Number.isFinite(max) || max <= 0 || String(max) !== raw)
          throw new Error("WASM safety param maxOrders invalid");
      } else if (ct === "STOP_IF_EXPOSURE_EXCEEDS") {
        const maxUsdc = parseFiniteDecimal(
          String(resolved.maxUsdc ?? resolved.maxExposure ?? "0"),
        );
        if (maxUsdc === null || maxUsdc < 0)
          throw new Error("WASM safety param maxExposure invalid");
      } else if (ct === "MAX_BETS_PER_DAY") {
        const raw = String(resolved.max ?? resolved.maxBets ?? "0");
        const max = parseInt(raw, 10);
        if (!Number.isFinite(max) || max <= 0 || String(max) !== raw)
          throw new Error("WASM safety param maxBets invalid");
      } else if (ct === "MAX_DRAWDOWN") {
        const max = parseFiniteDecimal(
          String(resolved.maxDrawdown ?? resolved.max ?? "0"),
        );
        if (max === null || max <= 0)
          throw new Error("WASM safety param maxDrawdown invalid");
      } else if (ct === "STOP_IF_CONSECUTIVE_LOSS") {
        const raw = String(resolved.maxLosses ?? "0");
        const maxLosses = parseInt(raw, 10);
        if (
          !Number.isFinite(maxLosses) ||
          maxLosses <= 0 ||
          String(maxLosses) !== raw
        )
          throw new Error("WASM safety param maxLosses invalid");
      }
    }
  }

  private validateTriggerParamsForWasm(vars: Record<string, number>): void {
    for (const block of this.triggers) {
      if (canonicalWasmType(block.type, "trigger") === "EVERY_TICK") continue;
      const resolved = resolveParams(StrategyRunner.mergedParams(block), vars);
      const rawValue =
        resolved.threshold ??
        resolved.minSpread ??
        resolved.maxSpread ??
        resolved.price;
      if (rawValue === undefined) {
        throw new Error(
          `WASM trigger threshold missing for block ${block.type}`,
        );
      }
      const price = parseFiniteDecimal(String(rawValue));
      if (price === null)
        throw new Error(
          `WASM trigger param threshold invalid for block ${block.type}`,
        );
    }
  }

  private validateConditionParamsForWasm(vars: Record<string, number>): void {
    for (const block of this.conditions) {
      const ct = canonicalWasmType(block.type, "condition");
      if (ct === "DAILY_LOSS_LIMIT") {
        const resolved = resolveParams(
          StrategyRunner.mergedParams(block),
          vars,
        );
        const maxLoss = parseFiniteDecimal(
          String(
            resolved.maxLossUsdc ?? resolved.maxLoss ?? resolved.limit ?? "0",
          ),
        );
        if (maxLoss === null || maxLoss <= 0)
          throw new Error("WASM condition param limit invalid");
      }
      if (ct === "SPREAD_BELOW_CONDITION") {
        const resolved = resolveParams(
          StrategyRunner.mergedParams(block),
          vars,
        );
        const raw = resolved.minSpread ?? resolved.maxSpread;
        // No threshold is fine — toWasmBlock() defaults maxSpread to 0.05.
        if (raw !== undefined) {
          const spread = parseFiniteDecimal(String(raw));
          if (spread === null || spread <= 0)
            throw new Error(
              "WASM condition param spread threshold invalid for SPREAD_BELOW_CONDITION",
            );
        }
      }
    }
  }

  private validateNoUnresolvedVariables(
    blocks: Block[],
    vars: Record<string, number>,
  ): void {
    for (const block of blocks) {
      const resolved = resolveParams(StrategyRunner.mergedParams(block), vars);
      for (const value of Object.values(resolved)) {
        if (typeof value === "string" && value.startsWith("$")) {
          throw new Error(
            `WASM dispatch blocked: unresolved variable ${value} in block ${block.type}`,
          );
        }
      }
    }
  }

  /** Register a child strategy launched by this runner */
  addChild(childId: string, mode: SubStrategyMode) {
    this.childStrategies.add(childId);
    this.childModes.set(childId, mode);
  }

  /** Remove a child strategy (e.g. when it stops on its own) */
  removeChild(childId: string) {
    this.childStrategies.delete(childId);
    this.childModes.delete(childId);
  }

  /** Get the mode for a child strategy */

  getChildMode(childId: string): SubStrategyMode | undefined {
    return this.childModes.get(childId);
  }

  start() {
    if (this.execMode === "TICK" || this.execMode === "HYBRID") {
      const interval = Math.max(this.tickMs, MIN_TICK_MS);
      this.timer = setInterval(() => void this.tick(), interval);
    }
    this.logger.log(`Started (mode=${this.execMode}, tickMs=${this.tickMs})`);
  }

  pause(reason = "manual") {
    this.status = "PAUSED";
    this._pauseReason = reason;
    this.logger.log(`Paused: ${reason}`);
  }

  resume() {
    this.status = "RUNNING";
    this._pauseReason = null;
    this.staleCheckBackoffMs = STALE_PRICE_MS;
    this.lastStaleCheckMs = 0;
    this.logger.log("Resumed");
  }

  stop() {
    this.status = "STOPPED";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Clear all delayed action timers
    for (const timer of this.delayedActions.values()) {
      clearTimeout(timer);
    }
    this.delayedActions.clear();
    // Clear deferred retry tick if pending
    if (this.deferredRetryTick) {
      clearTimeout(this.deferredRetryTick);
      this.deferredRetryTick = null;
    }
    // Clear follow-up timer for TICK/HYBRID coalesced ticks
    if (this.followUpTimer) {
      clearTimeout(this.followUpTimer);
      this.followUpTimer = null;
    }
    // Note: cascade stop of managed/scoped children is handled by StrategyRegistryService
    if (this.childStrategies.size > 0) {
      this.logger.log(
        `Stopping with ${this.childStrategies.size} child strategies to cascade`,
      );
    }
    this.logger.log("Stopped");
  }

  /** Called on price events from market-data-service (EVENT/HYBRID mode) */
  async onPriceEvent(_tokenId: string, _price: number) {
    if (this.execMode === "EVENT" || this.execMode === "HYBRID") {
      await this.tick();
    }
  }

  // ─── Core evaluation pipeline ─────────────────────────────────────────────

  private async tick() {
    // Auto-resume from stale-data pause when data is fresh again.
    // Checked before the status guard so PAUSED runners can auto-recover
    // after a WS reconnect repopulates the price cache.
    //
    // Throttled with exponential backoff: starts at STALE_PRICE_MS (5s),
    // doubles on each consecutive stale check up to MAX_STALE_CHECK_BACKOFF_MS (60s).
    // This prevents Redis mget fan-out from sustained tick intervals during
    // prolonged feed outages.
    if (
      this.status === "PAUSED" &&
      this._pauseReason?.startsWith("stale_market_data")
    ) {
      const now = Date.now();
      if (now - this.lastStaleCheckMs < this.staleCheckBackoffMs) {
        return;
      }
      this.lastStaleCheckMs = now;

      try {
        const stillStale = await this.detectStaleData();
        if (!stillStale) {
          // Re-check after the await — a concurrent stop() or overlapping
          // tick may have changed status / pauseReason while we were waiting.
          if (
            this.status !== "PAUSED" ||
            !this.pauseReason?.startsWith("stale_market_data")
          ) {
            return;
          }
          this.staleCheckBackoffMs = STALE_PRICE_MS;
          this.resume();
          await this.onStatusChange("RUNNING");
          await this.emitStrategyEvent("STRATEGY_STARTED");
        } else {
          // Exponential backoff — double the interval on each consecutive stale read
          this.staleCheckBackoffMs = Math.min(
            this.staleCheckBackoffMs * 2,
            MAX_STALE_CHECK_BACKOFF_MS,
          );
          return;
        }
      } catch (err) {
        this.logger.error("Auto-resume from stale-data failed", err);
        return;
      }
    }

    if (this.status !== "RUNNING") return;

    // Throttle EVENT/HYBRID event-driven ticks to prevent bursty
    // every_tick triggers from firing on every incoming price event.
    // Bypassed for internally-scheduled follow-up ticks (deferred work
    // that was coalesced while the mutex was held).
    // TICK-mode ticks are already scheduled at Math.max(tickMs, MIN_TICK_MS).
    if (this.execMode === "EVENT" || this.execMode === "HYBRID") {
      const followUp = this.scheduledFollowUp;
      this.scheduledFollowUp = false;
      if (!followUp) {
        const now = Date.now();
        if (now - this.lastTickMs < MIN_TICK_MS) {
          if (this.tickInFlight) {
            this.pendingTick = true;
          }
          return;
        }
        this.lastTickMs = now;
      }
    }

    // In-process coalescing: only one tick evaluates at a time.
    if (!this.tickMutex.tryEnter()) {
      this.pendingTick = true;
      return;
    }

    this.tickInFlight = true;

    let redisLockAcquired = false;
    let lockRenewal: NodeJS.Timeout | undefined;
    let redisClient: ReturnType<typeof this.redis.getClient> | undefined;
    let lockKey = "";
    let lockToken = "";

    try {
      redisClient = this.redis.getClient();
      lockKey = `strategy:${this.strategyId}:tick:lock`;
      lockToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

      const acquired = await redisClient.set(
        lockKey,
        lockToken,
        "PX",
        TICK_LOCK_TTL_MS,
        "NX",
      );
      if (!acquired) return;
      redisLockAcquired = true;
      this.hybridLockMissRetryCount = 0;

      // Cancel any pending delayed follow-up timer now that a real
      // evaluation is starting.  Only cleared after SET NX succeeds:
      // clearing before lock acquisition can drop the only scheduled
      // retry when the lock is held by another instance, leaving the
      // strategy idle until a fresh market event arrives.
      if (this.followUpTimer) {
        clearTimeout(this.followUpTimer);
        this.followUpTimer = null;
      }
      redisLockAcquired = true;
      this.activeLockToken = lockToken;

      const LOCK_RENEW_MS = 2_000;
      lockRenewal = setInterval(() => {
        redisClient!
          .eval(
            LOCK_RENEW_SCRIPT,
            1,
            lockKey,
            lockToken,
            String(TICK_LOCK_TTL_MS / 1000),
          )
          .then((result: unknown) => {
            if (this.activeLockToken !== lockToken) return;
            if (result !== 1) {
              this.activeLockToken = null;
            }
          })
          .catch(() => {
            if (this.activeLockToken !== lockToken) return;
            this.activeLockToken = null;
          });
      }, LOCK_RENEW_MS);
      if (lockRenewal.unref) lockRenewal.unref();

      // Enforce daily execution limit — auto-stop if exceeded
      const key = dailyExecKey(this.strategyId);
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, secondsUntilNextUtcMidnight());
      }
      const maxDaily = await this.betaLimits.getLimit(
        "maxDailyStrategyExecutions",
      );
      if (count > maxDaily) {
        this.logger.warn(
          `Strategy ${this.strategyId} hit daily execution limit (${maxDaily}) — pausing until midnight UTC`,
        );
        this.pause("daily_execution_limit_reached");
        await this.onStatusChange(
          "PAUSED",
          "daily_execution_limit_reached",
        ).catch(() => {});
        return;
      }

      await this.evaluate(lockToken);
    } catch (err) {
      this.logger.error("Tick evaluation failed", err);
      if (
        err instanceof Error &&
        err.message.includes("Counter increment failed")
      ) {
        this.pause("counter_increment_failed");
        await this.onStatusChange("PAUSED", "counter_increment_failed").catch(
          () => {},
        );
      }
    } finally {
      this.tickInFlight = false;
      if (lockRenewal) {
        clearInterval(lockRenewal);
      }
      const lockHeldAtFinish =
        redisLockAcquired && this.activeLockToken === lockToken;
      if (this.activeLockToken === lockToken) {
        this.activeLockToken = null;
      }

      // Snapshot the unlock generation before the lockAcquired block
      // so the retry paths below (which run when !redisLockAcquired) can
      // close over it without hitting a ReferenceError.
      let unlockGeneration = this.pendingRedisUnlockGeneration;

      // Start Redis distributed unlock before releasing tickInFlight so
      // follow-up ticks can observe pendingRedisUnlock in local race windows.
      if (redisLockAcquired) {
        const redisClient = this.redis.getClient();
        const lockKey = `strategy:${this.strategyId}:tick:lock`;
        const unlockPromise = redisClient.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken,
        );
        const thisUnlock = unlockPromise;
        this.pendingRedisUnlock = thisUnlock;
        unlockGeneration = ++this.pendingRedisUnlockGeneration;
        thisUnlock
          .then((result) => {
            if (result !== 1) {
              this.logger.warn(
                `Lock release for ${this.strategyId} did not delete the key (already expired or taken by another instance)`,
              );
            }
          })
          .catch((err) => {
            this.logger.warn(
              `Failed to release lock for ${this.strategyId}: ${String(err)} — lock will expire naturally in 10s`,
            );
          })
          .finally(() => {
            if (this.pendingRedisUnlock === thisUnlock) {
              this.pendingRedisUnlock = null;
            }
          });
      }

      // Release the local in-flight gate immediately — do NOT block on
      // Redis unlock.  A slow or stuck Redis eval() would otherwise hold
      // tickInFlight=true and stall all tick processing, turning a
      // transient Redis hiccup into a full strategy outage.
      //
      // The Redis distributed lock has a 10s TTL and will expire
      // naturally if the fire-and-forget unlock below fails.  Releasing
      // tickInFlight early means a subsequent tick may race the unlock,
      // but SET NX correctly handles that: if the lock TTL is still
      // active, the new tick fails SET NX and retries via the normal
      // pendingTick retry path.
      this.tickInFlight = false;

      // Release the in-process tick mutex so the coalesced follow-up
      // tick below (or a subsequent external tick) can re-acquire it.
      this.tickMutex.exit();

      if (this.pendingTick) {
        this.pendingTick = false;
        if (redisLockAcquired) {
          // Fire a coalesced follow-up tick after release.
          // This catches ticks/events that arrived while the in-flight
          // evaluation was running (they set pendingTick and returned).
          //
          // - EVENT mode: immediate self-schedule, bypassing min-tick
          //   throttle via scheduledFollowUp flag (price-driven; real-time
          //   matters).
          // - TICK/HYBRID mode: delayed follow-up that respects the
          //   configured tick cadence. Without this delay, a long
          //   evaluation that overlaps with multiple interval ticks
          //   would trigger an immediate catch-up chain that can
          //   overshoot the tick period and exhaust the daily execution
          //   limit early.
          if (this.execMode === "EVENT") {
            this.scheduledFollowUp = true;
            void this.tick();
          } else {
            if (this.followUpTimer) clearTimeout(this.followUpTimer);
            const delay = Math.max(this.tickMs, MIN_TICK_MS);
            this.followUpTimer = setTimeout(() => {
              this.followUpTimer = null;
              void this.tick();
            }, delay);
          }
        } else if (this.execMode !== "EVENT") {
          // Lock acquisition failed (SET NX returned null), but one or
          // more ticks/events arrived while this attempt was waiting.
          // Schedule a delayed retry instead of silently dropping the
          // pending events.  A short backoff prevents retry storms
          // under sustained contention while ensuring that safety /
          // action side effects are not missed when the lock is
          // temporarily stale (e.g. TTL still active after a crash of
          // the previous holder and no new price event arrives to
          // trigger a natural re-evaluation).
          //
          // EVENT mode is excluded: in a multi-instance deployment
          // where every instance receives the same price event, the
          // winning instance's finally block already processes the
          // coalesced pending events.  A losing-instance retry here
          // would re-evaluate the same latest state and produce
          // duplicate order intents / sub-strategy launches.
          if (this.followUpTimer) clearTimeout(this.followUpTimer);
          const RETRY_BACKOFF_MS = 200;
          this.followUpTimer = setTimeout(() => {
            this.followUpTimer = null;
            this.scheduledFollowUp = true;
            void this.tick();
          }, RETRY_BACKOFF_MS);
        } else if (this.pendingRedisUnlock) {
          // EVENT mode: one or more price events were coalesced
          // (pendingTick) while this tick's SET NX was awaiting a
          // Redis response, and lock acquisition failed because our
          // own previous tick's Redis unlock is still pending.
          //
          // This is the same local-race-window scenario handled below
          // for the no-pendingTick case (POLA-5150), but it is missed
          // when pendingTick was true because the pendingTick flag
          // gates the lower retry branch.  Without this clause the
          // coalesced events would be silently dropped: no retry fires
          // and no fresh price event is guaranteed to arrive.
          const pendingUnlock = this.pendingRedisUnlock;
          // One-shot guard scoped to this exact unlock promise generation.
          if (this.pendingRedisUnlockRetryFor !== pendingUnlock) {
            this.pendingRedisUnlockRetryFor = pendingUnlock;
            if (this.followUpTimer) clearTimeout(this.followUpTimer);
            void pendingUnlock
              .finally(() => {
                const isCurrentGeneration =
                  this.pendingRedisUnlockGeneration === unlockGeneration;
                const isArmedRetry =
                  this.pendingRedisUnlockRetryFor === pendingUnlock;
                if (isArmedRetry) {
                  this.pendingRedisUnlockRetryFor = null;
                }
                if (
                  isArmedRetry &&
                  isCurrentGeneration &&
                  this.status === "RUNNING"
                ) {
                  this.scheduledFollowUp = true;
                  void this.tick();
                }
              })
              .catch(() => {});
          }
        }
        // EVENT mode with pendingTick=true and no pendingRedisUnlock:
        // the lock is held by another instance.  Do NOT schedule a
        // crash-recovery retry — in a multi-instance deployment where
        // every instance receives the same price events, the winning
        // instance already handles the event (and any coalesced
        // pendingTick it may have).  A retry here would re-evaluate
        // the same data after the winner releases the lock, producing
        // duplicate order intents and sub-strategy launches.
        //
        // If the lock holder crashes, the lock expires after the TTL
        // and the next incoming price event naturally re-acquires it.
      } else if (!redisLockAcquired && this.status === "RUNNING") {
        // Lock acquisition failed without any pending coalesced tick.
        //
        // HYBRID mode schedules a 200 ms retry so the strategy can
        // re-evaluate before the next interval tick fires.
        //
        // EVENT mode is deliberately NOT given a blanket retry: in a
        // multi-instance deployment where every instance receives the
        // same price event, the instance that won the lock is already
        // evaluating the event.  A losing-instance retry would
        // re-evaluate the same data after the winner releases the lock,
        // producing duplicate order intents and sub-strategy launches.
        //
        // However, the early tickInFlight release before the Redis
        // unlock creates a local race window: tickInFlight is false, a
        // new EVENT tick enters, but SET NX fails because the previous
        // tick's lock key hasn't been deleted yet.  In that case our own
        // pendingRedisUnlock is non-null and we MUST retry once the
        // unlock completes — otherwise the event is silently dropped.
        if (this.pendingRedisUnlock) {
          const pendingUnlock = this.pendingRedisUnlock;
          // One-shot guard scoped to this exact unlock promise generation.
          if (this.pendingRedisUnlockRetryFor !== pendingUnlock) {
            this.pendingRedisUnlockRetryFor = pendingUnlock;
            // Bypass the min-tick throttle when the retry fires so the
            // evaluation is not blocked by lastTickMs having been advanced
            // by the failed tick itself.
            if (this.followUpTimer) clearTimeout(this.followUpTimer);
            void pendingUnlock
              .finally(() => {
                const isCurrentGeneration =
                  this.pendingRedisUnlockGeneration === unlockGeneration;
                const isArmedRetry =
                  this.pendingRedisUnlockRetryFor === pendingUnlock;
                if (isArmedRetry) {
                  this.pendingRedisUnlockRetryFor = null;
                }
                if (
                  isArmedRetry &&
                  isCurrentGeneration &&
                  this.status === "RUNNING"
                ) {
                  this.scheduledFollowUp = true;
                  void this.tick();
                }
              })
              .catch(() => {});
          }
        } else if (this.execMode === "HYBRID" && this.followUpTimer === null) {
          // Bound contention retries in HYBRID mode. The interval timer
          // already provides natural re-evaluation cadence, so after a few
          // immediate misses we stop short-backoff retries and wait for the
          // regular tick to avoid replay/amplification under sustained lock
          // contention.
          if (
            this.hybridLockMissRetryCount <
            HYBRID_MAX_CONSECUTIVE_LOCK_MISS_RETRIES
          ) {
            this.hybridLockMissRetryCount += 1;
            this.followUpTimer = setTimeout(() => {
              this.followUpTimer = null;
              this.scheduledFollowUp = true;
              void this.tick();
            }, HYBRID_LOCK_MISS_RETRY_MS);
          }
        }
      } else if (this.execMode !== "EVENT" && !lockHeldAtFinish) {
        // TICK/HYBRID lock miss with no coalesced pending follow-up:
        // tickMutex.exit() returned false so the normal retry path above
        // was skipped.  Schedule a short retry here so the strategy
        // reattempts distributed-lock acquisition instead of waiting
        // for the next full setInterval tick.
        this.deferredRetryTick = setTimeout(() => {
          this.deferredRetryTick = null;
          void this.tick();
        }, MIN_TICK_MS).unref();
      }
    }
  }

  private hasLockOwnership(lockToken?: string): boolean {
    if (!lockToken) return true;
    return this.activeLockToken === lockToken;
  }

  private async evaluate(lockToken?: string) {
    // 0. Fetch strategy state + all referenced price caches in a single
    //    Redis pipeline.  This eliminates the old double-read where
    //    state.get() and detectStaleData() each fetched prices separately.
    const allTokenIds = this.getReferencedTokenIds();
    const staleTokenIds = this.getStalePriceTokenIds();
    const { state: stateData, prices } = await this.state.getStateAndPrices(
      this.strategyId,
      allTokenIds,
    );

    const ctx: EvalContext = {
      strategyId: this.strategyId,
      userId: this.userId,
      state: stateData,
      now: Date.now(),
      ...(this.venue !== undefined ? { venue: this.venue } : {}),
      ...(this.kalshiSubaccount != null
        ? { kalshiSubaccount: this.kalshiSubaccount }
        : {}),
    };

    // 0.1 Check stale data — pause if any subscribed token's price is stale.
    //     Moved before expensive variable / TA evaluation so we bail early
    //     when market data is not fresh.
    //     Only price-dependent blocks (triggers/actions) are checked to avoid
    //     false pauses from non-price conditions (MAX_POSITION, etc.).
    const staleToken = this.detectStaleFromPrices(staleTokenIds, prices);
    if (staleToken) {
      if (this.status === "RUNNING") {
        this.pause(`stale_market_data:${staleToken}`);
        await this.onStatusChange("PAUSED", `stale_market_data:${staleToken}`);
        await this.emitStrategyEvent(
          "STRATEGY_PAUSED",
          `stale_market_data:${staleToken}`,
        );
      }
      return;
    }

    // 0.2 Evaluate user-defined calculation variables.
    //     Uses the pre-fetched price cache instead of a separate Redis call.
    const variables: Record<string, number> = {};
    if (this.variables.length > 0) {
      const scope: Record<string, number> = {
        dailyPnl: stateData.dailyPnl,
        betsToday: stateData.betsToday,
        consecutiveLoss: stateData.consecutiveLoss,
        consecutiveWin: stateData.consecutiveWin,
        totalOrders: stateData.totalOrders,
      };

      const primaryTokenId = allTokenIds[0];
      if (primaryTokenId) {
        const priceData = prices.get(primaryTokenId) ?? null;
        scope.currentPrice = priceData?.price ?? 0;
      }

      for (const v of this.variables) {
        try {
          const value = safeEvaluate(v.expression, {
            ...scope,
            ...variables,
          });
          if (Number.isFinite(value)) {
            variables[v.name] = value;
          }
        } catch {
          this.logger.warn(
            `Variable "${v.name}" evaluation failed: ${v.expression}`,
          );
        }
      }
    }
    ctx.variables = variables;

    // 0.4 Pre-fetch TA indicator values for TA calc blocks
    // CalcBlockEvaluator has no Redis access, so we compute here and store in ctx.variables.
    const TA_TYPES = new Set(["SMA", "EMA", "MACD", "BOLLINGER", "ATR"]);
    const taBlocks = this.calcBlocks.filter((b) => TA_TYPES.has(b.type));
    if (taBlocks.length > 0) {
      // Group by tokenId to batch price-window reads
      const priceCache = new Map<string, number[]>();
      for (const block of taBlocks) {
        const p = StrategyRunner.mergedParams(block);
        const tokenId = typeof p.tokenId === "string" ? p.tokenId : "";
        if (!tokenId) continue;

        if (!priceCache.has(tokenId)) {
          // Fetch enough prices for the widest indicator (250 is the sorted-set max)
          const points = await readPriceWindow(this.redis, tokenId, 250);
          priceCache.set(
            tokenId,
            points.map((pt) => pt.price),
          );
        }

        const prices = priceCache.get(tokenId)!;
        ctx.variables = ctx.variables ?? {};

        if (block.type === "SMA") {
          const period = Number(p.period ?? 14);
          ctx.variables[`__ta_${block.id}`] = sma(prices, period);
        } else if (block.type === "EMA") {
          const period = Number(p.period ?? 14);
          ctx.variables[`__ta_${block.id}`] = ema(prices, period);
        } else if (block.type === "MACD") {
          const fast = Number(p.fastPeriod ?? 12);
          const slow = Number(p.slowPeriod ?? 26);
          const signal = Number(p.signalPeriod ?? 9);
          const result = macd(prices, fast, slow, signal);
          ctx.variables[`__ta_${block.id}`] = result.macdLine;
          ctx.variables[`__ta_${block.id}_signalLine`] = result.signalLine;
          ctx.variables[`__ta_${block.id}_histogram`] = result.histogram;
        } else if (block.type === "BOLLINGER") {
          const period = Number(p.period ?? 20);
          const stdDev = Number(p.stdDev ?? 2);
          const result = bollingerBands(prices, period, stdDev);
          ctx.variables[`__ta_${block.id}`] = result.middle;
          ctx.variables[`__ta_${block.id}_upper`] = result.upper;
          ctx.variables[`__ta_${block.id}_lower`] = result.lower;
        } else if (block.type === "ATR") {
          const period = Number(p.period ?? 14);
          // Use price ± half-spread as high/low proxy (single price series)
          const halfSpread = 0.01;
          const highs = prices.map((price) => price + halfSpread);
          const lows = prices.map((price) => price - halfSpread);
          ctx.variables[`__ta_${block.id}`] = atr(highs, lows, prices, period);
        }
      }
    }

    // 0.5 Evaluate calculation blocks — produce computed values for downstream use
    if (this.calcBlocks.length > 0) {
      for (const block of this.calcBlocks) {
        const evaluator = CALC_REGISTRY[block.type];
        if (!evaluator) continue;

        const resolvedBlock = {
          ...block,
          params: resolveParams(
            { ...(block.config ?? {}), ...(block.params ?? {}) },
            ctx.variables ?? {},
          ),
        };

        // Gather numeric inputs from variables referenced in params
        const inputA = Number(resolvedBlock.params?.inputA ?? 0);
        const inputB = Number(resolvedBlock.params?.inputB ?? 0);
        const inputs = [inputA, inputB];

        const result = evaluator.evaluate(resolvedBlock, inputs, ctx);

        // Store the result in context variables so other blocks can reference it
        ctx.variables = ctx.variables ?? {};
        ctx.variables[`__calc_${block.id}`] = result.value;
        if (result.booleanValue !== undefined) {
          ctx.variables[`__calc_bool_${block.id}`] = result.booleanValue
            ? 1
            : 0;
        }
      }
    }

    // 2. Gate evaluation — SAFETY + TRIGGERS + CONDITIONS
    // When all blocks are WASM-compatible, evaluate off the main thread via
    // the worker pool.  On worker-pool failures, fall back to the TypeScript
    // evaluators so transient errors do not silently skip ticks.
    let wasmEvaluated = false;
    if (this.wasmGateCompatible && this.wasmWorkerPool) {
      const vars = ctx.variables ?? {};

      try {
        assertWasmEvaluationBudget([
          this.safety,
          this.triggers,
          this.conditions,
        ]);

        this.validateSafetyParamsForWasm(vars);
        this.validateTriggerParamsForWasm(vars);

        this.validateNoUnresolvedVariables(this.safety, vars);
        this.validateNoUnresolvedVariables(this.triggers, vars);
        this.validateNoUnresolvedVariables(this.conditions, vars);

        this.validateConditionParamsForWasm(vars);

        const wasmCtx = await this.buildWasmContext(ctx);

        if (
          this.hasSpreadDependentBlocks() &&
          wasmCtx.spread === 0 &&
          wasmCtx.best_bid === 0 &&
          wasmCtx.best_ask === 0
        ) {
          this.logger.warn(
            "WASM gate token has no book snapshot — skip tick, fall through to TS safety",
          );
          throw new Error("No book snapshot — evaluate TS safety gates");
        }

        const wasmResult = await this.wasmWorkerPool.evaluate(
          this.safety.map((b) => toWasmBlock(b, vars, "safety")),
          this.triggers.map((b) => toWasmBlock(b, vars, "trigger")),
          this.conditions.map((b) => toWasmBlock(b, vars, "condition")),
          [],
          wasmCtx,
        );
        wasmEvaluated = true;

        if (!wasmResult.safety_passed) {
          this.stop();
          await this.onStatusChange(
            "STOPPED",
            wasmResult.safety_reason ?? "WASM safety",
          );
          await this.prisma.strategy
            .update({
              where: { id: this.strategyId },
              data: { status: StrategyStatus.IDLE },
            })
            .catch(() => {});
          await this.emitStrategyEvent(
            "STRATEGY_STOPPED",
            wasmResult.safety_reason ?? undefined,
          );
          return;
        }
        if (!wasmResult.triggered) return;
        if (!wasmResult.conditions_met) return;
        // WASM gate passed — proceed to action execution below
      } catch (err: unknown) {
        this.logger.warn(
          `WASM evaluation failed, falling back to TypeScript gates: ${err instanceof Error ? err.message : String(err)}`,
        );
        // wasmEvaluated stays false → fall through to TS evaluators
      }
    }

    if (!wasmEvaluated) {
      // 2. SAFETY — any failure stops the strategy
      for (const block of this.safety) {
        let evaluator = SAFETY_REGISTRY[block.type];
        // Fail closed: unknown / unregistered safety block types must stop
        // the strategy. Skipping an unknown guard could allow a strategy to
        // keep trading without an intended safety stop.
        //
        // Backward compat: MAX_POSITION_SIZE was historically a dual-purpose
        // block placed under both safety and conditions.  It was moved to
        // CONDITION_REGISTRY-only, but legacy persisted strategies may still
        // carry it under safety.  The explicit LEGACY_SAFETY_ALIASES allowlist
        // evaluates it via CONDITION_REGISTRY as a safety guard: if the
        // condition passes (fired=true), safety passes; if it fails
        // (fired=false), the strategy is stopped.
        //
        // Restricting the fallback to an explicit allowlist prevents
        // misconfigured condition-only types (e.g. VENUE_SELECT,
        // minimize_fees) from being accepted as safety guards via the
        // fallback path — those would return fired=true and turn a
        // fail-closed safety boundary into fail-open.
        if (!evaluator) {
          if (LEGACY_SAFETY_ALIASES.has(block.type)) {
            const normalized = normalizeLegacyMaxPositionSafetyBlock(block);
            if (!normalized) {
              this.stop();
              await this.onStatusChange(
                "STOPPED",
                `legacy_safety_alias_missing_max:${block.type}`,
              );
              await this.prisma.strategy
                .update({
                  where: { id: this.strategyId },
                  data: { status: StrategyStatus.IDLE },
                })
                .catch(() => {});
              await this.emitStrategyEvent(
                "STRATEGY_STOPPED",
                `legacy_safety_alias_missing_max:${block.type}`,
              );
              return;
            }
            const fallbackEvaluator = SAFETY_REGISTRY[normalized.type];
            if (fallbackEvaluator) {
              const resolvedParams = resolveParams(
                { ...(normalized.config ?? {}), ...(normalized.params ?? {}) },
                ctx.variables ?? {},
              );
              if (isMissingLegacySafetyMax(resolvedParams.maxUsdc)) {
                this.stop();
                await this.onStatusChange(
                  "STOPPED",
                  `legacy_safety_alias_missing_max:${block.type}`,
                );
                await this.prisma.strategy
                  .update({
                    where: { id: this.strategyId },
                    data: { status: StrategyStatus.IDLE },
                  })
                  .catch(() => {});
                await this.emitStrategyEvent(
                  "STRATEGY_STOPPED",
                  `legacy_safety_alias_missing_max:${block.type}`,
                );
                return;
              }
              const resolvedBlock = {
                ...normalized,
                params: resolvedParams,
              };
              const result = await fallbackEvaluator.evaluate(
                resolvedBlock,
                ctx,
                this.redis,
                this.prisma,
              );
              if (!result.fired) {
                this.stop();
                await this.onStatusChange("STOPPED", result.reason);
                await this.prisma.strategy
                  .update({
                    where: { id: this.strategyId },
                    data: { status: StrategyStatus.IDLE },
                  })
                  .catch(() => {});
                await this.emitStrategyEvent("STRATEGY_STOPPED", result.reason);
                return;
              }
              continue;
            }
          }
          if (!evaluator) {
            // Unknown safety block — fail closed
            this.logger.error(
              `Unknown safety block type: ${block.type}. Failing closed for safety.`,
            );
            this.stop();
            await this.onStatusChange(
              "STOPPED",
              `Unknown safety block: ${block.type} (safety_block_type_missing:${block.type})`,
            );
            await this.prisma.strategy
              .update({
                where: { id: this.strategyId },
                data: { status: StrategyStatus.IDLE },
              })
              .catch(() => {});
            await this.emitStrategyEvent(
              "STRATEGY_STOPPED",
              `Unknown safety block: ${block.type} (safety_block_type_missing:${block.type})`,
            );
            return;
          }
        }

        const resolvedBlock = {
          ...block,
          params: resolveParams(
            StrategyRunner.mergedParams(block),
            ctx.variables ?? {},
          ),
        };
        const result = await evaluator.evaluate(
          resolvedBlock,
          ctx,
          this.redis,
          this.prisma,
        );
        if (!result.fired) {
          this.stop();
          await this.onStatusChange("STOPPED", result.reason);
          await this.prisma.strategy
            .update({
              where: { id: this.strategyId },
              data: { status: StrategyStatus.IDLE },
            })
            .catch(() => {});
          await this.emitStrategyEvent("STRATEGY_STOPPED", result.reason);
          return;
        }
      }

      // 3. TRIGGERS — any trigger must fire
      let triggerFired = this.triggers.length === 0; // no triggers = always fire
      for (const block of this.triggers) {
        const evaluator = TRIGGER_REGISTRY[block.type];
        if (!evaluator) continue;

        const resolvedBlock = {
          ...block,
          params: resolveParams(
            StrategyRunner.mergedParams(block),
            ctx.variables ?? {},
          ),
        };
        const result = await evaluator.evaluate(
          resolvedBlock,
          ctx,
          this.redis,
          this.prisma,
        );
        if (result.fired) {
          triggerFired = true;
          break;
        }
      }
      if (!triggerFired) return;

      // 4. CONDITIONS — ALL conditions must pass
      for (const block of this.conditions) {
        const evaluator = CONDITION_REGISTRY[block.type];
        if (!evaluator) {
          // Unknown condition — fail closed
          this.logger.warn(
            `Unknown condition block type: ${block.type}. Failing closed.`,
          );
          return; // condition failed, skip tick
        }

        const resolvedBlock = {
          ...block,
          params: resolveParams(
            StrategyRunner.mergedParams(block),
            ctx.variables ?? {},
          ),
        };
        const result = await evaluator.evaluate(
          resolvedBlock,
          ctx,
          this.redis,
          this.prisma,
        );
        if (!result.fired) return; // condition failed, skip tick
      }
    }

    // 5. LOGIC BLOCKS — evaluate in topological order if present
    if (this.logicBlocks.length > 0) {
      const logicResults = this.evaluateLogicGraph(ctx);
      // If any logic block produces false and gates the action pipeline,
      // the downstream connections determine whether actions fire.
      // For now, store results in context variables so actions can reference them.
      for (const [blockId, result] of logicResults.entries()) {
        const block = this.logicBlocks.find((b) => b.id === blockId);
        if (block) {
          ctx.variables = ctx.variables ?? {};
          ctx.variables[`__logic_${blockId}`] = result.value ? 1 : 0;
        }
      }
    }

    // 6. ACTIONS — collect all OrderIntents
    const allIntents: OrderIntent[] = [];
    for (const block of this.actions) {
      const evaluator = ACTION_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(
          { ...(block.config ?? {}), ...(block.params ?? {}) },
          ctx.variables ?? {},
        ),
      };
      const result = await evaluator.execute(
        resolvedBlock,
        ctx,
        this.redis,
        this.prisma,
      );
      allIntents.push(...result.intents);
    }

    // Separate RUN_STRATEGY sentinel intents from real order intents
    const runStrategyIntents = allIntents.filter(
      (i) => i.marketId === "__run_strategy__",
    );
    const orderIntents = allIntents.filter(
      (i) =>
        i.marketId !== "__run_strategy__" && i.tokenId !== "__cancel_all__",
    );

    // Guard: abort side effects if lock ownership was lost during
    // evaluation — the lock-renewal interval may have cleared the token
    // while evaluate() was waiting on WASM pool / Redis I/O.
    // Use lockToken (passed from tick()) as a stronger guard than just
    // null-checking activeLockToken: it ensures another instance hasn't
    // acquired the lock in the window between the check and the await.
    if (this.activeLockToken !== lockToken) return;

    // Handle sub-strategy launches
    for (const intent of runStrategyIntents) {
      if (this.activeLockToken !== lockToken) {
        this.logger.warn(
          `Tick ownership lost for ${this.strategyId} during sub-strategy launch loop — ${runStrategyIntents.length - runStrategyIntents.indexOf(intent)} remaining launch(es) discarded`,
        );
        break;
      }
      const childStrategyId = intent.tokenId;
      const mode = intent.size as SubStrategyMode;

      // Enforce max 10 concurrent sub-strategies
      if (this.childStrategies.size >= 10) {
        this.logger.warn(
          `Max concurrent sub-strategies (10) reached, skipping launch of ${childStrategyId}`,
        );
        continue;
      }

      // Skip if already running as a child
      if (this.childStrategies.has(childStrategyId)) {
        this.logger.debug(
          `Child strategy ${childStrategyId} already running, skipping`,
        );
        continue;
      }

      if (this.onRunStrategy) {
        try {
          await this.onRunStrategy(childStrategyId, this.strategyId, mode, {
            userId: ctx.userId,
          });
          this.addChild(childStrategyId, mode);
          this.logger.log(
            `Launched sub-strategy ${childStrategyId} in ${mode} mode`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to launch sub-strategy ${childStrategyId}: ${String(err)}`,
          );
        }
      }
    }

    if (orderIntents.length > 0 && this.activeLockToken === lockToken) {
      await this.onIntents(orderIntents);
    }
  }

  // ─── Logic graph evaluation ──────────────────────────────────────────────

  private evaluateLogicGraph(
    ctx: EvalContext,
  ): Map<string, { value: boolean; activeOutput?: string }> {
    const results = new Map<
      string,
      { value: boolean; activeOutput?: string }
    >();

    // Build adjacency: which logic blocks feed into which
    const incomingEdges = new Map<
      string,
      { source: string; sourceHandle?: string }[]
    >();
    for (const conn of this.logicConnections) {
      const list = incomingEdges.get(conn.target) ?? [];
      list.push({ source: conn.source, sourceHandle: conn.sourceHandle });
      incomingEdges.set(conn.target, list);
    }

    // Topological sort using Kahn's algorithm
    const blockIds = this.logicBlocks.map((b) => b.id);
    const inDegree = new Map<string, number>();
    for (const id of blockIds) inDegree.set(id, 0);

    for (const conn of this.logicConnections) {
      if (inDegree.has(conn.target)) {
        inDegree.set(conn.target, (inDegree.get(conn.target) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(id);

      for (const conn of this.logicConnections) {
        if (conn.source === id && inDegree.has(conn.target)) {
          const newDeg = (inDegree.get(conn.target) ?? 1) - 1;
          inDegree.set(conn.target, newDeg);
          if (newDeg === 0) queue.push(conn.target);
        }
      }
    }

    // Evaluate in topological order
    for (const blockId of sorted) {
      const block = this.logicBlocks.find((b) => b.id === blockId);
      if (!block) continue;

      const evaluator = LOGIC_REGISTRY[block.type];
      if (!evaluator) continue;

      // Gather input values from upstream blocks
      const incoming = incomingEdges.get(blockId) ?? [];
      const inputs: boolean[] = incoming.map((edge) => {
        const upstream = results.get(edge.source);
        if (!upstream) return false;
        // For IF_THEN_ELSE, check which output port matches
        if (edge.sourceHandle && upstream.activeOutput) {
          return edge.sourceHandle === upstream.activeOutput;
        }
        return upstream.value;
      });

      const resolvedBlock = {
        ...block,
        params: resolveParams(
          StrategyRunner.mergedParams(block),
          ctx.variables ?? {},
        ),
      };

      const result = evaluator.evaluate(resolvedBlock, inputs, ctx);
      results.set(blockId, result);

      // Handle DELAY blocks: schedule delayed execution
      if (block.type === "DELAY" && result.value) {
        const seconds = Number(StrategyRunner.mergedParams(block).seconds ?? 0);
        if (seconds > 0) {
          this.scheduleDelayedAction(blockId, seconds, result.value);
        }
      }
    }

    return results;
  }

  private scheduleDelayedAction(
    blockId: string,
    seconds: number,
    _value: boolean,
  ) {
    // Clear any existing timer for this block
    const existing = this.delayedActions.get(blockId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.delayedActions.delete(blockId);
      this.logger.debug(`Delay block ${blockId} fired after ${seconds}s`);
    }, seconds * 1000);

    this.delayedActions.set(blockId, timer);
  }

  /** Merge config + params with params taking priority (consistent with evaluation phases). */
  private static mergedParams(block: Block): Record<string, unknown> {
    return { ...(block.config ?? {}), ...(block.params ?? {}) };
  }

  /** Precomputed: all tokenIds referenced in triggers + actions */
  private _cachedTokenIds: string[] | null = null;

  private getReferencedTokenIds(): string[] {
    if (this._cachedTokenIds) return this._cachedTokenIds;
    const ids = new Set<string>();
    for (const block of [
      ...this.triggers,
      ...this.actions,
      ...this.conditions,
    ]) {
      const params = StrategyRunner.mergedParams(block);
      if (params?.tokenId && typeof params.tokenId === "string")
        ids.add(params.tokenId);
    }
    this._cachedTokenIds = [...ids];
    return this._cachedTokenIds;
  }

  /** Returns the first tokenId found in triggers or actions (for variable scope). */
  private getPrimaryTokenId(): string | null {
    return this.getReferencedTokenIds()[0] ?? null;
  }

  /** Token IDs used for stale-price detection — includes token-scoped conditions. */
  private getStalePriceTokenIds(): string[] {
    const ids = new Set<string>();
    for (const block of [...this.triggers, ...this.actions]) {
      const params = StrategyRunner.mergedParams(block);
      if (params?.tokenId && typeof params.tokenId === "string")
        ids.add(params.tokenId);
    }
    // Include token-scoped conditions (e.g. SPREAD_BELOW_CONDITION)
    // so stale detection covers cross-token condition strategies.
    for (const block of this.conditions) {
      if (
        !TOKEN_SCOPED_WASM_TYPES.has(canonicalWasmType(block.type, "condition"))
      )
        continue;
      const params = StrategyRunner.mergedParams(block);
      if (params?.tokenId && typeof params.tokenId === "string")
        ids.add(params.tokenId);
    }
    return [...ids];
  }

  /**
   * Check staleness using price data already fetched in-memory (from
   * getStateAndPrices pipeline).  Avoids a second Redis round-trip.
   */
  private detectStaleFromPrices(
    tokenIds: string[],
    prices: Map<string, { price: number; timestamp: number } | null>,
  ): string | null {
    const now = Date.now();
    for (const id of tokenIds) {
      const raw = prices.get(id);
      if (!raw) return id;
      if (now - raw.timestamp > STALE_PRICE_MS) return id;
    }
    return null;
  }

  /**
   * Fallback staleness check used by the auto-resume path in tick().
   * Uses a single GET when there is only one token (no unnecessary MGET
   * overhead for the common single-token strategy).
   */
  private async detectStaleData(): Promise<string | null> {
    const tokenIds = this.getStalePriceTokenIds();
    if (tokenIds.length === 0) return null;

    if (tokenIds.length === 1) {
      const key = `cache:price:${tokenIds[0]}`;
      try {
        const raw = await this.redis.getClient().get(key);
        if (!raw) return tokenIds[0];
        const { timestamp } = JSON.parse(raw) as { timestamp: number };
        if (Date.now() - timestamp > STALE_PRICE_MS) return tokenIds[0];
        return null;
      } catch {
        return tokenIds[0];
      }
    }

    const keys = tokenIds.map((id) => `cache:price:${id}`);
    const values = await this.redis.getClient().mget(...keys);
    const now = Date.now();

    for (let i = 0; i < tokenIds.length; i++) {
      const raw = values[i];
      if (!raw) return tokenIds[i];
      try {
        const { timestamp } = JSON.parse(raw) as { timestamp: number };
        if (now - timestamp > STALE_PRICE_MS) return tokenIds[i];
      } catch {
        return tokenIds[i];
      }
    }
    return null;
  }

  private async buildWasmContext(ctx: EvalContext): Promise<WasmEvalContext> {
    const tokenId =
      this.getWasmGateToken() ?? this.getReferencedTokenIds()[0] ?? null;

    let currentPrice = 0;
    let previousPrice: number | undefined;
    let bestBid = 0;
    let bestAsk = 0;
    let spread = 0;
    let volume24h = 0;

    if (tokenId) {
      const priceData = await this.state.getPrice(tokenId);
      currentPrice = priceData?.price ?? 0;

      const prevRaw = await this.redis
        .getClient()
        .get(`cache:price:prev:${tokenId}`);
      if (prevRaw) {
        try {
          const prev = JSON.parse(prevRaw) as { price: number };
          previousPrice = prev.price;
        } catch {
          // Ignore parse errors — use undefined
        }
      }

      const bookData = await this.state.getBook(tokenId);
      if (bookData) {
        bestBid = bookData.bids.length > 0 ? Number(bookData.bids[0].price) : 0;
        bestAsk = bookData.asks.length > 0 ? Number(bookData.asks[0].price) : 0;
        spread = Number(bookData.spread);

        for (const bid of bookData.bids) {
          const bp = Number(bid.price);
          const bs = Number(bid.size);
          if (Number.isFinite(bp) && Number.isFinite(bs)) {
            volume24h += bp * bs;
          }
        }
      }
    }

    let totalExposure = 0;
    let openPositions = 0;
    let hasNonFiniteExposure = false;
    let pendingOrdersCount = 0;

    if (this.hasExposureDependentBlocks()) {
      const positions = await this.prisma.position.findMany({
        where: { userId: ctx.userId },
        select: { size: true, currentPrice: true },
      });
      for (const p of positions) {
        const size = Number(p.size);
        const price = Number(p.currentPrice);
        if (!Number.isFinite(size) || !Number.isFinite(price)) {
          hasNonFiniteExposure = true;
          continue;
        }
        totalExposure += size * price;
        openPositions += 1;
      }

      const pendingOrders = await this.prisma.order.findMany({
        where: {
          userId: ctx.userId,
          side: "BUY",
          status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
        },
        select: { size: true, price: true },
      });
      pendingOrdersCount = pendingOrders.length;
      for (const o of pendingOrders) {
        const size = Number(o.size);
        const price = Number(o.price);
        if (!Number.isFinite(size) || !Number.isFinite(price)) {
          hasNonFiniteExposure = true;
          continue;
        }
        totalExposure += size * price;
      }
    }

    if (hasNonFiniteExposure) {
      totalExposure = Number.MAX_VALUE;
    }

    const rawVariables = ctx.variables ?? {};
    const cleanVariables: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawVariables)) {
      if (Number.isFinite(value)) {
        cleanVariables[key] = value;
      }
    }

    return {
      current_price: currentPrice,
      previous_price: previousPrice,
      best_bid: bestBid,
      best_ask: bestAsk,
      spread,
      volume_24h: volume24h,
      daily_pnl: ctx.state.dailyPnl,
      total_exposure: totalExposure,
      open_positions: openPositions,
      pending_orders: pendingOrdersCount,
      consecutive_losses: ctx.state.consecutiveLoss,
      orders_today: this.hasMaxOrdersTotalBlock()
        ? ctx.state.totalOrders
        : ctx.state.betsToday,
      variables: cleanVariables,
    };
  }

  private async emitStrategyEvent(type: string, reason?: string) {
    await this.redis.xadd("stream:events", {
      type,
      strategyId: this.strategyId,
      userId: this.userId,
      reason: reason ?? "",
      ts: String(Date.now()),
    });
  }
}
