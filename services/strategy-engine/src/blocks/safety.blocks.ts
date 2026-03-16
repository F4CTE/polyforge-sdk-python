import { BlockEvaluator, BlockResult, EvalContext } from './block.types';
import { RedisService } from '@polyforge/shared-redis';
import { PrismaService } from '@polyforge/shared-db';

/** Shared helper: get total USDC exposure for user */
async function getUserExposure(userId: string, prisma: PrismaService): Promise<number> {
    const positions = await prisma.position.findMany({
        where: { userId },
        select: { size: true, currentPrice: true },
    });
    return positions.reduce((sum, p) => {
        return sum + parseFloat(p.size) * parseFloat(p.currentPrice);
    }, 0);
}

// ─── SAFETY: stop_if_daily_loss ───────────────────────────────────────────────
export const StopIfDailyLossBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
        const maxLoss = parseFloat((block['params'] as any)?.maxLossUsdc ?? '0');
        const passed = ctx.state.dailyPnl > -maxLoss;
        return {
            fired: passed,
            reason: passed
                ? `dailyPnl ${ctx.state.dailyPnl} > -${maxLoss}`
                : `SAFETY STOP: daily loss ${Math.abs(ctx.state.dailyPnl)} exceeds limit ${maxLoss}`,
        };
    },
};

// ─── SAFETY: stop_if_orders_per_min ───────────────────────────────────────────
export const StopIfOrdersPerMinBlock: BlockEvaluator = {
    async evaluate(block, ctx, redis, _prisma): Promise<BlockResult> {
        const maxOrders = parseInt((block['params'] as any)?.maxOrders ?? '60', 10);
        const windowKey = `strategy:${ctx.strategyId}:orders:min`;
        const count = await redis.get(windowKey);
        const current = parseInt(count ?? '0', 10);
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
    async evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
        const maxLosses = parseInt((block['params'] as any)?.maxLosses ?? '3', 10);
        const passed = ctx.state.consecutiveLoss < maxLosses;
        return {
            fired: passed,
            reason: passed
                ? `consecutive losses ${ctx.state.consecutiveLoss} < ${maxLosses}`
                : `SAFETY STOP: ${ctx.state.consecutiveLoss} consecutive losses`,
        };
    },
};

// ─── SAFETY: stop_if_exposure_exceeds ─────────────────────────────────────────
export const StopIfExposureExceedsBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
        const maxUsdc = parseFloat((block['params'] as any)?.maxUsdc ?? '0');
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
    async evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
        const pauseMs = parseInt((block['params'] as any)?.pauseMs ?? '0', 10);
        const elapsed = ctx.now - ctx.state.lastTradeAt;
        const passed = elapsed >= pauseMs;
        return {
            fired: passed,
            reason: passed
                ? `cooldown elapsed (${elapsed}ms >= ${pauseMs}ms)`
                : `SAFETY PAUSE: waiting ${pauseMs - elapsed}ms after last fill`,
        };
    },
};

// ─── SAFETY: max_orders_total ─────────────────────────────────────────────────
export const MaxOrdersTotalBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
        const max = parseInt((block['params'] as any)?.max ?? '0', 10);
        const passed = ctx.state.totalOrders < max;
        return {
            fired: passed,
            reason: passed
                ? `totalOrders ${ctx.state.totalOrders} < ${max}`
                : `SAFETY STOP: reached max total orders ${max}`,
        };
    },
};
