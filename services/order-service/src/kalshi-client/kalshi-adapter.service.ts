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
import { parseFiniteDecimal } from "@polyforge/shared-types";
import type {
  OrderBook,
  PriceCandle,
  CandleResolution,
} from "@polyforge/shared-types";
import type { Market } from "kalshi-typescript";
import { KalshiRestService, parseKalshiDollars } from "./kalshi-rest.service";

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
      asks: (raw.no ?? []).map((e) => ({
        price: String(KalshiRestService.normalizeKalshiPrice(100 - e.price)),
        size: String(e.quantity),
      })),
      updatedAt: now,
    };
  }

  async getPrice(outcomeId: string): Promise<string> {
    const market = await this.rest.getMarket(outcomeId);
    const dollarPrice =
      parseKalshiDollars(market.yes_bid_dollars) ??
      parseKalshiDollars(market.last_price_dollars);
    if (dollarPrice !== undefined) return String(dollarPrice);
    return "0";
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
      open: c.price.open_dollars ?? "0",
      high: c.price.high_dollars ?? "0",
      low: c.price.low_dollars ?? "0",
      close: c.price.close_dollars ?? "0",
      volume: parseFiniteDecimal(c.volume_fp) ?? 0,
    }));
  }

  async submitOrder(order: VenueOrderRequest): Promise<VenueOrderResponse> {
    const isNo = order.venueOutcomeId === "no";
    const kalshiSide: "yes" | "no" = isNo ? "no" : "yes";
    const priceNum = parseFiniteDecimal(order.price);
    if (priceNum === null) {
      throw new Error(`Invalid Kalshi order price: ${order.price}`);
    }
    const dollarsStr = KalshiRestService.toDollarsString(priceNum);

    const sizeNum = parseFiniteDecimal(order.size);
    if (sizeNum === null) {
      throw new Error(`Invalid Kalshi order size: ${order.size}`);
    }
    const isFractional = !Number.isInteger(sizeNum);

    const ctx = order.authContext as {
      clientOrderId?: string;
      selfTradePreventionType?: "taker_at_cross" | "maker";
      postOnly?: boolean;
      reduceOnly?: boolean;
      cancelOrderOnPause?: boolean;
      subaccount?: number;
    };

    const result = await this.rest.placeOrder({
      ticker: order.venueMarketId,
      side: kalshiSide,
      action: order.side === "BUY" ? "buy" : "sell",
      count: Math.floor(sizeNum),
      ...(isFractional && { count_fp: sizeNum.toFixed(2) }),
      ...(isNo
        ? { no_price_dollars: dollarsStr }
        : { yes_price_dollars: dollarsStr }),
      expiration_ts: order.expiration,
      ...(ctx.clientOrderId && { client_order_id: ctx.clientOrderId }),
      self_trade_prevention_type:
        ctx.selfTradePreventionType ?? "taker_at_cross",
      ...(order.orderType === "POST_ONLY" && { post_only: true }),
      ...(ctx.postOnly && { post_only: true }),
      ...(ctx.reduceOnly && { reduce_only: true }),
      ...(ctx.cancelOrderOnPause && { cancel_order_on_pause: true }),
      ...(ctx.subaccount != null && { subaccount: ctx.subaccount }),
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
    const active = orders.filter((o) => o.status === "resting");

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

  async getPositions(
    userId: string,
    subaccount?: number,
  ): Promise<VenuePosition[]> {
    const positions = await this.rest.getPositions(userId, subaccount);

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
      const positionCount = parseFiniteDecimal(p.position_fp) ?? 0;
      const isNo = positionCount < 0;
      const absSize = Math.abs(positionCount);
      const outcome = isNo ? "no" : "yes";
      const totalTraded = parseFiniteDecimal(p.total_traded_dollars) ?? 0;
      const avgPrice = absSize > 0 ? totalTraded / absSize : 0;

      const market = markets[i];
      const yesPrice = market
        ? (parseKalshiDollars(market.yes_bid_dollars) ??
          parseKalshiDollars(market.last_price_dollars) ??
          0)
        : 0;
      const currentPrice = isNo ? 1 - yesPrice : yesPrice;

      const unrealizedPnl =
        absSize > 0 ? (currentPrice - avgPrice) * absSize : 0;

      return {
        venueId: "kalshi",
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
      size: o.remaining_count_fp ?? o.initial_count_fp ?? "0",
      price: String(
        KalshiRestService.resolvePriceDollars(
          o.yes_price_dollars ?? o.no_price_dollars,
          undefined,
        ),
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

  private mapMarket(m: Market): UnifiedMarket {
    return {
      venueId: "kalshi",
      externalId: m.ticker,
      title: m.yes_sub_title ?? m.ticker,
      category: undefined,
      endDate: m.close_time ? new Date(m.close_time) : undefined,
      closed: m.status !== "active",
      outcomes: ["yes", "no"],
    };
  }
}
