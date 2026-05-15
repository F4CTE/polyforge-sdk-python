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
import {
  ClobClientService,
  PriceHistoryInterval,
} from "../clob-client/clob-client.service";
import type { PriceHistoryIntervalType } from "../clob-client/clob-client.service";

interface PolymarketAuthContext {
  order: Record<string, unknown>;
  builderHeaders: Record<string, string>;
}

interface PolymarketCancelContext {
  apiKey: string;
}

const RESOLUTION_TO_PARAMS: Record<
  CandleResolution,
  { interval: PriceHistoryIntervalType; fidelity?: number }
> = {
  "1m": { interval: PriceHistoryInterval.MAX, fidelity: 1 },
  "5m": { interval: PriceHistoryInterval.MAX, fidelity: 5 },
  "15m": { interval: PriceHistoryInterval.MAX, fidelity: 15 },
  "1h": { interval: PriceHistoryInterval.ONE_HOUR },
  "1d": { interval: PriceHistoryInterval.ONE_DAY },
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
    const raw = await this.clob.getMarketPrice(outcomeId);
    return raw.price;
  }

  async getBatchPrices(
    tokenIds: string[],
  ): Promise<Array<{ tokenId: string; price: string }>> {
    const raw = await this.clob.getMarketPricesBody(tokenIds);
    return raw.map((r) => ({ tokenId: r.token_id, price: r.price }));
  }

  async getBatchMidpoints(
    tokenIds: string[],
  ): Promise<Array<{ tokenId: string; mid: string }>> {
    const raw = await this.clob.getMidpointsBody(tokenIds);
    return raw.map((r) => ({ tokenId: r.token_id, mid: r.mid }));
  }

  async getBatchSpreads(
    tokenIds: string[],
  ): Promise<Array<{ tokenId: string; spread: string }>> {
    const raw = await this.clob.getSpreads(tokenIds);
    return raw.map((r) => ({ tokenId: r.token_id, spread: r.spread }));
  }

  async getServerTime(): Promise<string> {
    const raw = await this.clob.getServerTime();
    return raw.time;
  }

  async getPriceHistory(
    outcomeId: string,
    resolution: CandleResolution,
  ): Promise<PriceCandle[]> {
    const params = RESOLUTION_TO_PARAMS[resolution];
    const result = await this.clob.getPricesHistory(
      outcomeId,
      params.interval,
      params.fidelity,
    );
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
