import { randomUUID } from "node:crypto";
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

/** Redis key for daily execution counter — resets at midnight UTC */
const dailyExecKey = (strategyId: string): string => {
  const d = new Date();
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return `beta:executions:${strategyId}:${date}`;
};

const MIN_TICK_MS = 200;
const STALE_PRICE_MS = 5_000;
const MAX_STALE_CHECK_BACKOFF_MS = 60_000;

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
  private delayedActions: Map<string, NodeJS.Timeout> = new Map();
  private lastTickMs = -MIN_TICK_MS;
  private lastStaleCheckMs = 0;
  private staleCheckBackoffMs = STALE_PRICE_MS;
  private tickInFlight = false;
  private pendingTick = false;
  /** True when a follow-up tick is scheduled — bypasses the min-tick throttle */
  private scheduledFollowUp = false;

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

  /** Tracks which pendingRedisUnlock promise already has a chained retry
   *  scheduled on it.  Used as a one-shot guard so only one retry is
   *  chained per pendingRedisUnlock instance — preventing duplicate
   *  tick() calls when multiple ticks queue up behind the same in-flight
   *  unlock. */
  private pendingRedisUnlockRetry: Promise<unknown> | null = null;

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
  ) {
    this.logger = new Logger(`StrategyRunner:${strategyId}`);
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

  /** Returns the reason the runner was paused, or null if not paused */
  get pauseReason(): string | null {
    return this._pauseReason;
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
    // Clear the follow-up timer for TICK/HYBRID coalesced ticks
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

    // Min-tick throttle for EVENT/HYBRID mode to prevent bursty
    // every-tick triggers from firing on every incoming price event.
    // Bypassed for internally-scheduled follow-up ticks (deferred work
    // that was coalesced while the lock was held).
    if (this.execMode === "EVENT" || this.execMode === "HYBRID") {
      const followUp = this.scheduledFollowUp;
      this.scheduledFollowUp = false;
      if (!followUp) {
        const now = Date.now();
        if (now - this.lastTickMs < MIN_TICK_MS) return;
        this.lastTickMs = now;
      } else {
        // Advance lastTickMs when consuming a coalesced follow-up tick
        // so that events arriving during this evaluation still respect
        // MIN_TICK_MS spacing and cannot start an immediate back-to-back
        // follow-up chain that defeats the throttle.
        this.lastTickMs = Date.now();
      }
    }

    // In-process coalescing: only one tick evaluates at a time.
    if (this.tickInFlight) {
      this.pendingTick = true;
      return;
    }

    this.tickInFlight = true;
    let lockAcquired = false;
    let lockRefresh: NodeJS.Timeout | null = null;
    const lockToken = randomUUID();
    try {
      // Distributed lock: prevent concurrent evaluation across multiple
      // strategy-engine instances via Redis SET NX with a 10s TTL.
      // A per-acquisition token (lockToken) prevents stale unlocks: if a
      // tick overruns the TTL and a subsequent tick reacquires the lock,
      // the older tick's finally block can no longer match and delete it.
      const redisClient = this.redis.getClient();
      const lockKey = `lock:tick:${this.strategyId}`;
      const acquired = await redisClient.set(
        lockKey,
        lockToken,
        "EX",
        10,
        "NX",
      );
      if (!acquired) return;
      lockAcquired = true;

      // Cancel any pending delayed follow-up timer now that a real
      // evaluation is starting.  Only cleared after SET NX succeeds:
      // clearing before lock acquisition can drop the only scheduled
      // retry when the lock is held by another instance, leaving the
      // strategy idle until a fresh market event arrives.
      if (this.followUpTimer) {
        clearTimeout(this.followUpTimer);
        this.followUpTimer = null;
      }
      this.activeLockToken = lockToken;

      // Periodically refresh the lock TTL during long-running evaluations.
      // Uses an atomic Lua check-and-extend script that verifies this runner
      // still owns the lock (GET == lockToken) before extending the TTL.
      // - If ownership is lost (key expired or re-acquired by another instance),
      //   the interval self-cancels and stops extending the foreign lock.
      // - If Redis is unreachable during refresh, the interval self-cancels
      //   rather than silently continuing without protection.
      lockRefresh = setInterval(() => {
        redisClient
          .eval(
            "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) else return 0 end",
            1,
            lockKey,
            lockToken,
            "10",
          )
          .then((result) => {
            // Ignore if this callback is from a previous tick whose lock
            // token no longer matches the active acquisition.
            if (this.activeLockToken !== lockToken) return;
            if (result !== 1 && lockRefresh) {
              clearInterval(lockRefresh);
              lockRefresh = null;
              this.activeLockToken = null;
            }
          })
          .catch(() => {
            // Ignore if this callback is from a previous tick whose lock
            // token no longer matches the active acquisition.
            if (this.activeLockToken !== lockToken) return;
            if (lockRefresh) {
              clearInterval(lockRefresh);
              lockRefresh = null;
            }
            this.activeLockToken = null;
          });
      }, 5_000);

      // Enforce daily execution limit — auto-stop if exceeded
      const key = dailyExecKey(this.strategyId);
      const count = await redisClient.incr(key);
      if (count === 1) {
        // New key: set TTL to 25 hours so it expires safely after UTC midnight
        await redisClient.expire(key, 90_000);
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

      await this.evaluate();
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
      // Stop the lock-refresh interval and nullify the handle so any
      // already-queued Promise callbacks from this tick's interval catch
      // the nulled reference and cannot mutate activeLockToken during
      // a subsequent tick.
      if (lockRefresh) {
        clearInterval(lockRefresh);
        lockRefresh = null;
      }

      // Release the lock token so stale refresh callbacks from a prior
      // tick can never match and spuriously clear the active token during
      // a later evaluation.
      if (this.activeLockToken === lockToken) {
        this.activeLockToken = null;
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
      if (this.pendingTick) {
        this.pendingTick = false;
        if (lockAcquired) {
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
          // One-shot guard: only chain one retry per pendingRedisUnlock
          // promise instance.  Without this guard, multiple ticks that
          // fail SET NX behind the same in-flight unlock would each
          // attach a .finally() callback, firing duplicate tick() calls
          // when the unlock finally completes.
          if (this.pendingRedisUnlock !== this.pendingRedisUnlockRetry) {
            this.pendingRedisUnlockRetry = this.pendingRedisUnlock;
            if (this.followUpTimer) clearTimeout(this.followUpTimer);
            void this.pendingRedisUnlock
              .finally(() => {
                if (this.status === "RUNNING") {
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
      } else if (!lockAcquired && this.status === "RUNNING") {
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
          // One-shot guard: only chain one retry per pendingRedisUnlock
          // promise instance (same rationale as the pendingTick branch
          // above).
          if (this.pendingRedisUnlock !== this.pendingRedisUnlockRetry) {
            this.pendingRedisUnlockRetry = this.pendingRedisUnlock;
            // Bypass the min-tick throttle when the retry fires so the
            // evaluation is not blocked by lastTickMs having been advanced
            // by the failed tick itself.
            if (this.followUpTimer) clearTimeout(this.followUpTimer);
            void this.pendingRedisUnlock
              .finally(() => {
                if (this.status === "RUNNING") {
                  this.scheduledFollowUp = true;
                  void this.tick();
                }
              })
              .catch(() => {});
          }
        } else if (
          (this.execMode === "HYBRID" || this.execMode === "EVENT") &&
          this.followUpTimer === null
        ) {
          if (this.execMode === "HYBRID") {
            this.followUpTimer = setTimeout(() => {
              this.followUpTimer = null;
              this.scheduledFollowUp = true;
              void this.tick();
            }, 200);
          } else {
            // EVENT-mode crash-recovery: when SET NX fails and
            // pendingRedisUnlock is null, the lock is genuinely held by
            // another instance.  If that instance crashes without releasing
            // the lock, the lock key expires after the TTL (10s) and no
            // price event is guaranteed to arrive.
            //
            // Schedule a one-shot retry after the TTL + jitter (1-2s).
            // Before re-entering tick(), GET the lock key to distinguish
            // between a live holder (key exists → skip, no duplicate eval)
            // and a crashed holder (key expired → safe to re-evaluate).
            //
            // This avoids the duplicate-evaluation problem: in normal
            // multi-instance contention the winner refreshes the key every
            // 5s, so the key still exists after 12s and the retry is a
            // no-op.
            const lockTTL = 10_000;
            const jitter = 1_000 + Math.floor(Math.random() * 2_000);
            const lockKey = `lock:tick:${this.strategyId}`;
            this.followUpTimer = setTimeout(() => {
              this.followUpTimer = null;
              try {
                const redisClient = this.redis.getClient();
                redisClient.get(lockKey).then((val: string | null) => {
                  if (val === null && this.status === "RUNNING") {
                    this.scheduledFollowUp = true;
                    void this.tick();
                  }
                }).catch(() => {});
              } catch {
                // .get may not be available on test mocks — skip.
              }
            }, lockTTL + jitter);
          }
        }
      }

      // Release the Redis distributed lock asynchronously — do NOT block
      // the tick-processing pipeline on Redis unlock latency.  The lock
      // carries a 10s TTL and self-expires if this no-await call fails
      // or is delayed.
      //
      // The pending promise is exposed so EVENT-mode lock-miss paths can
      // distinguish a failed SET NX caused by our own unfinished unlock
      // (race window — must retry) from a failed SET NX caused by another
      // instance holding the lock (multi-instance dedup — must not retry).
      if (lockAcquired) {
        const redisClient = this.redis.getClient();
        const lockKey = `lock:tick:${this.strategyId}`;
        const unlockPromise = redisClient.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken,
        );
        const thisUnlock = unlockPromise;
        this.pendingRedisUnlock = thisUnlock;
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
    }
  }

  private async evaluate() {
    // 0. Fetch strategy state + all referenced price caches in a single
    //    Redis pipeline.  This eliminates the old double-read where
    //    state.get() and detectStaleData() each fetched prices separately.
    const tokenIds = this.getReferencedTokenIds();
    const { state: stateData, prices } = await this.state.getStateAndPrices(
      this.strategyId,
      tokenIds,
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
    const staleToken = this.detectStaleFromPrices(tokenIds, prices);
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

      const primaryTokenId = tokenIds[0];
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

    // 2. SAFETY — any failure stops the strategy
    for (const block of this.safety) {
      const evaluator = SAFETY_REGISTRY[block.type];
      // Fail closed: unknown / unregistered safety block types must stop
      // the strategy. Skipping an unknown guard could allow a strategy to
      // keep trading without an intended safety stop.
      //
      // Backward compat: legacy configs may carry MAX_POSITION_SIZE (and
      // other historically dual-purpose blocks) under safety instead of
      // conditions. When a safety block type is not in SAFETY_REGISTRY,
      // fall through to CONDITION_REGISTRY before failing closed. The
      // condition evaluator is used as a safety guard: if the condition
      // passes (fired=true), safety passes; if it fails (fired=false),
      // the strategy is stopped.
      if (!evaluator) {
        const fallbackEvaluator = CONDITION_REGISTRY[block.type];
        if (fallbackEvaluator) {
          const resolvedBlock = {
            ...block,
            params: resolveParams(
              { ...(block.config ?? {}), ...(block.params ?? {}) },
              ctx.variables ?? {},
            ),
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

        this.stop();
        await this.onStatusChange(
          "STOPPED",
          `safety_block_type_missing:${block.type}`,
        );
        await this.prisma.strategy
          .update({
            where: { id: this.strategyId },
            data: { status: StrategyStatus.IDLE },
          })
          .catch(() => {});
        await this.emitStrategyEvent(
          "STRATEGY_STOPPED",
          `safety_block_type_missing:${block.type}`,
        );
        return;
      }

      const resolvedBlock = {
        ...block,
        params: resolveParams(
          { ...(block.config ?? {}), ...(block.params ?? {}) },
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
          { ...(block.config ?? {}), ...(block.params ?? {}) },
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
      // Fail closed: unknown / unregistered condition block types must
      // abort the tick. Skipping an unknown condition could allow actions
      // to fire when a condition type is missing or unsupported.
      if (!evaluator) {
        this.logger.warn(
          `Unknown condition block type: ${block.type}. Failing closed.`,
        );
        return;
      }

      const resolvedBlock = {
        ...block,
        params: resolveParams(
          { ...(block.config ?? {}), ...(block.params ?? {}) },
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

    // Abort tick if lock ownership was lost mid-evaluation.
    // The lock-refresh handler (setInterval in tick()) clears activeLockToken
    // when the Lua GET==lockToken check returns non-1 — meaning the key
    // expired or was re-acquired by another instance. Continuing through
    // evaluate() after ownership loss can emit duplicate order intents and
    // launch duplicate sub-strategies across instances.
    if (this.activeLockToken === null) {
      this.logger.warn(
        `Tick ownership lost for ${this.strategyId} — discarding ${orderIntents.length} order intent(s) and ${runStrategyIntents.length} sub-strategy launch(es)`,
      );
      return;
    }

    // Handle sub-strategy launches.
    // Re-check lock ownership before every onRunStrategy() call: a long
    // sub-strategy launch can outlive the Redis lock-refresh interval.
    // If the activeLockToken was cleared mid-loop by a stale callback or
    // ownership-loss event, continuing to launch additional sub-strategies
    // would violate the cross-instance mutual-exclusion guarantee.
    for (const intent of runStrategyIntents) {
      if (this.activeLockToken === null) {
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
          continue;
        }
        // Ownership may have been lost during the awaited launch call.
        // Stop launching further sub-strategies to preserve the
        // cross-instance mutual-exclusion guarantee.
        if (this.activeLockToken === null) {
          this.logger.warn(
            `Tick ownership lost for ${this.strategyId} after launching ${childStrategyId} — discarding remaining sub-strategy launches`,
          );
          break;
        }
      }
    }

    // Re-check lock ownership after sub-strategy launches — those await
    // onRunStrategy() calls may have taken long enough for ownership to
    // flip mid-tick.  Emitting orders after ownership loss reintroduces
    // the duplicate-side-effect race the lock is meant to prevent.
    if (this.activeLockToken === null) {
      this.logger.warn(
        `Tick ownership lost for ${this.strategyId} before emitting ${orderIntents.length} order intent(s) — discarding`,
      );
      return;
    }

    if (orderIntents.length > 0) {
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
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };

      const result = evaluator.evaluate(resolvedBlock, inputs, ctx);
      results.set(blockId, result);

      // Handle DELAY blocks: schedule delayed execution
      if (block.type === "DELAY" && result.value) {
        const seconds = Number(block.params?.seconds ?? 0);
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
    for (const block of [...this.triggers, ...this.actions]) {
      const params = StrategyRunner.mergedParams(block);
      if (params?.tokenId && typeof params.tokenId === "string")
        ids.add(params.tokenId);
    }
    this._cachedTokenIds = [...ids];
    return this._cachedTokenIds;
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
    const tokenIds = this.getReferencedTokenIds();
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
