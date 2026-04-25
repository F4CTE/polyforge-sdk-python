// ─────────────────────────────────────────────────────────────────────────────
// Market types
// ─────────────────────────────────────────────────────────────────────────────

export interface Market {
  id: string;
  question: string;
  description: string;
  slug: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  resolvedAt: string | null;
  endDate: string | null;
  volume: string; // USDC — always string, never float
  liquidity: string; // USDC
  image: string | null;
  tokens: Token[];
  seriesId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Token {
  id: string;
  marketId: string;
  outcome: string; // "YES" | "NO" or any custom outcome like "Trump", "Biden", etc.
  price: string; // 0.00 – 1.00 — always string
  winner: boolean;
}

export interface PriceData {
  tokenId: string;
  price: string;
  timestamp: number;
  source: "ws" | "rest";
}

export interface OrderBook {
  tokenId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  updatedAt: number;
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface PriceCandle {
  bucket: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

export type CandleResolution = "1m" | "5m" | "15m" | "1h" | "1d";

// ─── Kalshi combo/multivariate market types ───────────────────────────────────
// Note: snake_case fields reflect the raw Kalshi REST API JSON — intentionally
// separate from the camelCase sports.ts ComboCollection (ORM-layer model).

export interface KalshiComboCollection {
  collection_ticker: string;
  title: string;
  category: string;
  status: "active" | "settled" | "expired" | string;
  markets_count: number;
  series_ticker?: string;
}

export interface KalshiComboLookupResult {
  event_ticker: string;
  market_ticker: string;
}
