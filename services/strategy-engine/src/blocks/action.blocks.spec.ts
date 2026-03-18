import { describe, it, expect, vi } from "vitest";
import {
  BuyYesAction,
  BuyNoAction,
  SetStopLossAction,
  TakeProfitAction,
  ScaleInAction,
  ScaleOutAction,
  CancelAllOrdersAction,
  SkipBetAction,
} from "./action.blocks";
import { block, makeCtx, makePrisma, makeRedis } from "./__helpers__";

const TOKEN = { id: "tok-yes", marketId: "mkt-1", outcome: "YES" };
const NO_TOKEN = { id: "tok-no", marketId: "mkt-1", outcome: "NO" };

describe("BuyYesAction", () => {
  it("produces a BUY YES order intent with current price", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN);
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.72 }),
    });
    const ctx = makeCtx();

    const { intents } = await BuyYesAction.execute(
      block("buy_yes", { tokenId: "tok-yes", size: "50", orderType: "GTC" }),
      ctx,
      redis,
      prisma,
    );

    expect(intents).toHaveLength(1);
    const intent = intents[0];
    expect(intent.side).toBe("BUY");
    expect(intent.outcome).toBe("YES");
    expect(intent.size).toBe("50");
    expect(intent.price).toBe("0.72");
    expect(intent.orderType).toBe("GTC");
    expect(intent.userId).toBe(ctx.userId);
    expect(intent.strategyId).toBe(ctx.strategyId);
    expect(intent.marketId).toBe("mkt-1");
    expect(intent.intentId).toBeTruthy();
  });

  it("defaults price to 0.5 when no price data in Redis", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN);
    const { intents } = await BuyYesAction.execute(
      block("buy_yes", { tokenId: "tok-yes", size: "10" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(intents[0].price).toBe("0.5");
  });

  it("returns empty intents when token is not found", async () => {
    const prisma = makePrisma(); // findUnique returns null
    const { intents } = await BuyYesAction.execute(
      block("buy_yes", { tokenId: "unknown", size: "10" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(intents).toHaveLength(0);
  });

  it("defaults orderType to GTC when not specified", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN);
    const { intents } = await BuyYesAction.execute(
      block("buy_yes", { tokenId: "tok-yes", size: "10" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(intents[0].orderType).toBe("GTC");
  });

  it("produces unique intentIds on successive calls", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN);
    const [r1, r2] = await Promise.all([
      BuyYesAction.execute(
        block("buy_yes", { tokenId: "tok-yes", size: "10" }),
        makeCtx(),
        makeRedis(),
        prisma,
      ),
      BuyYesAction.execute(
        block("buy_yes", { tokenId: "tok-yes", size: "10" }),
        makeCtx(),
        makeRedis(),
        prisma,
      ),
    ]);
    expect(r1.intents[0].intentId).not.toBe(r2.intents[0].intentId);
  });
});

describe("BuyNoAction", () => {
  it("produces a BUY NO order intent for the NO token", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN); // YES token lookup
    prisma.token.findFirst.mockResolvedValue(NO_TOKEN); // finds NO paired token
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.28 }),
    });

    const { intents } = await BuyNoAction.execute(
      block("buy_no", { tokenId: "tok-yes", size: "30" }),
      makeCtx(),
      redis,
      prisma,
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].outcome).toBe("NO");
    expect(intents[0].side).toBe("BUY");
    expect(intents[0].price).toBe("0.28");
  });

  it("returns empty intents when NO token is not found", async () => {
    const prisma = makePrisma(); // findFirst returns null
    const { intents } = await BuyNoAction.execute(
      block("buy_no", { tokenId: "tok-yes", size: "10" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(intents).toHaveLength(0);
  });
});

describe("SetStopLossAction", () => {
  it("produces a SELL order at stop-loss price", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "100",
      avgPrice: "0.60",
    });
    prisma.token.findUnique.mockResolvedValue(TOKEN);

    const { intents } = await SetStopLossAction.execute(
      block("set_stop_loss", { tokenId: "tok-yes", pct: "0.1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].side).toBe("SELL");
    expect(parseFloat(intents[0].price)).toBeCloseTo(0.54, 2); // 0.60 * 0.9
  });

  it("returns empty intents when no position exists", async () => {
    const prisma = makePrisma(); // findUnique returns null
    const { intents } = await SetStopLossAction.execute(
      block("set_stop_loss", { tokenId: "tok-yes", pct: "0.1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(intents).toHaveLength(0);
  });

  it("returns empty intents when position size is 0", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "0",
      avgPrice: "0.60",
    });
    const { intents } = await SetStopLossAction.execute(
      block("set_stop_loss", { tokenId: "tok-yes", pct: "0.1" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(intents).toHaveLength(0);
  });

  it("defaults pct to 10% when not provided", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "100",
      avgPrice: "0.80",
    });
    prisma.token.findUnique.mockResolvedValue(TOKEN);

    const { intents } = await SetStopLossAction.execute(
      block("set_stop_loss", { tokenId: "tok-yes" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(parseFloat(intents[0].price)).toBeCloseTo(0.72, 2); // 0.80 * 0.9
  });
});

describe("TakeProfitAction", () => {
  it("produces a SELL order at take-profit price", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "100",
      avgPrice: "0.60",
    });
    prisma.token.findUnique.mockResolvedValue(TOKEN);

    const { intents } = await TakeProfitAction.execute(
      block("take_profit", { tokenId: "tok-yes", pct: "0.2" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].side).toBe("SELL");
    expect(parseFloat(intents[0].price)).toBeCloseTo(0.72, 2); // 0.60 * 1.2
  });

  it("caps the take-profit price at 0.99", async () => {
    const prisma = makePrisma();
    prisma.position.findUnique.mockResolvedValue({
      size: "100",
      avgPrice: "0.95",
    });
    prisma.token.findUnique.mockResolvedValue(TOKEN);

    const { intents } = await TakeProfitAction.execute(
      block("take_profit", { tokenId: "tok-yes", pct: "0.5" }),
      makeCtx(),
      makeRedis(),
      prisma,
    );
    expect(parseFloat(intents[0].price)).toBeLessThanOrEqual(0.99);
  });

  it("returns empty intents when no position exists", async () => {
    const { intents } = await TakeProfitAction.execute(
      block("take_profit", { tokenId: "tok-yes", pct: "0.1" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(intents).toHaveLength(0);
  });
});

describe("ScaleInAction", () => {
  it("produces a BUY order to add to existing position", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN);
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.65 }),
    });

    const { intents } = await ScaleInAction.execute(
      block("scale_in", {
        tokenId: "tok-yes",
        additionalSize: "25",
        orderType: "GTC",
      }),
      makeCtx(),
      redis,
      prisma,
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].side).toBe("BUY");
    expect(intents[0].size).toBe("25");
    expect(intents[0].price).toBe("0.65");
  });

  it("returns empty intents when token not found", async () => {
    const { intents } = await ScaleInAction.execute(
      block("scale_in", { tokenId: "unknown", additionalSize: "25" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(intents).toHaveLength(0);
  });
});

describe("ScaleOutAction", () => {
  it("produces a SELL order to reduce existing position", async () => {
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue(TOKEN);
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
    });

    const { intents } = await ScaleOutAction.execute(
      block("scale_out", {
        tokenId: "tok-yes",
        reduceBySize: "40",
        orderType: "FOK",
      }),
      makeCtx(),
      redis,
      prisma,
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].side).toBe("SELL");
    expect(intents[0].size).toBe("40");
    expect(intents[0].orderType).toBe("FOK");
  });

  it("returns empty intents when token not found", async () => {
    const { intents } = await ScaleOutAction.execute(
      block("scale_out", { tokenId: "unknown", reduceBySize: "10" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(intents).toHaveLength(0);
  });
});

describe("CancelAllOrdersAction", () => {
  it("produces a cancel-all sentinel intent", async () => {
    const { intents } = await CancelAllOrdersAction.execute(
      block("cancel_all_orders", { marketId: "mkt-1" }),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(intents).toHaveLength(1);
    const i = intents[0];
    expect(i.tokenId).toBe("__cancel_all__");
    expect(i.size).toBe("0");
    expect(i.side).toBe("SELL");
    expect(i.marketId).toBe("mkt-1");
  });

  it("uses empty marketId when not configured", async () => {
    const { intents } = await CancelAllOrdersAction.execute(
      block("cancel_all_orders", {}),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(intents[0].marketId).toBe("");
  });
});

describe("SkipBetAction", () => {
  it("returns empty intents (no-op)", async () => {
    const { intents } = await SkipBetAction.execute(
      block("skip_bet", {}),
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );
    expect(intents).toHaveLength(0);
  });
});
