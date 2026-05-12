import { randomUUID } from "node:crypto";
import {
  ActionEvaluator,
  ActionResult,
  EvalContext,
  OrderIntent,
} from "./block.types";
import { PrismaService } from "@polyforge/shared-db";
import {
  parseFiniteDecimal,
  validateStopLossTakeProfitPct,
} from "@polyforge/shared-types";

type BlockParams = Record<string, string | number | undefined>;
type OrderType = "GTC" | "FOK" | "GTD" | "FAK";

// Helper: resolve market/token info
async function resolveMarket(
  tokenId: string,
  prisma: PrismaService,
): Promise<{ marketId: string; outcome: "YES" | "NO" } | null> {
  const token = await prisma.token.findUnique({ where: { id: tokenId } });
  if (!token) return null;
  return {
    marketId: token.marketId,
    outcome: token.outcome === "YES" ? "YES" : "NO",
  };
}

function makeIntent(
  ctx: EvalContext,
  tokenId: string,
  marketId: string,
  outcome: "YES" | "NO",
  side: "BUY" | "SELL",
  size: string,
  price: string,
  orderType: OrderType,
): OrderIntent {
  // SECURITY: Validate financial parameters before generating order intents
  const sizeNum = parseFiniteDecimal(size);
  const priceNum = parseFiniteDecimal(price);
  if (sizeNum === null || sizeNum <= 0 || sizeNum > 10000) {
    throw new Error(`Invalid order size: ${size} (must be 0 < size <= 10000)`);
  }
  if (priceNum === null || priceNum < 0.001 || priceNum > 0.999) {
    throw new Error(`Invalid order price: ${price} (must be 0.001-0.999)`);
  }
  if (!tokenId || typeof tokenId !== "string") {
    throw new Error("Invalid tokenId");
  }

  return {
    intentId: randomUUID(),
    userId: ctx.userId,
    strategyId: ctx.strategyId,
    marketId,
    tokenId,
    side,
    outcome,
    size,
    price,
    orderType,
    ...(ctx.venue !== undefined ? { venue: ctx.venue } : {}),
    ...(ctx.kalshiSubaccount != null
      ? { kalshiSubaccount: ctx.kalshiSubaccount }
      : {}),
  };
}

function toOrderType(val: string | number | undefined): OrderType {
  const s = String(val ?? "GTC");
  if (s === "FOK" || s === "GTD" || s === "FAK") return s;
  return "GTC";
}

// ─── buy_yes ──────────────────────────────────────────────────────────────────
export const BuyYesAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const size = String(params.size ?? "0");
    const orderType = toOrderType(params.orderType);
    const resolved = await resolveMarket(tokenId, prisma);
    if (!resolved) return { intents: [] };

    const priceData = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    const price = priceData ? String(priceData.price) : "0.5";

    return {
      intents: [
        makeIntent(
          ctx,
          tokenId,
          resolved.marketId,
          "YES",
          "BUY",
          size,
          price,
          orderType,
        ),
      ],
    };
  },
};

// ─── buy_no ───────────────────────────────────────────────────────────────────
export const BuyNoAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const size = String(params.size ?? "0");
    const orderType = toOrderType(params.orderType);
    // For NO token: find the paired NO token
    const noToken = await prisma.token.findFirst({
      where: {
        marketId: (await prisma.token.findUnique({ where: { id: tokenId } }))
          ?.marketId,
        outcome: "NO",
      },
    });
    if (!noToken) return { intents: [] };

    const priceData = await redis.getJson<{ price: number }>(
      `cache:price:${noToken.id}`,
    );
    const price = priceData ? String(priceData.price) : "0.5";

    return {
      intents: [
        makeIntent(
          ctx,
          noToken.id,
          noToken.marketId,
          "NO",
          "BUY",
          size,
          price,
          orderType,
        ),
      ],
    };
  },
};

// ─── set_stop_loss ────────────────────────────────────────────────────────────
export const SetStopLossAction: ActionEvaluator = {
  async execute(block, ctx, _redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const pct = String(params.pct ?? "0.1");
    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    const positionSize = parseFiniteDecimal(position?.size);
    if (!position || positionSize === null || positionSize === 0)
      return { intents: [] };

    const avgPrice = parseFiniteDecimal(position.avgPrice);
    const pctNum = validateStopLossTakeProfitPct(pct, "set_stop_loss");

    const stopPrice = avgPrice === null ? Number.NaN : avgPrice * (1 - pctNum);
    const resolved = await resolveMarket(tokenId, prisma);
    if (!resolved) return { intents: [] };

    return {
      intents: [
        makeIntent(
          ctx,
          tokenId,
          resolved.marketId,
          resolved.outcome,
          "SELL",
          String(positionSize),
          String(stopPrice.toFixed(4)),
          "GTC",
        ),
      ],
    };
  },
};

// ─── take_profit ──────────────────────────────────────────────────────────────
export const TakeProfitAction: ActionEvaluator = {
  async execute(block, ctx, _redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const pct = String(params.pct ?? "0.1");
    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    const positionSize = parseFiniteDecimal(position?.size);
    if (!position || positionSize === null || positionSize === 0)
      return { intents: [] };

    const avgPrice = parseFiniteDecimal(position.avgPrice);
    const pctNum = validateStopLossTakeProfitPct(pct, "take_profit");

    const tpPrice = avgPrice === null ? Number.NaN : avgPrice * (1 + pctNum);
    const resolved = await resolveMarket(tokenId, prisma);
    if (!resolved) return { intents: [] };

    return {
      intents: [
        makeIntent(
          ctx,
          tokenId,
          resolved.marketId,
          resolved.outcome,
          "SELL",
          String(positionSize),
          String(Math.min(tpPrice, 0.99).toFixed(4)),
          "GTC",
        ),
      ],
    };
  },
};

