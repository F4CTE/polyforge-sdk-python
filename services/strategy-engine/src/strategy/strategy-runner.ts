import { Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { Parser } from "expr-eval";
import { StrategyStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { StrategyVariable } from "@polyforge/shared-types";
import { EvalContext, OrderIntent } from "../blocks/block.types";
import {
  SAFETY_REGISTRY,
  TRIGGER_REGISTRY,
  CONDITION_REGISTRY,
  ACTION_REGISTRY,
} from "../blocks/registry";
import { resolveParams } from "../blocks/resolve-params";
import { StateService } from "../state/state.service";

const MIN_TICK_MS = 200;
const STALE_PRICE_MS = 5_000;

export type StrategyRunnerStatus = "RUNNING" | "PAUSED" | "STOPPED";

interface Block {
  id: string;
  type: string;
  params?: Record<string, unknown>;
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
  private pauseReason: string | null = null;

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
    private readonly prisma: PrismaService,
    private readonly state: StateService,
    private readonly onIntents: (intents: OrderIntent[]) => Promise<void>,
    private readonly onStatusChange: (
      status: StrategyRunnerStatus,
      reason?: string,
    ) => Promise<void>,
  ) {
    this.logger = new Logger(`StrategyRunner:${strategyId}`);
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
    this.pauseReason = reason;
    this.logger.log(`Paused: ${reason}`);
  }

  resume() {
    this.status = "RUNNING";
    this.pauseReason = null;
    this.logger.log("Resumed");
  }

  stop() {
    this.status = "STOPPED";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log("Stopped");
  }

  /** Called on price events from market-data-service (EVENT/HYBRID mode) */
  async onPriceEvent(tokenId: string, price: number) {
    if (this.execMode === "EVENT" || this.execMode === "HYBRID") {
      await this.tick();
    }
  }

  // ─── Core evaluation pipeline ─────────────────────────────────────────────

  private async tick() {
    if (this.status !== "RUNNING") return;

    try {
      await this.evaluate();
    } catch (err) {
      this.logger.error("Tick evaluation failed", err);
    }
  }

  private async evaluate() {
    const stateData = await this.state.get(this.strategyId);
    const ctx: EvalContext = {
      strategyId: this.strategyId,
      userId: this.userId,
      state: stateData,
      now: Date.now(),
    };

    // 0. Evaluate user-defined calculation variables
    const variables: Record<string, number> = {};
    if (this.variables.length > 0) {
      const parser = new Parser();
      const scope: Record<string, number> = {
        dailyPnl: stateData.dailyPnl,
        betsToday: stateData.betsToday,
        consecutiveLoss: stateData.consecutiveLoss,
        consecutiveWin: stateData.consecutiveWin,
        totalOrders: stateData.totalOrders,
      };

      // Try to resolve currentPrice from the first trigger/action tokenId
      const primaryTokenId = this.getPrimaryTokenId();
      if (primaryTokenId) {
        const priceData = await this.state.getPrice(primaryTokenId);
        scope.currentPrice = priceData?.price ?? 0;
      }

      for (const v of this.variables) {
        try {
          variables[v.name] = parser.evaluate(v.expression, {
            ...scope,
            ...variables,
          });
        } catch {
          this.logger.warn(
            `Variable "${v.name}" evaluation failed: ${v.expression}`,
          );
        }
      }
    }
    ctx.variables = variables;

    // 1. Check stale data — pause if any subscribed token's price is stale
    const staleToken = await this.detectStaleData();
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

    // Auto-resume from stale pause when data is fresh again
    if (
      this.status === "PAUSED" &&
      this.pauseReason?.startsWith("stale_market_data")
    ) {
      this.resume();
      await this.onStatusChange("RUNNING");
      await this.emitStrategyEvent("STRATEGY_STARTED");
    }

    // 2. SAFETY — any failure stops the strategy
    for (const block of this.safety) {
      const evaluator = SAFETY_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.evaluate(
        resolvedBlock as any,
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
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.evaluate(
        resolvedBlock as any,
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
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.evaluate(
        resolvedBlock as any,
        ctx,
        this.redis,
        this.prisma,
      );
      if (!result.fired) return; // condition failed, skip tick
    }

    // 5. ACTIONS — collect all OrderIntents
    const allIntents: OrderIntent[] = [];
    for (const block of this.actions) {
      const evaluator = ACTION_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.execute(
        resolvedBlock as any,
        ctx,
        this.redis,
        this.prisma,
      );
      allIntents.push(...result.intents);
    }

    if (allIntents.length > 0) {
      // Update state: increment betsToday
      await this.state.update(this.strategyId, {
        betsToday: stateData.betsToday + allIntents.length,
        totalOrders: stateData.totalOrders + allIntents.length,
        lastTradeAt: ctx.now,
      });

      await this.onIntents(allIntents);
    }
  }

  /** Returns the first tokenId found in triggers or actions (for variable scope). */
  private getPrimaryTokenId(): string | null {
    for (const block of [...this.triggers, ...this.actions]) {
      const params = block.params;
      if (params?.tokenId && typeof params.tokenId === "string") {
        return params.tokenId;
      }
    }
    return null;
  }

  private async detectStaleData(): Promise<string | null> {
    // Check all tokenIds referenced in triggers + actions
    const tokenIds = new Set<string>();

    for (const block of [...this.triggers, ...this.actions]) {
      const params = (block as any).params;
      if (params?.tokenId) tokenIds.add(params.tokenId);
    }

    for (const tokenId of tokenIds) {
      const age = await this.state.getPriceAge(tokenId);
      if (age > STALE_PRICE_MS) return tokenId;
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
