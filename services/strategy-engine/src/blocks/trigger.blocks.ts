import { BlockEvaluator, BlockResult, EvalContext } from './block.types';
import { RedisService } from '@polyforge/shared-redis';
import { PrismaService } from '@polyforge/shared-db';

// ─── EVENT TRIGGERS ───────────────────────────────────────────────────────────

// new_bet_opens — fires when a new market opens in a series
export const NewBetOpensBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
        const seriesSlug = (block['params'] as any)?.seriesSlug;
        if (!seriesSlug) return { fired: false, reason: 'no seriesSlug configured' };

        // Check if a market opened in the last tick interval (60s)
        const since = new Date(ctx.now - 60_000);
        const recent = await prisma.market.findFirst({
            where: { seriesSlug, firstSeenAt: { gte: since }, closed: false },
        });
        return { fired: !!recent, reason: recent ? `new market: ${recent.id}` : 'no new market' };
    },
};

// price_crosses_up — fires when price crosses threshold upward
export const PriceCrossesUpBlock: BlockEvaluator = {
    async evaluate(block, ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, threshold } = (block['params'] as any) ?? {};
        if (!tokenId || threshold === undefined) return { fired: false, reason: 'invalid config' };

        const current = await redis.getJson<{ price: number; timestamp: number }>(`cache:price:${tokenId}`);
        const prev    = await redis.getJson<{ price: number }>(`cache:price:prev:${tokenId}`);

        if (!current) return { fired: false, reason: 'no price data' };

        const thresh = parseFloat(threshold);
        const prevPrice = prev?.price ?? current.price;
        const fired = prevPrice < thresh && current.price >= thresh;

        return {
            fired,
            reason: fired ? `price crossed up ${thresh}` : `price ${current.price} (prev ${prevPrice})`,
            metadata: { price: current.price, threshold: thresh },
        };
    },
};

// price_crosses_down — fires when price crosses threshold downward
export const PriceCrossesDownBlock: BlockEvaluator = {
    async evaluate(block, ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, threshold } = (block['params'] as any) ?? {};
        if (!tokenId || threshold === undefined) return { fired: false, reason: 'invalid config' };

        const current = await redis.getJson<{ price: number; timestamp: number }>(`cache:price:${tokenId}`);
        const prev    = await redis.getJson<{ price: number }>(`cache:price:prev:${tokenId}`);

        if (!current) return { fired: false, reason: 'no price data' };

        const thresh = parseFloat(threshold);
        const prevPrice = prev?.price ?? current.price;
        const fired = prevPrice > thresh && current.price <= thresh;

        return {
            fired,
            reason: fired ? `price crossed down ${thresh}` : `price ${current.price} (prev ${prevPrice})`,
            metadata: { price: current.price, threshold: thresh },
        };
    },
};

// time_before_close — fires N minutes before market closes
export const TimeBeforeCloseBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
        const { minutesBefore, marketId } = (block['params'] as any) ?? {};
        if (!marketId || minutesBefore === undefined) return { fired: false, reason: 'invalid config' };

        const market = await prisma.market.findUnique({ where: { id: marketId } });
        if (!market?.endDate) return { fired: false, reason: 'no market endDate' };

        const msBeforeClose = market.endDate.getTime() - ctx.now;
        const targetMs = parseInt(minutesBefore, 10) * 60_000;
        // Fire in the window [targetMs, targetMs + 60s)
        const fired = msBeforeClose >= 0 && msBeforeClose <= targetMs && msBeforeClose > targetMs - 60_000;

        return { fired, reason: `${Math.round(msBeforeClose / 60_000)}min before close` };
    },
};

// win_streak — fires after N consecutive wins
export const WinStreakBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
        const count = parseInt((block['params'] as any)?.count ?? '3', 10);
        const fired = ctx.state.consecutiveWin >= count;
        return { fired, reason: `${ctx.state.consecutiveWin} consecutive wins (need ${count})` };
    },
};

// loss_streak — fires after N consecutive losses
export const LossStreakBlock: BlockEvaluator = {
    async evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
        const count = parseInt((block['params'] as any)?.count ?? '3', 10);
        const fired = ctx.state.consecutiveLoss >= count;
        return { fired, reason: `${ctx.state.consecutiveLoss} consecutive losses (need ${count})` };
    },
};

