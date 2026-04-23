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

  private static readonly CANDLE_INTERVAL_MAP: Partial<
    Record<CandleResolution, number>
  > = {
    "1m": 1,
    "1h": 60,
    "1d": 1440,
  };

  async getPriceHistory(
    outcomeId: string,
    resolution: CandleResolution,
  ): Promise<PriceCandle[]> {
    const interval = KalshiAdapterService.CANDLE_INTERVAL_MAP[resolution];
    if (!interval) return [];

    const candles = await this.rest.getCandlesticks(outcomeId, interval);
    return candles.map((c) => ({
      bucket: new Date(c.end_period_ts * 1000).toISOString(),
      open: String(KalshiRestService.normalizeKalshiPrice(c.price.open)),
      high: String(KalshiRestService.normalizeKalshiPrice(c.price.high)),
      low: String(KalshiRestService.normalizeKalshiPrice(c.price.low)),
      close: String(KalshiRestService.normalizeKalshiPrice(c.price.close)),
      volume: c.volume,
    }));
  }

  async submitOrder(order: VenueOrderRequest): Promise<VenueOrderResponse> {
    const isNo = order.venueOutcomeId === "no";
    const kalshiSide: "yes" | "no" = isNo ? "no" : "yes";
    const centPrice = KalshiRestService.denormalizeKalshiPrice(
      parseFloat(order.price),
    );

    const result = await this.rest.placeOrder({
      ticker: order.venueMarketId,
      side: kalshiSide,
      action: order.side === "BUY" ? "buy" : "sell",
      count: parseInt(order.size, 10),
      type: "limit",
      ...(isNo ? { no_price: centPrice } : { yes_price: centPrice }),
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

    const markets = await Promise.all(
      positions.map((p) =>
        this.rest.getMarket(p.ticker).catch((err) => {
          this.logger.warn(
            `Failed to fetch price for ${p.ticker}: ${String(err)}`,
          );
          return null;
        }),
      ),
    );

    return positions.map((p, i) => {
      const isNo = p.position < 0;
      const absSize = Math.abs(p.position);
      const outcome = isNo ? "no" : "yes";
      const avgPrice =
        absSize > 0 ? parseFloat(p.total_cost ?? "0") / absSize : 0;

      const market = markets[i];
      const yesPrice = market
        ? KalshiRestService.normalizeKalshiPrice(
            market.yes_bid ?? market.last_price ?? 0,
          )
        : 0;
      const currentPrice = isNo ? 1 - yesPrice : yesPrice;

      const unrealizedPnl =
        absSize > 0 ? (currentPrice - avgPrice) * absSize : 0;

      return {
        venueId: "kalshi" as VenueId,
        venueMarketId: p.ticker,
        venueOutcomeId: p.ticker,
        outcome,
        size: String(absSize),
        avgPrice: avgPrice.toFixed(4),
        currentPrice: String(currentPrice),
        unrealizedPnl: unrealizedPnl.toFixed(4),
      };
    });
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
