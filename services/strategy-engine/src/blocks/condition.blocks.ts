import { BlockEvaluator, BlockResult } from "./block.types";

type BlockParams = Record<string, string | number | undefined>;

// min_liquidity — passes if total bid liquidity >= minUsdc
export const MinLiquidityBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const minUsdc = String(params.minUsdc ?? "100");
    const book = await redis.getJson<{
      bids: Array<{ price: string; size: string }>;
    }>(`cache:book:${tokenId}`);
    if (!book) return { fired: false, reason: "no book data" };

    const liquidity = book.bids.reduce(
      (sum, b) => sum + parseFloat(b.price) * parseFloat(b.size),
      0,
    );
    const min = parseFloat(minUsdc);
    const fired = liquidity >= min;
    return {
      fired,
      reason: `liquidity $${liquidity.toFixed(2)} vs min $${min}`,
    };
  },
};

// max_position — passes if current position value < maxUsdc
export const MaxPositionBlock: BlockEvaluator = {
  async evaluate(block, ctx, redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const maxUsdc = String(params.maxUsdc ?? "0");
    const max = parseFloat(maxUsdc);

    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    if (!position) return { fired: true, reason: "no existing position" };

    const value =
      parseFloat(String(position.size)) *
      parseFloat(String(position.currentPrice));
    const fired = value < max;
    return { fired, reason: `position $${value.toFixed(2)} < max $${max}` };
  },
};

// max_bets_per_day — passes if betsToday < max
export const MaxBetsPerDayBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const max = parseInt(String(params.max ?? "10"), 10);
    const fired = ctx.state.betsToday < max;
    return Promise.resolve({
      fired,
      reason: `betsToday ${ctx.state.betsToday} < ${max}`,
    });
  },
};

// daily_loss_limit — passes if daily loss < maxLossUsdc
export const DailyLossLimitBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const maxLoss = parseFloat(String(params.maxLossUsdc ?? "0"));
    const fired = ctx.state.dailyPnl > -maxLoss;
    return Promise.resolve({
      fired,
      reason: `dailyPnl ${ctx.state.dailyPnl} > -${maxLoss}`,
    });
  },
};

// cooldown_after_trade — passes if enough time since last trade
export const CooldownAfterTradeBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const cooldownMs = parseInt(String(params.cooldownMs ?? "0"), 10);
    const elapsed = ctx.now - ctx.state.lastTradeAt;
    const fired = elapsed >= cooldownMs || ctx.state.lastTradeAt === 0;
    return Promise.resolve({
      fired,
      reason: `elapsed ${elapsed}ms (need ${cooldownMs}ms)`,
    });
  },
};

// price_in_range — passes if price is between min and max
export const PriceInRangeBlock: BlockEvaluator = {
  async evaluate(block, _ctx, redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const min = String(params.min ?? "0");
    const max = String(params.max ?? "1");
    const data = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    if (!data) return { fired: false, reason: "no price data" };

    const fired =
      data.price >= parseFloat(min) && data.price <= parseFloat(max);
    return {
      fired,
      reason: `price ${data.price} in [${min}, ${max}]: ${fired}`,
    };
  },
};

// no_reentry — passes if this token hasn't been traded today
export const NoReentryBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    if (!tokenId)
      return Promise.resolve({ fired: true, reason: "no tokenId configured" });

    const traded = ctx.state.tradedTokensToday.includes(tokenId);
    return Promise.resolve({
      fired: !traded,
      reason: traded
        ? `already traded ${tokenId} today`
        : `${tokenId} not traded today`,
    });
  },
};

// no_existing_position — passes if no open position on this token
export const NoExistingPositionBlock: BlockEvaluator = {
  async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    if (!tokenId) return { fired: true, reason: "no tokenId configured" };

    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    const hasPosition = !!position && parseFloat(String(position.size)) > 0;
    return {
      fired: !hasPosition,
      reason: hasPosition ? `existing position on ${tokenId}` : "no position",
    };
  },
};

// time_window — passes if current time (UTC) is within window
export const TimeWindowBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const startHH = String(params.startHH ?? "0");
    const startMM = String(params.startMM ?? "0");
    const endHH = String(params.endHH ?? "23");
    const endMM = String(params.endMM ?? "59");
    const now = new Date(ctx.now);
    const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMins = parseInt(startHH, 10) * 60 + parseInt(startMM, 10);
    const endMins = parseInt(endHH, 10) * 60 + parseInt(endMM, 10);

    const fired = currentMins >= startMins && currentMins <= endMins;
    const fmt = (h: number, m: number) =>
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return Promise.resolve({
      fired,
      reason: `current ${fmt(now.getUTCHours(), now.getUTCMinutes())} UTC in [${fmt(parseInt(startHH), parseInt(startMM))}, ${fmt(parseInt(endHH), parseInt(endMM))}]: ${fired}`,
    });
  },
};
