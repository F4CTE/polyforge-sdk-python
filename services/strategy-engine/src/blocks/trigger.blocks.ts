import { BlockEvaluator, BlockResult } from "./block.types";
import {
  sma,
  ema,
  macd,
  bollingerBands,
  vwap,
  rsiWilder,
} from "../ta/indicators";
import { readPriceWindow } from "../ta/price-window";
import { parseFiniteDecimal } from "@polyforge/shared-types";

type BlockParams = Record<string, string | number | undefined>;

// ─── EVENT TRIGGERS ───────────────────────────────────────────────────────────

// new_bet_opens — fires when a new market opens in a series
export const NewBetOpensBlock: BlockEvaluator = {
  async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const seriesSlug = String(params.seriesSlug ?? "");
    if (!seriesSlug)
      return { fired: false, reason: "no seriesSlug configured" };

    // Check if a market opened in the last tick interval (60s)
    const since = new Date(ctx.now - 60_000);
    const recent = await prisma.market.findFirst({
      where: { seriesSlug, firstSeenAt: { gte: since }, closed: false },
    });
    return {
      fired: !!recent,
      reason: recent ? `new market: ${recent.id}` : "no new market",
    };
  },
};

// price_crosses_up — fires when price crosses threshold upward
export const PriceCrossesUpBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const threshold = params.threshold;
    if (!tokenId || threshold === undefined)
      return { fired: false, reason: "invalid config" };

    const current = await redis.getJson<{ price: number; timestamp: number }>(
      `cache:price:${tokenId}`,
    );
    const prev = await redis.getJson<{ price: number }>(
      `cache:price:prev:${tokenId}`,
    );

    if (!current) return { fired: false, reason: "no price data" };

    const thresh = parseFiniteDecimal(threshold);
    if (thresh === null) return { fired: false, reason: "invalid threshold" };
    const prevPrice = prev?.price ?? current.price;
    const fired = prevPrice < thresh && current.price >= thresh;

    return {
      fired,
      reason: fired
        ? `price crossed up ${thresh}`
        : `price ${current.price} (prev ${prevPrice})`,
      metadata: { price: current.price, threshold: thresh },
    };
  },
};

// price_crosses_down — fires when price crosses threshold downward
export const PriceCrossesDownBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const threshold = params.threshold;
    if (!tokenId || threshold === undefined)
      return { fired: false, reason: "invalid config" };

    const current = await redis.getJson<{ price: number; timestamp: number }>(
      `cache:price:${tokenId}`,
    );
    const prev = await redis.getJson<{ price: number }>(
      `cache:price:prev:${tokenId}`,
    );

    if (!current) return { fired: false, reason: "no price data" };

    const thresh = parseFiniteDecimal(threshold);
    if (thresh === null) return { fired: false, reason: "invalid threshold" };
    const prevPrice = prev?.price ?? current.price;
    const fired = prevPrice > thresh && current.price <= thresh;

    return {
      fired,
      reason: fired
        ? `price crossed down ${thresh}`
        : `price ${current.price} (prev ${prevPrice})`,
      metadata: { price: current.price, threshold: thresh },
    };
  },
};

// time_before_close — fires N minutes before market closes
export const TimeBeforeCloseBlock: BlockEvaluator = {
  async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const marketId = String(params.marketId ?? "");
    const minutesBefore = params.minutesBefore;
    if (!marketId || minutesBefore === undefined)
      return { fired: false, reason: "invalid config" };

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market?.endDate) return { fired: false, reason: "no market endDate" };

    const msBeforeClose = market.endDate.getTime() - ctx.now;
    const targetMs = parseInt(String(minutesBefore), 10) * 60_000;
    // Fire in the window [targetMs, targetMs + 60s)
    const fired =
      msBeforeClose >= 0 &&
      msBeforeClose <= targetMs &&
      msBeforeClose > targetMs - 60_000;

    return {
      fired,
      reason: `${Math.round(msBeforeClose / 60_000)}min before close`,
    };
  },
};

