import { describe, it, expect, vi } from 'vitest';
import {
    NewBetOpensBlock,
    PriceCrossesUpBlock,
    PriceCrossesDownBlock,
    TimeBeforeCloseBlock,
    WinStreakBlock,
    LossStreakBlock,
    PriceAboveTickBlock,
    PriceBelowTickBlock,
    SpreadBelowTickBlock,
    VolumeRateTickBlock,
    PriceMomentumTickBlock,
    RsiThresholdTickBlock,
    EveryTickBlock,
} from './trigger.blocks';
import { block, makeCtx, makePrisma, makeRedis } from './__helpers__';

// ─── EVENT TRIGGERS ───────────────────────────────────────────────────────────

describe('NewBetOpensBlock', () => {
    it('fires when a recent market is found for seriesSlug', async () => {
        const prisma = makePrisma();
        prisma.market.findFirst.mockResolvedValue({ id: 'market-1' });
        const res = await NewBetOpensBlock.evaluate(block('new_bet_opens', { seriesSlug: 'us-election-2024' }), makeCtx(), makeRedis(), prisma);
        expect(res.fired).toBe(true);
        expect(res.reason).toContain('market-1');
    });

    it('does not fire when no recent market found', async () => {
        const prisma = makePrisma(); // findFirst returns null by default
        const res = await NewBetOpensBlock.evaluate(block('new_bet_opens', { seriesSlug: 'us-election-2024' }), makeCtx(), makeRedis(), prisma);
        expect(res.fired).toBe(false);
    });

    it('does not fire when seriesSlug is missing', async () => {
        const res = await NewBetOpensBlock.evaluate(block('new_bet_opens', {}), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
        expect(res.reason).toMatch(/no seriesSlug/);
    });

    it('queries within the last 60 seconds', async () => {
        const prisma = makePrisma();
        const now = Date.now();
        const ctx = makeCtx({}, now);
        await NewBetOpensBlock.evaluate(block('new_bet_opens', { seriesSlug: 'slug' }), ctx, makeRedis(), prisma);
        const call = prisma.market.findFirst.mock.calls[0][0];
        expect(call.where.firstSeenAt.gte.getTime()).toBeGreaterThan(now - 61_000);
    });
});

describe('PriceCrossesUpBlock', () => {
    it('fires when price crosses threshold upward', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.65, timestamp: Date.now() })  // current
                .mockResolvedValueOnce({ price: 0.55 }),                         // prev
        });
        const res = await PriceCrossesUpBlock.evaluate(block('price_crosses_up', { tokenId: 'tok1', threshold: '0.60' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
        expect(res.metadata?.threshold).toBe(0.60);
    });

    it('does not fire when price was already above threshold', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.70, timestamp: Date.now() })
                .mockResolvedValueOnce({ price: 0.65 }),
        });
        const res = await PriceCrossesUpBlock.evaluate(block('price_crosses_up', { tokenId: 'tok1', threshold: '0.60' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false); // prevPrice 0.65 >= threshold 0.60 (not a cross)
    });

    it('does not fire when price is below threshold', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.55, timestamp: Date.now() })
                .mockResolvedValueOnce({ price: 0.50 }),
        });
        const res = await PriceCrossesUpBlock.evaluate(block('price_crosses_up', { tokenId: 'tok1', threshold: '0.60' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false);
    });

    it('does not fire when no price data', async () => {
        const res = await PriceCrossesUpBlock.evaluate(block('price_crosses_up', { tokenId: 'tok1', threshold: '0.60' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
        expect(res.reason).toMatch(/no price data/);
    });

    it('does not fire with invalid config', async () => {
        const res = await PriceCrossesUpBlock.evaluate(block('price_crosses_up', {}), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
        expect(res.reason).toMatch(/invalid config/);
    });

    it('uses current price as prev when no prev data', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.65, timestamp: Date.now() })
                .mockResolvedValueOnce(null), // no prev
        });
        // prev defaults to current.price = 0.65, so prevPrice < threshold is false
        const res = await PriceCrossesUpBlock.evaluate(block('price_crosses_up', { tokenId: 'tok1', threshold: '0.60' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false); // 0.65 < 0.60 is false
    });
});

