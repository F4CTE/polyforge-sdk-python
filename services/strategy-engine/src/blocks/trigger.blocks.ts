import { BlockEvaluator, BlockResult } from "./block.types";

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

    const thresh = parseFloat(String(threshold));
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

    const thresh = parseFloat(String(threshold));
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
    const fired = data.price > parseFloat(threshold);
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
    const fired = data.price < parseFloat(threshold);
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
    const spread = parseFloat(book.spread);
    const fired = spread < parseFloat(minSpread);
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
    const volume = book.bids
      .slice(0, 5)
      .reduce((s, b) => s + parseFloat(b.size), 0);
    const fired = volume >= parseFloat(minRate);
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
    const thresh = parseFloat(threshold);

    let fired = false;
    if (direction === "up") fired = delta >= thresh;
    if (direction === "down") fired = delta <= -thresh;

    return {
      fired,
      reason: `delta ${delta.toFixed(4)} (direction=${direction}, thresh=${thresh})`,
    };
  },
};

// rsi_threshold_tick — simple RSI approximation using stored price history
export const RsiThresholdTickBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const level = String(params.level ?? "70");
    const direction = String(params.direction ?? "");

    // Read last 14 prices from Redis list (set by market-data-service, best-effort)
    const client = redis.getClient();
    const priceHistory = await client.lrange(`price:history:${tokenId}`, 0, 13);

    if (priceHistory.length < 2)
      return { fired: false, reason: "insufficient price history for RSI" };

    const prices = priceHistory.map(Number);
    let gains = 0,
      losses = 0;
    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / (prices.length - 1);
    const avgLoss = losses / (prices.length - 1);
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    const threshold = parseFloat(level);
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
