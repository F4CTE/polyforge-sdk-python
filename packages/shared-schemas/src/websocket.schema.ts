import { z } from "zod";
import { UuidSchema, DecimalStringSchema } from "./common.schema";

// ─── Client → Server messages ─────────────────────────────────────────────────

export const WsAuthMessageSchema = z.object({
  type: z.literal("AUTH"),
  token: z.string().min(1),
});

export const WsSubscribePricesSchema = z.object({
  type: z.literal("SUBSCRIBE_PRICES"),
  tokenIds: z.array(z.string().min(1)).min(1).max(50),
});

export const WsUnsubscribePricesSchema = z.object({
  type: z.literal("UNSUBSCRIBE_PRICES"),
  tokenIds: z.array(z.string().min(1)).min(1),
});

export const WsSubscribeStrategySchema = z.object({
  type: z.literal("SUBSCRIBE_STRATEGY"),
  strategyId: UuidSchema,
});

export const WsUnsubscribeStrategySchema = z.object({
  type: z.literal("UNSUBSCRIBE_STRATEGY"),
  strategyId: UuidSchema,
});

export const WsPingSchema = z.object({
  type: z.literal("PING"),
});

export const WsClientMessageSchema = z.discriminatedUnion("type", [
  WsAuthMessageSchema,
  WsSubscribePricesSchema,
  WsUnsubscribePricesSchema,
  WsSubscribeStrategySchema,
  WsUnsubscribeStrategySchema,
  WsPingSchema,
]);

export type WsClientMessage = z.infer<typeof WsClientMessageSchema>;

// ─── Server → Client message types ───────────────────────────────────────────

export interface WsPriceUpdateMessage {
  type: "PRICE_UPDATE";
  tokenId: string;
  price: string;
  timestamp: number;
}

export interface WsOrderPlacedMessage {
  type: "ORDER_PLACED";
  orderId: string;
  intentId: string;
  strategyId: string | null;
  status: "PENDING";
}

export interface WsOrderFilledMessage {
  type: "ORDER_FILLED";
  orderId: string;
  filledSize: string;
  avgFillPrice: string;
  pnl: string;
}

export interface WsStrategyStartedMessage {
  type: "STRATEGY_STARTED";
  strategyId: string;
}

export interface WsStrategyStoppedMessage {
  type: "STRATEGY_STOPPED";
  strategyId: string;
  reason?: string;
}

export interface WsBacktestProgressMessage {
  type: "BACKTEST_PROGRESS";
  runId: string;
  progress: number;
}

export interface WsPriceAlertMessage {
  type: "PRICE_ALERT_TRIGGERED";
  alertId: string;
  tokenId: string;
  price: string;
  direction: "above" | "below";
}

export interface WsAuthOkMessage {
  type: "AUTH_OK";
  userId: string;
}

export interface WsAuthErrorMessage {
  type: "AUTH_ERROR";
  message: string;
}

export interface WsPongMessage {
  type: "PONG";
}
