import { v4 as uuidv4 } from "uuid";
import {
  ActionEvaluator,
  ActionResult,
  EvalContext,
  OrderIntent,
} from "./block.types";
import { RedisService } from "@polyforge/shared-redis";
import { PrismaService } from "@polyforge/shared-db";

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
  orderType: "GTC" | "FOK" | "GTD" | "FAK",
): OrderIntent {
  // SECURITY: Validate financial parameters before generating order intents
  const sizeNum = parseFloat(size);
  const priceNum = parseFloat(price);
  if (isNaN(sizeNum) || sizeNum <= 0 || sizeNum > 10000) {
    throw new Error(`Invalid order size: ${size} (must be 0 < size <= 10000)`);
  }
  if (isNaN(priceNum) || priceNum < 0.001 || priceNum > 0.999) {
    throw new Error(`Invalid order price: ${price} (must be 0.001-0.999)`);
  }
  if (!tokenId || typeof tokenId !== "string") {
    throw new Error("Invalid tokenId");
  }

  return {
    intentId: uuidv4(),
    userId: ctx.userId,
    strategyId: ctx.strategyId,
    marketId,
    tokenId,
    side,
    outcome,
    size,
    price,
    orderType,
  };
}

// ─── buy_yes ──────────────────────────────────────────────────────────────────
export const BuyYesAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const { tokenId, size, orderType } = (block["params"] as any) ?? {};
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
          String(size),
          price,
          orderType ?? "GTC",
        ),
      ],
    };
  },
};

// ─── buy_no ───────────────────────────────────────────────────────────────────
export const BuyNoAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const { tokenId, size, orderType } = (block["params"] as any) ?? {};
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
          String(size),
          price,
          orderType ?? "GTC",
        ),
      ],
    };
  },
};

// ─── set_stop_loss ────────────────────────────────────────────────────────────
export const SetStopLossAction: ActionEvaluator = {
  async execute(block, ctx, _redis, prisma): Promise<ActionResult> {
    const { tokenId, pct } = (block["params"] as any) ?? {};
    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    if (!position || parseFloat(position.size.toString()) === 0)
      return { intents: [] };

    const stopPrice =
      parseFloat(position.avgPrice.toString()) * (1 - parseFloat(pct ?? "0.1"));
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
          position.size.toString(),
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
    const { tokenId, pct } = (block["params"] as any) ?? {};
    const position = await prisma.position.findUnique({
      where: { userId_tokenId: { userId: ctx.userId, tokenId } },
    });
    if (!position || parseFloat(position.size.toString()) === 0)
      return { intents: [] };

    const tpPrice =
      parseFloat(position.avgPrice.toString()) * (1 + parseFloat(pct ?? "0.1"));
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
          position.size.toString(),
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
    const { tokenId, additionalSize, orderType } =
      (block["params"] as any) ?? {};
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
          String(additionalSize),
          price,
          orderType ?? "GTC",
        ),
      ],
    };
  },
};

// ─── scale_out ────────────────────────────────────────────────────────────────
export const ScaleOutAction: ActionEvaluator = {
  async execute(block, ctx, redis, prisma): Promise<ActionResult> {
    const { tokenId, reduceBySize, orderType } = (block["params"] as any) ?? {};
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
          String(reduceBySize),
          price,
          orderType ?? "GTC",
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
  async execute(block, ctx, _redis, _prisma): Promise<ActionResult> {
    const { marketId } = (block["params"] as any) ?? {};
    return {
      intents: [
        {
          intentId: uuidv4(),
          userId: ctx.userId,
          strategyId: ctx.strategyId,
          marketId: marketId ?? "",
          tokenId: "__cancel_all__",
          side: "SELL",
          outcome: "YES",
          size: "0",
          price: "0",
          orderType: "GTC",
        },
      ],
    };
  },
};

// ─── skip_bet — no-op, just logs ───────────────────────────────────────────────
export const SkipBetAction: ActionEvaluator = {
  async execute(_block, _ctx, _redis, _prisma): Promise<ActionResult> {
    return { intents: [] };
  },
};

// ─── run_strategy — launches a sub-strategy (handled by strategy runner) ───────
// This is a marker evaluator; the actual sub-strategy launch is handled by
// the StrategyRunner when it detects a RUN_STRATEGY action block. The evaluator
// itself returns no order intents — it produces a special __run_strategy__ intent
// that the runner intercepts and delegates to the registry service.
export const RunStrategyAction: ActionEvaluator = {
  async execute(block, ctx, _redis, prisma): Promise<ActionResult> {
    const { strategyId, mode } = (block["params"] as any) ?? {};
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
          intentId: uuidv4(),
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
