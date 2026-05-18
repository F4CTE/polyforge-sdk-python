import { BlockEvaluator, BlockResult } from "./block.types";
import { parseFiniteDecimal } from "@polyforge/shared-types";

type BlockParams = Record<string, string | number | undefined>;

function invalidNumeric(name: string, value: unknown): BlockResult {
  return { fired: false, reason: `invalid ${name}: ${String(value)}` };
}

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

    const min = parseFiniteDecimal(minUsdc);
    if (min === null) return invalidNumeric("minUsdc", minUsdc);

    let liquidity = 0;
    for (const bid of book.bids) {
      const price = parseFiniteDecimal(bid.price);
      const size = parseFiniteDecimal(bid.size);
      if (price === null) return invalidNumeric("bid price", bid.price);
      if (size === null) return invalidNumeric("bid size", bid.size);
      liquidity += price * size;
    }

    const fired = liquidity >= min;
    return {
      fired,
      reason: `liquidity $${liquidity.toFixed(2)} vs min $${min}`,
    };
  },
};

// max_position — passes if current position value + pending orders < maxUsdc
export const MaxPositionBlock: BlockEvaluator = {
  async evaluate(block, ctx, redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const maxUsdc = String(params.maxUsdc ?? "0");
    const max = parseFiniteDecimal(maxUsdc);
    if (max === null) return invalidNumeric("maxUsdc", maxUsdc);

    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });

    let totalValue = 0;

    if (position) {
      const size = parseFiniteDecimal(position.size);
      const currentPrice = parseFiniteDecimal(position.currentPrice);
      if (size === null) return invalidNumeric("position size", position.size);
      if (currentPrice === null)
        return invalidNumeric("position currentPrice", position.currentPrice);
      totalValue = size * currentPrice;
    }

    const pendingOrders = await prisma.order.findMany({
      where: {
        userId: ctx.userId,
        tokenId,
        side: "BUY",
        status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
      },
      select: { size: true, price: true },
    });
    const pendingValue = pendingOrders.reduce((sum, o) => {
      const size = parseFiniteDecimal(o.size);
      const price = parseFiniteDecimal(o.price);
      if (size === null || price === null) return Number.POSITIVE_INFINITY;
      return sum + size * price;
    }, 0);

    totalValue += pendingValue;

    if (!position && pendingOrders.length === 0) {
      return { fired: true, reason: "no existing position" };
    }

    const fired = totalValue < max;
    return {
      fired,
      reason: `position $${totalValue.toFixed(2)} < max $${max}`,
    };
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
    const maxLossUsdc = String(params.maxLossUsdc ?? "0");
    const maxLoss = parseFiniteDecimal(maxLossUsdc);
    if (maxLoss === null)
      return Promise.resolve(invalidNumeric("maxLossUsdc", maxLossUsdc));

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

    const price = parseFiniteDecimal(data.price);
    const minValue = parseFiniteDecimal(min);
    const maxValue = parseFiniteDecimal(max);
    if (price === null) return invalidNumeric("price", data.price);
    if (minValue === null) return invalidNumeric("min", min);
    if (maxValue === null) return invalidNumeric("max", max);

    const fired = price >= minValue && price <= maxValue;
    return {
      fired,
      reason: `price ${price} in [${minValue}, ${maxValue}]: ${fired}`,
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

// no_existing_position — passes if no open position or pending orders on this token
export const NoExistingPositionBlock: BlockEvaluator = {
  async evaluate(block, ctx, _redis, prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    if (!tokenId) return { fired: true, reason: "no tokenId configured" };

    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    const size = position ? parseFiniteDecimal(position.size) : 0;
    if (size === null) return invalidNumeric("position size", position?.size);

    const hasPosition = !!position && size > 0;
    if (hasPosition) {
      return { fired: false, reason: `existing position on ${tokenId}` };
    }

    const pendingOrders = await prisma.order.findMany({
      where: {
        userId: ctx.userId,
        tokenId,
        status: { in: ["PENDING", "SUBMITTED", "LIVE"] },
      },
      select: { id: true },
    });
    if (pendingOrders.length > 0) {
      return { fired: false, reason: `pending order on ${tokenId}` };
    }

    return { fired: true, reason: "no position" };
  },
};

// time_window — passes if current time (UTC) is within window
export const TimeWindowBlock: BlockEvaluator = {
  evaluate(block, ctx, _redis, _prisma): Promise<BlockResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const startHHStr = String(params.startHH ?? "0");
    const startMMStr = String(params.startMM ?? "0");
    const endHHStr = String(params.endHH ?? "23");
    const endMMStr = String(params.endMM ?? "59");

    const isValidTimePiece = (s: string, min: number, max: number): boolean =>
      /^\d{1,2}$/.test(s) && Number(s) >= min && Number(s) <= max;

    if (
      !isValidTimePiece(startHHStr, 0, 23) ||
      !isValidTimePiece(startMMStr, 0, 59) ||
      !isValidTimePiece(endHHStr, 0, 23) ||
      !isValidTimePiece(endMMStr, 0, 59)
    ) {
      return Promise.resolve({
        fired: false,
        reason: "invalid time_window bounds",
      });
    }

    const startHH = Number(startHHStr);
    const startMM = Number(startMMStr);
    const endHH = Number(endHHStr);
    const endMM = Number(endMMStr);
    const now = new Date(ctx.now);
    const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMins = startHH * 60 + startMM;
    const endMins = endHH * 60 + endMM;

    const fired =
      startMins <= endMins
        ? currentMins >= startMins && currentMins <= endMins // same-day window
        : currentMins >= startMins || currentMins <= endMins; // overnight (wraps midnight)
    const fmt = (h: number, m: number) =>
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return Promise.resolve({
      fired,
      reason: `current ${fmt(now.getUTCHours(), now.getUTCMinutes())} UTC in [${fmt(startHH, startMM)}, ${fmt(endHH, endMM)}]: ${fired}`,
    });
  },
};