// ─── scale_in ─────────────────────────────────────────────────────────────────
export const ScaleInAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const additionalSize = String(params.additionalSize ?? "0");
    const orderType = toOrderType(params.orderType);
    const resolved = await resolveMarket(tokenId, prisma);
    if (!resolved) return { intents: [] };

    const priceData = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    const price = priceData ? String(priceData.price) : "0.5";

    return {
      intents: [
        makeIntent(
          ctx,
          tokenId,
          resolved.marketId,
          resolved.outcome,
          "BUY",
          additionalSize,
          price,
          orderType,
        ),
      ],
    };
  },
};

// ─── scale_out ────────────────────────────────────────────────────────────────
export const ScaleOutAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const tokenId = String(params.tokenId ?? "");
    const reduceBySize = String(params.reduceBySize ?? "0");
    const orderType = toOrderType(params.orderType);
    const resolved = await resolveMarket(tokenId, prisma);
    if (!resolved) return { intents: [] };

    const priceData = await redis.getJson<{ price: number }>(
      `cache:price:${tokenId}`,
    );
    const price = priceData ? String(priceData.price) : "0.5";

    return {
      intents: [
        makeIntent(
          ctx,
          tokenId,
          resolved.marketId,
          resolved.outcome,
          "SELL",
          reduceBySize,
          price,
          orderType,
        ),
      ],
    };
  },
};

// ─── cancel_all_orders — calls CLOB bulk cancel via order-service ────────────
// The cancel-all intent carries a sentinel tokenId that the order-service
// stream consumer intercepts. When the order-service sees __cancel_all__ it
// calls the CLOB bulk-cancel endpoint (DELETE /cancel-all or
// DELETE /cancel-orders?market=X) instead of placing an order.
export const CancelAllOrdersAction: ActionEvaluator = {
  execute(block, ctx, _redis, _prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const marketId = String(params.marketId ?? "");
    return Promise.resolve({
      intents: [
        {
          intentId: randomUUID(),
          userId: ctx.userId,
          strategyId: ctx.strategyId,
          marketId,
          tokenId: "__cancel_all__",
          side: "SELL",
          outcome: "YES",
          size: "0",
          price: "0",
          orderType: "GTC",
        },
      ],
    });
  },
};

// ─── skip_bet — no-op, just logs ───────────────────────────────────────────────
export const SkipBetAction: ActionEvaluator = {
  execute(_block, _ctx, _redis, _prisma): Promise<ActionResult> {
    return Promise.resolve({ intents: [] });
  },
};

// ─── combo_leg — Kalshi combo/multivariate event order ────────────────────────
export const ComboLegAction: ActionEvaluator = {
  async execute(block, ctx, redis, _prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const marketTicker = String(params.marketTicker ?? "");
    const side = String(params.side ?? "BUY") as "BUY" | "SELL";
    const size = String(params.size ?? "0");
    const orderType = toOrderType(params.orderType);

    if (!marketTicker) return { intents: [] };

    const priceData = await redis.getJson<{ price: number }>(
      `cache:price:kalshi:${marketTicker}`,
    );
    const price = priceData ? String(priceData.price) : "0.5";

    const sizeNum = parseFiniteDecimal(size);
    const priceNum = parseFiniteDecimal(price);
    if (sizeNum === null || sizeNum <= 0 || sizeNum > 10000) {
      return { intents: [] };
    }
    if (priceNum === null || priceNum < 0.001 || priceNum > 0.999) {
      return { intents: [] };
    }

    return {
      intents: [
        {
          intentId: randomUUID(),
          userId: ctx.userId,
          strategyId: ctx.strategyId,
          marketId: marketTicker,
          tokenId: marketTicker,
          side,
          outcome: side === "BUY" ? "YES" : "NO",
          size,
          price,
          orderType,
          venue: "kalshi",
        },
      ],
    };
  },
};

// ─── run_strategy — launches a sub-strategy (handled by strategy runner) ───────
// This is a marker evaluator; the actual sub-strategy launch is handled by
// the StrategyRunner when it detects a RUN_STRATEGY action block. The evaluator
// itself returns no order intents — it produces a special __run_strategy__ intent
// that the runner intercepts and delegates to the registry service.
export const RunStrategyAction: ActionEvaluator = {
  async execute(block, ctx, _redis, prisma): Promise<ActionResult> {
    const params = (block["params"] as BlockParams) ?? {};
    const strategyId = String(params.strategyId ?? "");
    const mode = String(params.mode ?? "");
    if (!strategyId || !mode) return { intents: [] };

    // Self-reference check
    if (strategyId === ctx.strategyId) return { intents: [] };

    // Validate child strategy exists and is owned by the same user
    const child = await prisma.strategy.findUnique({
      where: { id: strategyId },
      select: { id: true, userId: true },
    });
    if (!child || child.userId !== ctx.userId) return { intents: [] };

    // Return a sentinel intent that the runner intercepts
    return {
      intents: [
        {
          intentId: randomUUID(),
          userId: ctx.userId,
          strategyId: ctx.strategyId,
          marketId: "__run_strategy__",
          tokenId: strategyId, // child strategy ID
          side: "BUY",
          outcome: "YES",
          size: mode, // sub-strategy mode stored in size field
          price: "0",
          orderType: "GTC",
        },
      ],
    };
  },
};