// win_streak — fires after N consecutive wins
export const WinStreakBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const count = parseInt(String(params.count ?? "3"), 10);
    const fired = ctx.state.consecutiveWin >= count;
    return Promise.resolve({
      fired,
      reason: `${ctx.state.consecutiveWin} consecutive wins (need ${count})`,
    });
  },
};

// loss_streak — fires after N consecutive losses
export const LossStreakBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const count = parseInt(String(params.count ?? "3"), 10);
    const fired = ctx.state.consecutiveLoss >= count;
    return Promise.resolve({
      fired,
      reason: `${ctx.state.consecutiveLoss} consecutive losses (need ${count})`,
    });
  },
};

// ─── TICK TRIGGERS ────────────────────────────────────────────────────────────

// price_above_tick — true if price > threshold at current tick
export const PriceAboveTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const threshold = String(params.price ?? "0");
    const data = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    if (!data) return { fired: false, reason: "no price data" };
    const thresh = parseFiniteDecimal(threshold);
    if (thresh === null) return { fired: false, reason: "invalid threshold" };
    const fired = data.price > thresh;
    return { fired, reason: `price ${data.price} > ${threshold}: ${fired}` };
  },
};

// price_below_tick — true if price < threshold at current tick
export const PriceBelowTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const threshold = String(params.price ?? "0");
    const data = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    if (!data) return { fired: false, reason: "no price data" };
    const thresh = parseFiniteDecimal(threshold);
    if (thresh === null) return { fired: false, reason: "invalid threshold" };
    const fired = data.price < thresh;
    return { fired, reason: `price ${data.price} < ${threshold}: ${fired}` };
  },
};

// spread_below_tick — true if spread < threshold
export const SpreadBelowTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const minSpread = String(params.minSpread ?? "0.05");
    const book = await redis.getJson<{ spread: string }>(
      `cache:book:${tokenId}`,
    );
    if (!book) return { fired: false, reason: "no book data" };
    const spread = parseFiniteDecimal(book.spread);
    const minSpreadNum = parseFiniteDecimal(minSpread);
    if (spread === null) return { fired: false, reason: "invalid spread" };
    if (minSpreadNum === null)
      return { fired: false, reason: "invalid minSpread" };
    const fired = spread < minSpreadNum;
    return { fired, reason: `spread ${spread} < ${minSpread}: ${fired}` };
  },
};

// volume_rate_tick — true if order book volume rate >= minRate (sum of top-5 bid sizes)
export const VolumeRateTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const minRate = String(params.minRate ?? "100");
    const book = await redis.getJson<{ bids: Array<{ size: string }> }>(
      `cache:book:${tokenId}`,
    );
    if (!book) return { fired: false, reason: "no book data" };
    const bidSizes: number[] = [];
    for (const bid of book.bids.slice(0, 5)) {
      const size = parseFiniteDecimal(bid.size);
      if (size === null) return { fired: false, reason: "invalid bid size" };
      bidSizes.push(size);
    }
    const minRateNum = parseFiniteDecimal(minRate);
    if (minRateNum === null) return { fired: false, reason: "invalid minRate" };
    const volume = bidSizes.reduce((s, size) => s + size!, 0);
    const fired = volume >= minRateNum;
    return {
      fired,
      reason: `top-5 bid volume ${volume.toFixed(2)} vs ${minRate}`,
    };
  },
};

// price_momentum_tick — true if price moved >= threshold in direction over last 5 prices
export const PriceMomentumTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const direction = String(params.direction ?? "");
    const threshold = String(params.threshold ?? "0.01");
    const current = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    const prev = await redis.getJson<{ price: number }>(
      `cache:price:prev:${tokenId}`,
    );
    if (!current || !prev)
      return { fired: false, reason: "insufficient price history" };

    const delta = current.price - prev.price;
    const thresh = parseFiniteDecimal(threshold);
    if (thresh === null) return { fired: false, reason: "invalid threshold" };

    let fired = false;
    if (direction === "up") fired = delta >= thresh;
    if (direction === "down") fired = delta <= -thresh;

    return {
      fired,
      reason: `delta ${delta.toFixed(4)} (direction=${direction}, thresh=${thresh})`,
    };
  },
};

