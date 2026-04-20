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
} from "@polyforge/shared-types";
import type {
  OrderBook,
  PriceCandle,
  CandleResolution,
} from "@polyforge/shared-types";
import { ClobClientService } from "../clob-client/clob-client.service";

interface PolymarketAuthContext {
  order: Record<string, unknown>;
  builderHeaders: Record<string, string>;
}

interface PolymarketCancelContext {
  apiKey: string;
}

const RESOLUTION_TO_INTERVAL: Record<CandleResolution, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "1d": "1440",
};

@Injectable()
export class PolymarketAdapter implements VenueAdapter {
  readonly venueId: VenueId = "polymarket";

  constructor(private readonly clob: ClobClientService) {}

  async getMarkets(_params: MarketQueryParams): Promise<UnifiedMarket[]> {
    // Market data ingestion for Polymarket uses the Gamma API pipeline, not
    // the CLOB client — this will be wired in Phase 3 via VenueDataRouter.
    return [];
  }

  async getOrderBook(outcomeId: string): Promise<OrderBook> {
    const raw = await this.clob.getBook(outcomeId);
    return {
      tokenId: outcomeId,
      bids: raw.bids,
      asks: raw.asks,
      updatedAt: raw.timestamp,
    };
  }

  async getPrice(outcomeId: string): Promise<string> {
    const raw = await this.clob.getBook(outcomeId);
    return raw.midpoint;
  }

  async getPriceHistory(
    outcomeId: string,
    resolution: CandleResolution,
  ): Promise<PriceCandle[]> {
    const interval = RESOLUTION_TO_INTERVAL[resolution];
    const result = await this.clob.getPricesHistory(outcomeId, interval);
    return result.history.map((point) => ({
      bucket: new Date(point.t * 1000).toISOString(),
      open: point.p,
      high: point.p,
      low: point.p,
      close: point.p,
      volume: 0,
    }));
  }

  async submitOrder(order: VenueOrderRequest): Promise<VenueOrderResponse> {
    const ctx = order.authContext as unknown as PolymarketAuthContext;
    const resp = await this.clob.submitOrder({
      order: ctx.order,
      builderHeaders: ctx.builderHeaders,
    });
    return {
      venueOrderId: resp.orderID,
      status: resp.status,
      transactionHash: resp.transactionHash,
    };
  }

  async cancelOrder(
    venueOrderId: string,
    authContext: Record<string, unknown>,
  ): Promise<void> {
    const { apiKey } = authContext as unknown as PolymarketCancelContext;
    await this.clob.cancelOrder(venueOrderId, apiKey);
  }

  async cancelAllOrders(authContext: Record<string, unknown>): Promise<void> {
    const { apiKey } = authContext as unknown as PolymarketCancelContext;
    await this.clob.cancelAll(apiKey);
  }

  async getPositions(_userId: string): Promise<VenuePosition[]> {
    // Positions are tracked in the PolyForge DB, not fetched from the CLOB API.
    return [];
  }

  async getOrderHistory(
    walletAddress: string,
    limit: number,
  ): Promise<VenueOrderHistory[]> {
    const trades = await this.clob.fetchTrades(walletAddress, limit);
    return trades.map((t) => ({
      venueOrderId: t["tradeID"] ?? t["id"] ?? "",
      venueMarketId: t["market"] ?? "",
      side: (t["side"] as "BUY" | "SELL") ?? "BUY",
      size: t["size"] ?? "0",
      price: t["price"] ?? "0",
      status: t["status"] ?? "UNKNOWN",
      filledAt: t["matchTime"] ? new Date(t["matchTime"]) : undefined,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.clob.getMidpoint("0x" + "0".repeat(64));
      return true;
    } catch {
      return false;
    }
  }
}
