// ─────────────────────────────────────────────────────────────────────────────
// WebSocket message types
// All messages exchanged between api-service and Angular user-app
// ─────────────────────────────────────────────────────────────────────────────

export enum WsEvent {
  // Client → Server
  SUBSCRIBE_MARKET = "subscribe:market",
  UNSUBSCRIBE_MARKET = "unsubscribe:market",
  SUBSCRIBE_PORTFOLIO = "subscribe:portfolio",

  // Server → Client
  PRICE_UPDATE = "price:update",
  ORDERBOOK_UPDATE = "orderbook:update",
  ORDER_UPDATE = "order:update",
  POSITION_UPDATE = "position:update",
  STRATEGY_UPDATE = "strategy:update",
  NOTIFICATION = "notification",
  NEWS_SIGNAL = "news:signal",
  ERROR = "error",
}

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface WsSubscribeMarket {
  marketId: string;
}

export interface WsUnsubscribeMarket {
  marketId: string;
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface WsPriceUpdate {
  tokenId: string;
  price: string;
  timestamp: number;
}

export interface WsOrderBookUpdate {
  tokenId: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

export interface WsOrderUpdate {
  orderId: string;
  status: string;
  fillSize: string | null;
  fillPrice: string | null;
}

export interface WsPositionUpdate {
  tokenId: string;
  size: string;
  currentPrice: string;
  unrealizedPnl: string;
}

export interface WsStrategyUpdate {
  strategyId: string;
  status: string;
  errorMessage: string | null;
}

export interface WsNotification {
  eventType: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface WsError {
  code: string;
  message: string;
}
