import type { VenueId } from "./venues";
import type { OrderBook, PriceCandle, CandleResolution } from "./markets";
import type { VenueAuthContext } from "./venue-config";

export type { OrderBook, PriceCandle, CandleResolution };

// ─── Shared value objects ─────────────────────────────────────────────────────

export interface MarketQueryParams {
  limit?: number;
  offset?: number;
  category?: string;
  active?: boolean;
}

export interface UnifiedMarket {
  venueId: VenueId;
  externalId: string;
  title: string;
  category?: string;
  endDate?: Date;
  closed: boolean;
  outcomes: string[];
}

export interface VenueOrderRequest {
  venueMarketId: string;
  venueOutcomeId: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  orderType: "GTC" | "FOK" | "GTD" | "FAK" | "POST_ONLY";
  expiration?: number;
  /** Venue-specific auth/signing context — discriminated by `venue` field */
  authContext: VenueAuthContext | Record<string, unknown>;
}

export interface VenueOrderResponse {
  venueOrderId: string;
  status: string;
  transactionHash?: string;
}

export interface VenuePosition {
  venueId: VenueId;
  venueMarketId: string;
  venueOutcomeId: string;
  outcome: string;
  size: string;
  avgPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
}

export interface VenueOrderHistory {
  venueOrderId: string;
  venueMarketId: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  status: string;
  filledAt?: Date;
}

// ─── Core interface ────────────────────────────────────────────────────────────

export interface VenueAdapter {
  readonly venueId: VenueId;
  getMarkets(params: MarketQueryParams): Promise<UnifiedMarket[]>;
  getOrderBook(outcomeId: string): Promise<OrderBook>;
  getPrice(outcomeId: string): Promise<string>;
  getPriceHistory(
    outcomeId: string,
    resolution: CandleResolution,
  ): Promise<PriceCandle[]>;
  submitOrder(order: VenueOrderRequest): Promise<VenueOrderResponse>;
  cancelOrder(
    venueOrderId: string,
    authContext: VenueAuthContext | Record<string, unknown>,
  ): Promise<void>;
  cancelAllOrders(
    authContext: VenueAuthContext | Record<string, unknown>,
  ): Promise<void>;
  getPositions(userId: string): Promise<VenuePosition[]>;
  getOrderHistory(userId: string, limit: number): Promise<VenueOrderHistory[]>;
  healthCheck(): Promise<boolean>;
}
