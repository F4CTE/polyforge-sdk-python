import { Injectable } from "@nestjs/common";
import type {
  VenueAdapter,
  VenueId,
  MarketQueryParams,
  UnifiedMarket,
  VenueOrderRequest,
  VenueOrderResponse,
  VenuePosition,
  VenueOrderHistory,
  PolymarketUsAuthContext,
} from "@polyforge/shared-types";
import type {
  OrderBook,
  PriceCandle,
  CandleResolution,
} from "@polyforge/shared-types";
import {
  PolymarketUsClientService,
  type PolymarketUsCreds,
} from "../polymarket-us-client/polymarket-us-client.service";

// Extends the shared-types context with secretKey for pre-Phase-2 direct auth.
// Phase 2 (signer-service) will absorb signing so callers no longer need to pass it.
interface PolymarketUsCredsContext extends PolymarketUsAuthContext {
  secretKey: string;
}

@Injectable()
export class PolymarketUsAdapter implements VenueAdapter {
  readonly venueId: VenueId = "polymarket_us";

  constructor(private readonly client: PolymarketUsClientService) {}

  async getMarkets(params: MarketQueryParams): Promise<UnifiedMarket[]> {
    const resp = await this.client.getMarkets({
      limit: params.limit,
      offset: params.offset,
      active: params.active,
    });
    return resp.markets.map((m) => ({
      venueId: this.venueId,
      externalId: m.slug,
      title: m.title,
      closed: m.closed,
      outcomes: [m.outcome],
    }));
  }

  async getOrderBook(slug: string): Promise<OrderBook> {
    const book = await this.client.getOrderBook(slug);
    return {
      tokenId: slug,
      bids: book.bids.map((b) => ({
        price: b.px.value,
        size: b.qty,
      })),
      asks: book.offers.map((a) => ({
        price: a.px.value,
        size: a.qty,
      })),
      updatedAt: book.transactTime ? Date.parse(book.transactTime) : Date.now(),
    };
  }

  async getPrice(slug: string): Promise<string> {
    const price = await this.client.getPrice(slug);
    return price ?? "0";
  }

  // US API does not expose candle history — return empty for now.
  async getPriceHistory(
    _outcomeId: string,
    _resolution: CandleResolution,
  ): Promise<PriceCandle[]> {
    return [];
  }

  async submitOrder(order: VenueOrderRequest): Promise<VenueOrderResponse> {
    const ctx = order.authContext as unknown as PolymarketUsCredsContext;
    const creds: PolymarketUsCreds = {
      keyId: ctx.keyId,
      secretKey: ctx.secretKey,
    };

    const intent =
      order.side === "BUY"
        ? ("ORDER_INTENT_BUY_LONG" as const)
        : ("ORDER_INTENT_SELL_LONG" as const);

    const tif = mapOrderType(order.orderType);

    const resp = await this.client.submitOrder(creds, {
      marketSlug: order.venueMarketId,
      intent,
      type: "ORDER_TYPE_LIMIT",
      price: { value: order.price, currency: "USD" },
      quantity: parseFloat(order.size),
      tif,
      ...(order.expiration
        ? { goodTillTime: new Date(order.expiration * 1000).toISOString() }
        : {}),
    });

    return {
      venueOrderId: resp.id,
      status: resp.executions?.[0]?.type ?? "ORDER_STATE_NEW",
    };
  }

  async cancelOrder(
    venueOrderId: string,
    authContext: Record<string, unknown>,
  ): Promise<void> {
    const ctx = authContext as unknown as PolymarketUsCredsContext;
    const creds: PolymarketUsCreds = {
      keyId: ctx.keyId,
      secretKey: ctx.secretKey,
    };
    // The US API requires marketSlug on cancel — caller must supply it in authContext
    const marketSlug = (authContext["marketSlug"] as string | undefined) ?? "";
    await this.client.cancelOrder(creds, venueOrderId, { marketSlug });
  }

  async cancelAllOrders(authContext: Record<string, unknown>): Promise<void> {
    const ctx = authContext as unknown as PolymarketUsCredsContext;
    const creds: PolymarketUsCreds = {
      keyId: ctx.keyId,
      secretKey: ctx.secretKey,
    };
    await this.client.cancelAll(creds);
  }

  async getPositions(userId: string): Promise<VenuePosition[]> {
    void userId;
    // Positions require user credentials — returned to callers with auth context via a separate path.
    return [];
  }

  async getOrderHistory(
    _userId: string,
    limit: number,
  ): Promise<VenueOrderHistory[]> {
    void _userId;
    void limit;
    // Order history requires user credentials — requires auth context not available here.
    return [];
  }

  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }
}

function mapOrderType(
  orderType: VenueOrderRequest["orderType"],
):
  | "TIME_IN_FORCE_GOOD_TILL_CANCEL"
  | "TIME_IN_FORCE_FILL_OR_KILL"
  | "TIME_IN_FORCE_GOOD_TILL_DATE"
  | "TIME_IN_FORCE_IMMEDIATE_OR_CANCEL" {
  switch (orderType) {
    case "GTC":
      return "TIME_IN_FORCE_GOOD_TILL_CANCEL";
    case "FOK":
      return "TIME_IN_FORCE_FILL_OR_KILL";
    case "GTD":
      return "TIME_IN_FORCE_GOOD_TILL_DATE";
    case "FAK":
      return "TIME_IN_FORCE_IMMEDIATE_OR_CANCEL";
    case "POST_ONLY":
      // US API doesn't have POST_ONLY — treat as GTC
      return "TIME_IN_FORCE_GOOD_TILL_CANCEL";
    default:
      return "TIME_IN_FORCE_GOOD_TILL_CANCEL";
  }
}