describe('PriceCrossesDownBlock', () => {
    it('fires when price crosses threshold downward', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.35, timestamp: Date.now() })
                .mockResolvedValueOnce({ price: 0.45 }),
        });
        const res = await PriceCrossesDownBlock.evaluate(block('price_crosses_down', { tokenId: 'tok1', threshold: '0.40' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire when price is still above threshold', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.50, timestamp: Date.now() })
                .mockResolvedValueOnce({ price: 0.45 }),
        });
        const res = await PriceCrossesDownBlock.evaluate(block('price_crosses_down', { tokenId: 'tok1', threshold: '0.40' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false);
    });

    it('does not fire with no price data', async () => {
        const res = await PriceCrossesDownBlock.evaluate(block('price_crosses_down', { tokenId: 'tok1', threshold: '0.40' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

describe('TimeBeforeCloseBlock', () => {
    it('fires when market closes within the specified window', async () => {
        const prisma = makePrisma();
        const now = Date.now();
        // The window fires when msBeforeClose is in (targetMs-60s, targetMs]
        // minutesBefore=30 → target=30min → window=(29min, 30min]
        // Set endDate to 29.5 minutes from now (squarely inside the window)
        prisma.market.findUnique.mockResolvedValue({ endDate: new Date(now + 29.5 * 60_000) });
        const ctx = makeCtx({}, now);
        const res = await TimeBeforeCloseBlock.evaluate(block('time_before_close', { marketId: 'm1', minutesBefore: '30' }), ctx, makeRedis(), prisma);
        expect(res.fired).toBe(true);
    });

    it('does not fire when market closes too far in the future', async () => {
        const prisma = makePrisma();
        const now = Date.now();
        prisma.market.findUnique.mockResolvedValue({ endDate: new Date(now + 2 * 60 * 60_000) }); // 2h
        const ctx = makeCtx({}, now);
        const res = await TimeBeforeCloseBlock.evaluate(block('time_before_close', { marketId: 'm1', minutesBefore: '30' }), ctx, makeRedis(), prisma);
        expect(res.fired).toBe(false);
    });

    it('does not fire when market has already closed', async () => {
        const prisma = makePrisma();
        const now = Date.now();
        prisma.market.findUnique.mockResolvedValue({ endDate: new Date(now - 60_000) }); // 1 min ago
        const ctx = makeCtx({}, now);
        const res = await TimeBeforeCloseBlock.evaluate(block('time_before_close', { marketId: 'm1', minutesBefore: '30' }), ctx, makeRedis(), prisma);
        expect(res.fired).toBe(false);
    });

    it('does not fire with invalid config', async () => {
        const res = await TimeBeforeCloseBlock.evaluate(block('time_before_close', {}), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
        expect(res.reason).toMatch(/invalid config/);
    });

    it('does not fire when market has no endDate', async () => {
        const prisma = makePrisma();
        prisma.market.findUnique.mockResolvedValue({ endDate: null });
        const res = await TimeBeforeCloseBlock.evaluate(block('time_before_close', { marketId: 'm1', minutesBefore: '30' }), makeCtx(), makeRedis(), prisma);
        expect(res.fired).toBe(false);
    });
});

describe('WinStreakBlock', () => {
    it('fires when consecutive wins meet the count', async () => {
        const ctx = makeCtx({ consecutiveWin: 3 });
        const res = await WinStreakBlock.evaluate(block('win_streak', { count: '3' }), ctx, makeRedis(), makePrisma());
        expect(res.fired).toBe(true);
    });

    it('fires when consecutive wins exceed the count', async () => {
        const ctx = makeCtx({ consecutiveWin: 5 });
        const res = await WinStreakBlock.evaluate(block('win_streak', { count: '3' }), ctx, makeRedis(), makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire when below count', async () => {
        const ctx = makeCtx({ consecutiveWin: 2 });
        const res = await WinStreakBlock.evaluate(block('win_streak', { count: '3' }), ctx, makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

describe('LossStreakBlock', () => {
    it('fires when consecutive losses meet the count', async () => {
        const ctx = makeCtx({ consecutiveLoss: 4 });
        const res = await LossStreakBlock.evaluate(block('loss_streak', { count: '4' }), ctx, makeRedis(), makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire when below count', async () => {
        const ctx = makeCtx({ consecutiveLoss: 1 });
        const res = await LossStreakBlock.evaluate(block('loss_streak', { count: '3' }), ctx, makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

// ─── TICK TRIGGERS ─────────────────────────────────────────────────────────

describe('PriceAboveTickBlock', () => {
    it('fires when price is above threshold', async () => {
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.75 }) });
        const res = await PriceAboveTickBlock.evaluate(block('price_above_tick', { tokenId: 'tok1', price: '0.70' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire when price equals threshold', async () => {
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.70 }) });
        const res = await PriceAboveTickBlock.evaluate(block('price_above_tick', { tokenId: 'tok1', price: '0.70' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false); // strict >
    });

    it('does not fire when no price data', async () => {
        const res = await PriceAboveTickBlock.evaluate(block('price_above_tick', { tokenId: 'tok1', price: '0.70' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

describe('PriceBelowTickBlock', () => {
    it('fires when price is below threshold', async () => {
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.30 }) });
        const res = await PriceBelowTickBlock.evaluate(block('price_below_tick', { tokenId: 'tok1', price: '0.50' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire when price equals threshold', async () => {
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.50 }) });
        const res = await PriceBelowTickBlock.evaluate(block('price_below_tick', { tokenId: 'tok1', price: '0.50' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false);
    });

    it('does not fire when no price data', async () => {
        const res = await PriceBelowTickBlock.evaluate(block('price_below_tick', { tokenId: 'tok1', price: '0.50' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

describe('SpreadBelowTickBlock', () => {
    it('fires when spread is below minSpread', async () => {
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue({ spread: '0.02' }) });
        const res = await SpreadBelowTickBlock.evaluate(block('spread_below_tick', { tokenId: 'tok1', minSpread: '0.05' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire when spread equals minSpread', async () => {
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue({ spread: '0.05' }) });
        const res = await SpreadBelowTickBlock.evaluate(block('spread_below_tick', { tokenId: 'tok1', minSpread: '0.05' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false); // strict <
    });

    it('does not fire when no book data', async () => {
        const res = await SpreadBelowTickBlock.evaluate(block('spread_below_tick', { tokenId: 'tok1', minSpread: '0.05' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

describe('VolumeRateTickBlock', () => {
    it('fires when top-5 bid volume meets minRate', async () => {
        const book = { bids: Array.from({ length: 5 }, () => ({ size: '30' })) }; // total 150
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
        const res = await VolumeRateTickBlock.evaluate(block('volume_rate_tick', { tokenId: 'tok1', minRate: '100' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('only sums the first 5 bids', async () => {
        const book = { bids: Array.from({ length: 10 }, (_, i) => ({ size: i < 5 ? '10' : '1000' })) }; // top 5 = 50
        const redis = makeRedis({ getJson: vi.fn().mockResolvedValue(book) });
        const res = await VolumeRateTickBlock.evaluate(block('volume_rate_tick', { tokenId: 'tok1', minRate: '100' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false); // 50 < 100
    });

    it('does not fire when no book data', async () => {
        const res = await VolumeRateTickBlock.evaluate(block('volume_rate_tick', { tokenId: 'tok1', minRate: '100' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
    });
});

describe('PriceMomentumTickBlock', () => {
    it('fires for upward momentum exceeding threshold', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.65 })
                .mockResolvedValueOnce({ price: 0.60 }),
        });
        const res = await PriceMomentumTickBlock.evaluate(block('price_momentum_tick', { tokenId: 'tok1', direction: 'up', threshold: '0.03' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true); // delta = 0.05 >= 0.03
    });

    it('fires for downward momentum exceeding threshold', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.55 })
                .mockResolvedValueOnce({ price: 0.62 }),
        });
        const res = await PriceMomentumTickBlock.evaluate(block('price_momentum_tick', { tokenId: 'tok1', direction: 'down', threshold: '0.05' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true); // delta = -0.07 <= -0.05
    });

    it('does not fire when momentum is insufficient', async () => {
        const redis = makeRedis({
            getJson: vi.fn()
                .mockResolvedValueOnce({ price: 0.61 })
                .mockResolvedValueOnce({ price: 0.60 }),
        });
        const res = await PriceMomentumTickBlock.evaluate(block('price_momentum_tick', { tokenId: 'tok1', direction: 'up', threshold: '0.03' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false); // delta = 0.01 < 0.03
    });

    it('does not fire with insufficient price history', async () => {
        const res = await PriceMomentumTickBlock.evaluate(block('price_momentum_tick', { tokenId: 'tok1', direction: 'up', threshold: '0.01' }), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(false);
        expect(res.reason).toMatch(/insufficient/);
    });
});

describe('RsiThresholdTickBlock', () => {
    function makeRsiRedis(prices: number[]) {
        const redis = makeRedis();
        redis.getClient.mockReturnValue({
            lrange: vi.fn().mockResolvedValue(prices.map(String)),
        });
        return redis;
    }

    it('fires when RSI is above threshold (overbought)', async () => {
        // 13 gains of 0.05, 0 losses → RSI = 100
        const prices = Array.from({ length: 14 }, (_, i) => 0.40 + i * 0.05);
        const redis = makeRsiRedis(prices);
        const res = await RsiThresholdTickBlock.evaluate(block('rsi_threshold_tick', { tokenId: 'tok1', level: '70', direction: 'above' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('fires when RSI is below threshold (oversold)', async () => {
        // 13 losses → RSI approaches 0
        const prices = Array.from({ length: 14 }, (_, i) => 0.80 - i * 0.05);
        const redis = makeRsiRedis(prices);
        const res = await RsiThresholdTickBlock.evaluate(block('rsi_threshold_tick', { tokenId: 'tok1', level: '30', direction: 'below' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true);
    });

    it('does not fire with insufficient price history', async () => {
        const redis = makeRsiRedis([0.5]); // only 1 price
        const res = await RsiThresholdTickBlock.evaluate(block('rsi_threshold_tick', { tokenId: 'tok1', level: '70', direction: 'above' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(false);
        expect(res.reason).toMatch(/insufficient/);
    });

    it('handles zero losses (avgLoss=0) without divide-by-zero', async () => {
        const prices = Array.from({ length: 14 }, (_, i) => 0.40 + i * 0.01); // all gains
        const redis = makeRsiRedis(prices);
        const res = await RsiThresholdTickBlock.evaluate(block('rsi_threshold_tick', { tokenId: 'tok1', level: '70', direction: 'above' }), makeCtx(), redis, makePrisma());
        expect(res.fired).toBe(true); // RSI = 100 > 70
    });
});

describe('EveryTickBlock', () => {
    it('always fires', async () => {
        const res = await EveryTickBlock.evaluate(block('every_tick'), makeCtx(), makeRedis(), makePrisma());
        expect(res.fired).toBe(true);
        expect(res.reason).toBe('every_tick');
    });
});
