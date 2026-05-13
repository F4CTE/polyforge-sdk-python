import { BlockEvaluator, BlockResult } from "./block.types";
import { PrismaService } from "@polyforge/shared-db";
import { parseFiniteDecimal } from "@polyforge/shared-types";

type BlockParams = Record<string, string | number | undefined>;

/** Shared helper: get total USDC exposure for user including pending orders */
async function getUserExposure(
  userId: string,
  prisma: PrismaService,
): Promise<number> {
  const positions = await prisma.position.findMany({
    where: { userId },
    select: { size: true, currentPrice: true },
  });
  const positionExposure = positions.reduce((sum, p) => {
    const size = parseFiniteDecimal(p.size);
    const currentPrice = parseFiniteDecimal(p.currentPrice);
    if (size === null || currentPrice === null) return Number.POSITIVE_INFINITY;
    return sum + size * currentPrice;
  }, 0);

  const pendingOrders = await prisma.order.findMany({
    where: {
      userId,
      side: "BUY",
      status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
    },
    select: { size: true, price: true },
  });
  const orderExposure = pendingOrders.reduce((sum, o) => {
    const size = parseFiniteDecimal(o.size);
    const price = parseFiniteDecimal(o.price);
    if (size === null || price === null) return Number.POSITIVE_INFINITY;
    return sum + size * price;
  }, 0);

  return positionExposure + orderExposure;
}

// ─── SAFETY: stop_if_daily_loss ───────────────────────────────────────────────
export const StopIfDailyLossBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const maxLoss = parseFiniteDecimal(params.maxLossUsdc ?? "0");
    if (maxLoss === null) {
      return Promise.resolve({
        fired: false,
        reason: "SAFETY STOP: invalid maxLossUsdc",
      });
    }
    const passed = ctx.state.dailyPnl > -maxLoss;
    return Promise.resolve({
      fired: passed,
      reason: passed
        ? `dailyPnl ${ctx.state.dailyPnl} > -${maxLoss}`
        : `SAFETY STOP: daily loss ${Math.abs(ctx.state.dailyPnl)} exceeds limit ${maxLoss}`,
    });
  },
};

// ─── SAFETY: stop_if_orders_per_min ───────────────────────────────────────────
export const StopIfOrdersPerMinBlock: BlockEvaluator = {
  async evaluate(block, ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const maxOrders = parseInt(String(params.maxOrders ?? "60"), 10);
    const windowKey = `strategy:${ctx.strategyId}:orders:min`;
    const count = await redis.get(windowKey);
    const current = parseInt(count ?? "0", 10);
    const passed = current < maxOrders;
    return {
      fired: passed,
      reason: passed
        ? `orders/min ${current} < ${maxOrders}`
        : `SAFETY STOP: orders/min ${current} >= ${maxOrders}`,
    };
  },
};

// ─── SAFETY: stop_if_consecutive_loss ─────────────────────────────────────────
export const StopIfConsecutiveLossBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const maxLosses = parseInt(String(params.maxLosses ?? "3"), 10);
    const passed = ctx.state.consecutiveLoss < maxLosses;
    return Promise.resolve({
      fired: passed,
      reason: passed
        ? `consecutive losses ${ctx.state.consecutiveLoss} < ${maxLosses}`
        : `SAFETY STOP: ${ctx.state.consecutiveLoss} consecutive losses`,
    });
  },
};

// ─── SAFETY: stop_if_exposure_exceeds ─────────────────────────────────────────
export const StopIfExposureExceedsBlock: BlockEvaluator = {
  async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const maxUsdc = parseFiniteDecimal(params.maxUsdc ?? "0");
    if (maxUsdc === null) {
      return {
        fired: false,
        reason: "SAFETY STOP: invalid maxUsdc",
      };
    }
    if (maxUsdc === 0) {
      return {
        fired: true,
        reason: "no maxUsdc limit set",
      };
    }
    const exposure = await getUserExposure(ctx.userId, prisma);
    const passed = exposure < maxUsdc;
    return {
      fired: passed,
      reason: passed
        ? `exposure $${exposure.toFixed(2)} < $${maxUsdc}`
        : `SAFETY STOP: exposure $${exposure.toFixed(2)} >= $${maxUsdc}`,
    };
  },
};

// ─── SAFETY: pause_after_fill ─────────────────────────────────────────────────
export const PauseAfterFillBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const pauseMs = parseInt(String(params.pauseMs ?? "0"), 10);
    const elapsed = ctx.now - ctx.state.lastTradeAt;
    const passed = elapsed >= pauseMs;
    return Promise.resolve({
      fired: passed,
      reason: passed
        ? `cooldown elapsed (${elapsed}ms >= ${pauseMs}ms)`
        : `SAFETY PAUSE: waiting ${pauseMs - elapsed}ms after last fill`,
    });
  },
};

// ─── SAFETY: max_orders_total ─────────────────────────────────────────────────
export const MaxOrdersTotalBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const max = parseInt(String(params.max ?? "0"), 10);
    const passed = ctx.state.totalOrders < max;
    return Promise.resolve({
      fired: passed,
      reason: passed
        ? `totalOrders ${ctx.state.totalOrders} < ${max}`
        : `SAFETY STOP: reached max total orders ${max}`,
    });
  },
};