// rsi_threshold_tick — RSI using Wilder smoothing, reads ta:prices sorted set
// Falls back to price:history list for backward compatibility during migration.
export const RsiThresholdTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const level = String(params.level ?? "70");
    const direction = String(params.direction ?? "");
    const period = parseFiniteDecimal(params.period ?? 14);
    if (period === null || period < 1)
      return { fired: false, reason: "invalid config" };

    // Primary: sorted set written by market-data-service via writePricePoint
    const points = await readPriceWindow(redis, tokenId, period + 50);
    let prices: number[];
    if (points.length > 0) {
      prices = points.map((pt) => pt.price);
    } else {
      // Fallback: legacy Redis list during migration window
      const client = redis.getClient();
      const raw = await client.lrange(
        `price:history:${tokenId}`,
        0,
        period + 49,
      );
      prices = raw.map(Number);
    }

    if (prices.length < period + 1)
      return { fired: false, reason: "insufficient price history for RSI" };

    const rsi = rsiWilder(prices, period);
    if (isNaN(rsi)) return { fired: false, reason: "RSI returned NaN" };

    const threshold = parseFiniteDecimal(level);
    if (threshold === null)
      return { fired: false, reason: "invalid threshold" };
    let fired = false;
    if (direction === "above") fired = rsi > threshold;
    if (direction === "below") fired = rsi < threshold;

    return {
      fired,
      reason: `RSI ${rsi.toFixed(2)} ${direction} ${threshold}: ${fired}`,
    };
  },
};

// every_tick — always fires
export const EveryTickBlock: BlockEvaluator = {
  evaluate(_block, _ctx, _redis, _prisma): Promise<BlockResult> {
    return Promise.resolve({ fired: true, reason: "every_tick" });
  },
};

// ─── TA TICK TRIGGERS ─────────────────────────────────────────────────────────

// ma_crossover_tick — fires when the short MA crosses the long MA
export const MaCrossoverTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const shortPeriod = parseInt(String(params.shortPeriod ?? "10"), 10);
    const longPeriod = parseInt(String(params.longPeriod ?? "50"), 10);
    const maType = String(params.maType ?? "sma");
    const direction = String(params.direction ?? "");

    if (!tokenId || !direction)
      return { fired: false, reason: "invalid config" };

    const points = await readPriceWindow(redis, tokenId, longPeriod + 1);
    if (points.length < longPeriod + 1)
      return { fired: false, reason: "insufficient price history" };

    const prices = points.map((p) => p.price);
    const maFn = maType === "ema" ? ema : sma;

    const prev = prices.slice(0, longPeriod);
    const curr = prices.slice(1);

    const prevShortMA = maFn(prev.slice(-shortPeriod), shortPeriod);
    const prevLongMA = maFn(prev, longPeriod);
    const currShortMA = maFn(curr.slice(-shortPeriod), shortPeriod);
    const currLongMA = maFn(curr, longPeriod);

    if ([prevShortMA, prevLongMA, currShortMA, currLongMA].some(isNaN))
      return { fired: false, reason: "insufficient data for MA computation" };

    let fired = false;
    if (direction === "golden_cross")
      fired = prevShortMA < prevLongMA && currShortMA >= currLongMA;
    if (direction === "death_cross")
      fired = prevShortMA > prevLongMA && currShortMA <= currLongMA;

    return {
      fired,
      reason: `${maType} short=${currShortMA.toFixed(4)} long=${currLongMA.toFixed(4)} dir=${direction}`,
    };
  },
};

