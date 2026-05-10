import zodPackage from "zod/package.json";
import { describe, expect, it } from "vitest";
import {
  CreateTicketSchema,
  DecimalStringSchema,
  OrderIntentSchema,
  OrderQuerySchema,
  PaginationSchema,
  PriceStringSchema,
  StreamEventSchema,
  WsClientMessageSchema,
} from "./index";

describe("shared zod 4 schema compatibility", () => {
  it("runs against the zod 4 major version", () => {
    expect(zodPackage.version).toMatch(/^4\./);
  });

  it("keeps pagination defaults and numeric coercion stable", () => {
    expect(PaginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(PaginationSchema.parse({ page: "2", limit: "50" })).toEqual({
      page: 2,
      limit: 50,
    });
  });

  it("does not materialize absent optional order filters", () => {
    expect(OrderQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("preserves ticket category defaulting", () => {
    expect(
      CreateTicketSchema.parse({
        subject: "Billing question",
        body: "Where can I find my invoice?",
      }),
    ).toEqual({
      subject: "Billing question",
      category: "GENERAL",
      body: "Where can I find my invoice?",
    });
  });

  it("keeps custom decimal and price validation messages", () => {
    expect(DecimalStringSchema.safeParse("abc").error?.issues[0]?.message).toBe(
      'Must be a decimal string (e.g. "1.50", "0.72")',
    );
    expect(PriceStringSchema.safeParse("1.00").error?.issues[0]?.message).toBe(
      'Price must be a decimal between 0 and 1 exclusive (e.g. "0.72")',
    );
  });

  it("keeps stream event discriminator parsing and timestamp coercion stable", () => {
    expect(
      StreamEventSchema.parse({
        event_type: "ORDER_FILLED",
        timestamp: "1700000000",
        userId: "11111111-1111-4111-8111-111111111111",
        orderId: "22222222-2222-4222-8222-222222222222",
        filledSize: "10.50",
        avgFillPrice: "0.72",
        pnl: "1.25",
      }),
    ).toMatchObject({
      event_type: "ORDER_FILLED",
      timestamp: 1700000000,
    });
  });

  it("keeps WebSocket message discriminator and array bounds stable", () => {
    expect(
      WsClientMessageSchema.safeParse({
        type: "SUBSCRIBE_PRICES",
        tokenIds: Array.from({ length: 51 }, (_, index) => `token-${index}`),
      }).success,
    ).toBe(false);
  });

  it("accepts polymarket_us in OrderIntentSchema venue", () => {
    const validIntent = {
      intentId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      strategyId: null,
      marketId: "0xabc123",
      tokenId: "0xdef456",
      side: "BUY",
      outcome: "YES",
      size: "100.00",
      price: "0.55",
      orderType: "GTC",
      venue: "polymarket_us",
    };
    expect(OrderIntentSchema.safeParse(validIntent).success).toBe(true);
  });
});
