import { Injectable, Logger } from "@nestjs/common";
import type {
  VenueAdapter,
  VenueId,
  MarketQueryParams,
  UnifiedMarket,
  VenueOrderRequest,
  VenueOrderResponse,
  VenuePosition,
  VenueOrderHistory,
} from "@polyforge/shared-types";
import type {
  OrderBook,
  PriceCandle,
  CandleResolution,
} from "@polyforge/shared-types";
import { KalshiRestService, type KalshiMarket } from "./kalshi-rest.service";

@Injectable()
export class KalshiAdapterService implements VenueAdapter {
  private readonly logger = new Logger(KalshiAdapterService.name);
  readonly venueId: VenueId = "kalshi";

  constructor(private readonly rest: KalshiRestService) {}

  async getMarkets(params: MarketQueryParams): Promise<UnifiedMarket[]> {
    const markets = await this.rest.getMarkets({
      limit: params.limit,
      offset: params.offset,
      status: params.active === false ? "finalized" : "open",
    });

    return markets.map((m) => this.mapMarket(m));
  }

  async getOrderBook(outcomeId: string): Promise<OrderBook> {
    const raw = await this.rest.getOrderBook(outcomeId);
    const now = Date.now();

    return {
      tokenId: outcomeId,
      bids: (raw.yes ?? []).map((e) => ({
        price: String(KalshiRestService.normalizeKalshiPrice(e.price)),
        size: String(e.quantity),
      })),
      // Kalshi no-side prices = 1 - yes price from the yes perspective
      asks: (raw.no ?? []).map((e) => ({
        price: String(KalshiRestService.normalizeKalshiPrice(100 - e.price)),
        size: String(e.quantity),
      })),
      updatedAt: now,
    };
  }

  async getPrice(outcomeId: string): Promise<string> {
    const market = await this.rest.getMarket(outcomeId);
    const centPrice = market.yes_bid ?? market.last_price ?? 0;
    return String(KalshiRestService.normalizeKalshiPrice(centPrice));
  }

  // Kalshi v2 API does not provide OHLCV candles in Phase 2 scope
  async getPriceHistory(
    _outcomeId: string,
    _resolution: CandleResolution,
  ): Promise<PriceCandle[]> {
    return [];
  }

  async submitOrder(order: VenueOrderRequest): Promise<VenueOrderResponse> {
    const ctx = order.authContext as { userId?: string };
    const yesPrice = KalshiRestService.denormalizeKalshiPrice(
      parseFloat(order.price),
    );

    const result = await this.rest.placeOrder({
      ticker: order.venueMarketId,
      side: "yes",
      action: order.side === "BUY" ? "buy" : "sell",
      count: parseInt(order.size, 10),
      type: "limit",
      yes_price: yesPrice,
      expiration_ts: order.expiration,
    });

    return {
      venueOrderId: result.order_id,
      status: result.status,
    };
  }

  async cancelOrder(
    venueOrderId: string,
    _authContext: Record<string, unknown>,
  ): Promise<void> {
    await this.rest.cancelOrder(venueOrderId);
  }

  async cancelAllOrders(authContext: Record<string, unknown>): Promise<void> {
    const ctx = authContext as { userId?: string };
    if (!ctx.userId) {
      throw new Error("cancelAllOrders requires authContext.userId");
    }
    const orders = await this.rest.getOrders(ctx.userId, 1000);
    const active = orders.filter(
      (o) => o.status === "resting" || o.status === "pending",
    );

    const results = await Promise.allSettled(
      active.map((o) => this.rest.cancelOrder(o.order_id)),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      this.logger.error(
        `cancelAllOrders: ${failures.length}/${active.length} cancels failed`,
      );
    }
  }

  async getPositions(userId: string): Promise<VenuePosition[]> {
    const positions = await this.rest.getPositions(userId);

    return positions.map((p) => ({
      venueId: "kalshi" as VenueId,
      venueMarketId: p.ticker,
      venueOutcomeId: p.ticker,
      outcome: "yes",
      size: String(p.position),
      avgPrice:
        p.position > 0
          ? String((parseFloat(p.total_cost ?? "0") / p.position).toFixed(4))
          : "0",
      currentPrice: "0", // TODO(POLA-405): wire real-time price from KalshiWsService
      unrealizedPnl: "0", // TODO(POLA-405): compute from currentPrice - avgPrice
    }));
  }

  async getOrderHistory(
    userId: string,
    limit: number,
  ): Promise<VenueOrderHistory[]> {
    const orders = await this.rest.getOrders(userId, limit);

    return orders.map((o) => ({
      venueOrderId: o.order_id,
      venueMarketId: o.ticker,
      side: o.action === "buy" ? "BUY" : "SELL",
      size: String(o.count),
      price: String(
        KalshiRestService.normalizeKalshiPrice(o.yes_price ?? o.no_price ?? 0),
      ),
      status: o.status,
      filledAt: o.created_time ? new Date(o.created_time) : undefined,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.rest.getBalance();
      return true;
    } catch (err) {
      this.logger.error(`Kalshi health check failed: ${String(err)}`);
      return false;
    }
  }

  // ─── Mapping helpers ──────────────────────────────────────────────────────

  private mapMarket(m: KalshiMarket): UnifiedMarket {
    return {
      venueId: "kalshi",
      externalId: m.ticker,
      title: m.title ?? m.ticker,
      category: m.category,
      endDate: m.close_time ? new Date(m.close_time) : undefined,
      closed: m.status !== "open" && m.status !== "active",
      outcomes: ["yes", "no"],
    };
  }
}
