import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { LpService } from "./lp.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    polymarketConnected: true,
    ...overrides,
  };
}

function makeMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "market-1",
    tokens: [
      { id: "yes-token-1", outcome: "YES", price: "0.50" },
      { id: "no-token-1", outcome: "NO", price: "0.50" },
    ],
    ...overrides,
  };
}

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    marketId: "market-1",
    tokenId: "yes-token-1",
    amountUsdc: 100,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("LpService", () => {
  let service: LpService;
  let db: MockDb;
  let redis: RedisService;
  let xaddFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    xaddFn = vi.fn().mockResolvedValue("stream-id");
    redis = {
      xadd: xaddFn,
    } as unknown as RedisService;
    service = new LpService(db as any, redis);
  });

  it("throws UnprocessableEntityException if user not polymarket connected", async () => {
    db.user.findUnique.mockResolvedValue(
      makeUser({ polymarketConnected: false }) as any,
    );

    await expect(
      service.provideLiquidity("user-1", makeDto() as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("throws UnprocessableEntityException with NOT_CONNECTED code when user is null", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(
      service.provideLiquidity("user-1", makeDto() as any),
    ).rejects.toMatchObject({
      response: { code: "NOT_CONNECTED" },
    });
  });

  it("throws NotFoundException if market not found", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(null);

    await expect(
      service.provideLiquidity("user-1", makeDto() as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException with MARKET_NOT_FOUND code", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(null);

    await expect(
      service.provideLiquidity("user-1", makeDto() as any),
    ).rejects.toMatchObject({
      response: { code: "MARKET_NOT_FOUND" },
    });
  });

  it("throws UnprocessableEntityException if no YES token", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(
      makeMarket({
        tokens: [{ id: "no-token-1", outcome: "NO", price: "0.50" }],
      }) as any,
    );

    await expect(
      service.provideLiquidity("user-1", makeDto() as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("throws with NO_YES_TOKEN code when YES token is missing", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(
      makeMarket({
        tokens: [{ id: "no-token-1", outcome: "NO", price: "0.50" }],
      }) as any,
    );

    await expect(
      service.provideLiquidity("user-1", makeDto() as any),
    ).rejects.toMatchObject({
      response: { code: "NO_YES_TOKEN" },
    });
  });

  it("creates 2 orders (buy + sell) on happy path", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(makeMarket() as any);
    db.order.create.mockResolvedValueOnce({ id: "buy-order-id" } as any);
    db.order.create.mockResolvedValueOnce({ id: "sell-order-id" } as any);

    const result = await service.provideLiquidity("user-1", makeDto() as any);

    expect(db.order.create).toHaveBeenCalledTimes(2);
    expect(xaddFn).toHaveBeenCalledTimes(2);
    expect(result.buyOrderId).toBe("buy-order-id");
    expect(result.sellOrderId).toBe("sell-order-id");
    expect(result.status).toBe("PENDING");
    expect(result.marketId).toBe("market-1");
    expect(result.amountDeployed).toBe(100);
  });

  it("defaults spread to 0.02 when targetSpread is not provided", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(makeMarket() as any);
    db.order.create.mockResolvedValue({ id: "order-id" } as any);

    const result = await service.provideLiquidity("user-1", makeDto() as any);

    expect(result.targetSpread).toBe(0.02);
    // yesPrice = 0.50, spread = 0.02 => buy=0.49, sell=0.51
    expect(result.buyQuote).toBeCloseTo(0.49, 4);
    expect(result.sellQuote).toBeCloseTo(0.51, 4);
  });

  it("uses custom targetSpread", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(makeMarket() as any);
    db.order.create.mockResolvedValue({ id: "order-id" } as any);

    const result = await service.provideLiquidity(
      "user-1",
      makeDto({ targetSpread: 0.1 }) as any,
    );

    expect(result.targetSpread).toBe(0.1);
    // yesPrice=0.50, spread=0.10 => buy=0.45, sell=0.55
    expect(result.buyQuote).toBeCloseTo(0.45, 4);
    expect(result.sellQuote).toBeCloseTo(0.55, 4);
  });

  it("clamps buy price to minimum 0.01", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    // yesPrice = 0.005, spread = 0.02 => raw buy = 0.005 - 0.01 = -0.005 => clamped to 0.01
    db.market.findUnique.mockResolvedValue(
      makeMarket({
        tokens: [
          { id: "yes-token-1", outcome: "YES", price: "0.005" },
          { id: "no-token-1", outcome: "NO", price: "0.995" },
        ],
      }) as any,
    );
    db.order.create.mockResolvedValue({ id: "order-id" } as any);

    const result = await service.provideLiquidity("user-1", makeDto() as any);

    expect(result.buyQuote).toBeGreaterThanOrEqual(0.01);
  });

  it("clamps sell price to maximum 0.99", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    // yesPrice = 0.995, spread = 0.02 => raw sell = 0.995 + 0.01 = 1.005 => clamped to 0.99
    db.market.findUnique.mockResolvedValue(
      makeMarket({
        tokens: [
          { id: "yes-token-1", outcome: "YES", price: "0.995" },
          { id: "no-token-1", outcome: "NO", price: "0.005" },
        ],
      }) as any,
    );
    db.order.create.mockResolvedValue({ id: "order-id" } as any);

    const result = await service.provideLiquidity("user-1", makeDto() as any);

    expect(result.sellQuote).toBeLessThanOrEqual(0.99);
  });

  it("sends correct data to Redis stream", async () => {
    db.user.findUnique.mockResolvedValue(makeUser() as any);
    db.market.findUnique.mockResolvedValue(makeMarket() as any);
    db.order.create.mockResolvedValue({ id: "order-id" } as any);

    await service.provideLiquidity("user-1", makeDto() as any);

    // First xadd call is the buy order
    const buyCall = xaddFn.mock.calls[0];
    expect(buyCall[0]).toBe("stream:orders");
    expect(buyCall[1]).toMatchObject({
      userId: "user-1",
      marketId: "market-1",
      side: "BUY",
      outcome: "YES",
    });

    // Second xadd call is the sell order
    const sellCall = xaddFn.mock.calls[1];
    expect(sellCall[0]).toBe("stream:orders");
    expect(sellCall[1]).toMatchObject({
      userId: "user-1",
      marketId: "market-1",
      side: "SELL",
      outcome: "YES",
    });
  });
});