// macd_signal_tick — fires on MACD signal conditions
export const MacdSignalTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const fastPeriod = parseInt(String(params.fastPeriod ?? "12"), 10);
    const slowPeriod = parseInt(String(params.slowPeriod ?? "26"), 10);
    const signalPeriod = parseInt(String(params.signalPeriod ?? "9"), 10);
    const signal = String(params.signal ?? "");

    if (!tokenId || !signal) return { fired: false, reason: "invalid config" };

    const count = slowPeriod + signalPeriod;
    const points = await readPriceWindow(redis, tokenId, count);
    if (points.length < count)
      return { fired: false, reason: "insufficient price history" };

    const prices = points.map((p) => p.price);
    const currMacd = macd(prices, fastPeriod, slowPeriod, signalPeriod);
    const prevMacd = macd(
      prices.slice(0, count - 1),
      fastPeriod,
      slowPeriod,
      signalPeriod,
    );

    if (isNaN(currMacd.macdLine) || isNaN(prevMacd.macdLine))
      return { fired: false, reason: "insufficient data for MACD" };

    let fired = false;
    if (signal === "line_cross") {
      const prevDiff = prevMacd.macdLine - prevMacd.signalLine;
      const currDiff = currMacd.macdLine - currMacd.signalLine;
      fired = prevDiff * currDiff < 0;
    }
    if (signal === "histogram_sign_change") {
      fired = prevMacd.histogram * currMacd.histogram < 0;
    }

    return {
      fired,
      reason: `MACD hist=${currMacd.histogram.toFixed(4)} signal=${signal}`,
    };
  },
};

// bollinger_breakout_tick — fires when price breaks out of Bollinger Bands
export const BollingerBreakoutTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const period = parseInt(String(params.period ?? "20"), 10);
    const stdDevMultiplier = parseFiniteDecimal(params.stdDevMultiplier ?? "2");
    const direction = String(params.direction ?? "");

    if (!tokenId || !direction || stdDevMultiplier === null)
      return { fired: false, reason: "invalid config" };

    const points = await readPriceWindow(redis, tokenId, period + 1);
    if (points.length < period + 1)
      return { fired: false, reason: "insufficient price history" };

    const prices = points.map((p) => p.price);
    const prevPrice = prices[period - 1];
    const currentPrice = prices[period];
    const bands = bollingerBands(
      prices.slice(0, period),
      period,
      stdDevMultiplier,
    );

    if (isNaN(bands.upper))
      return { fired: false, reason: "insufficient data for Bollinger Bands" };

    let fired = false;
    if (direction === "upper_break")
      fired = prevPrice <= bands.upper && currentPrice > bands.upper;
    if (direction === "lower_break")
      fired = prevPrice >= bands.lower && currentPrice < bands.lower;

    return {
      fired,
      reason: `price=${currentPrice.toFixed(4)} upper=${bands.upper.toFixed(4)} lower=${bands.lower.toFixed(4)} dir=${direction}`,
    };
  },
};

// vwap_cross_tick — fires when price crosses the session VWAP
export const VwapCrossTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const direction = String(params.direction ?? "");

    if (!tokenId || !direction)
      return { fired: false, reason: "invalid config" };

    // Read all session prices (up to 250) from the TA sorted set
    const points = await readPriceWindow(redis, tokenId, 250);
    if (points.length < 3)
      return { fired: false, reason: "insufficient price history" };

    const prices = points.map((p) => p.price);
    // Polymarket has no native per-bar volume in the price window, so we use
    // uniform volume (=1 each), making this a TWAP rather than true VWAP.
    const volumes = Array<number>(prices.length).fill(1);
    const vwapValue = vwap(prices, volumes);

    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];

    let fired = false;
    if (direction === "above")
      fired = prevPrice <= vwapValue && currentPrice > vwapValue;
    if (direction === "below")
      fired = prevPrice >= vwapValue && currentPrice < vwapValue;

    return {
      fired,
      reason: `price=${currentPrice.toFixed(4)} vwap=${vwapValue.toFixed(4)} dir=${direction}`,
    };
  },
};