// ─── TICK TRIGGERS ────────────────────────────────────────────────────────────

// price_above_tick — true if price > threshold at current tick
export const PriceAboveTickBlock: BlockEvaluator = {
    async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, price: threshold } = (block['params'] as any) ?? {};
        const data = await redis.getJson<{ price: number }>(`cache:price:${tokenId}`);
        if (!data) return { fired: false, reason: 'no price data' };
        const fired = data.price > parseFloat(threshold);
        return { fired, reason: `price ${data.price} > ${threshold}: ${fired}` };
    },
};

// price_below_tick — true if price < threshold at current tick
export const PriceBelowTickBlock: BlockEvaluator = {
    async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, price: threshold } = (block['params'] as any) ?? {};
        const data = await redis.getJson<{ price: number }>(`cache:price:${tokenId}`);
        if (!data) return { fired: false, reason: 'no price data' };
        const fired = data.price < parseFloat(threshold);
        return { fired, reason: `price ${data.price} < ${threshold}: ${fired}` };
    },
};

// spread_below_tick — true if spread < threshold
export const SpreadBelowTickBlock: BlockEvaluator = {
    async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, minSpread } = (block['params'] as any) ?? {};
        const book = await redis.getJson<{ spread: string }>(`cache:book:${tokenId}`);
        if (!book) return { fired: false, reason: 'no book data' };
        const spread = parseFloat(book.spread);
        const fired = spread < parseFloat(minSpread ?? '0.05');
        return { fired, reason: `spread ${spread} < ${minSpread}: ${fired}` };
    },
};

// volume_rate_tick — true if order book volume rate >= minRate (sum of top-5 bid sizes)
export const VolumeRateTickBlock: BlockEvaluator = {
    async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, minRate } = (block['params'] as any) ?? {};
        const book = await redis.getJson<{ bids: Array<{ size: string }> }>(`cache:book:${tokenId}`);
        if (!book) return { fired: false, reason: 'no book data' };
        const volume = book.bids.slice(0, 5).reduce((s, b) => s + parseFloat(b.size), 0);
        const fired = volume >= parseFloat(minRate ?? '100');
        return { fired, reason: `top-5 bid volume ${volume.toFixed(2)} vs ${minRate}` };
    },
};

// price_momentum_tick — true if price moved >= threshold in direction over last 5 prices
export const PriceMomentumTickBlock: BlockEvaluator = {
    async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, direction, threshold } = (block['params'] as any) ?? {};
        const current = await redis.getJson<{ price: number }>(`cache:price:${tokenId}`);
        const prev    = await redis.getJson<{ price: number }>(`cache:price:prev:${tokenId}`);
        if (!current || !prev) return { fired: false, reason: 'insufficient price history' };

        const delta = current.price - prev.price;
        const thresh = parseFloat(threshold ?? '0.01');

        let fired = false;
        if (direction === 'up')   fired = delta >= thresh;
        if (direction === 'down') fired = delta <= -thresh;

        return { fired, reason: `delta ${delta.toFixed(4)} (direction=${direction}, thresh=${thresh})` };
    },
};

// rsi_threshold_tick — simple RSI approximation using stored price history
export const RsiThresholdTickBlock: BlockEvaluator = {
    async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
        const { tokenId, level, direction } = (block['params'] as any) ?? {};

        // Read last 14 prices from Redis list (set by market-data-service, best-effort)
        const client = redis.getClient();
        const priceHistory = await client.lrange(`price:history:${tokenId}`, 0, 13);

        if (priceHistory.length < 2) return { fired: false, reason: 'insufficient price history for RSI' };

        const prices = priceHistory.map(Number);
        let gains = 0, losses = 0;
        for (let i = 1; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        const avgGain = gains / (prices.length - 1);
        const avgLoss = losses / (prices.length - 1);
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        const threshold = parseFloat(level ?? '70');
        let fired = false;
        if (direction === 'above') fired = rsi > threshold;
        if (direction === 'below') fired = rsi < threshold;

        return { fired, reason: `RSI ${rsi.toFixed(2)} ${direction} ${threshold}: ${fired}` };
    },
};

// every_tick — always fires
export const EveryTickBlock: BlockEvaluator = {
    async evaluate(_block, _ctx, _redis, _prisma): Promise<BlockResult> {
        return { fired: true, reason: 'every_tick' };
    },
};
