import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BaseVenueWsService,
  parseFiniteDecimal,
} from "@polyforge/shared-types";
import { KalshiAuthService } from "./kalshi-auth.service";
import type { KalshiCommunicationsEvent } from "./kalshi-rest.service";
import {
  KalshiRestService,
  parseKalshiTimestamp,
  parseKalshiDollars,
} from "./kalshi-rest.service";

interface PriceUpdateEvent {
  tokenId: string;
  price: number;
  timestamp: number;
}

interface OrderbookDeltaEvent {
  ticker: string;
  side: "yes" | "no";
  price: number;
  delta: number;
  seq: number;
  timestamp: number;
}

interface FillEvent {
  fill_id: string;
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  price: number;
  is_taker: boolean;
  timestamp: number;
}

interface UserOrderEvent {
  order_id: string;
  ticker: string;
  status: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  remaining_count: number;
  fill_count: number;
  timestamp: number;
}

interface MarketPositionEvent {
  ticker: string;
  position: number;
  market_exposure: number;
  realized_pnl: number;
  timestamp: number;
}

interface MarketLifecycleEvent {
  ticker: string;
  eventType: string;
  status: string;
  settlementValue: string | null;
  result: string | null;
  timestamp: number;
}

let _msgId = 1;
function nextMsgId(): number {
  return _msgId++;
}

function normalizeKalshiCentPrice(value: unknown): number | undefined {
  const cents = parseFiniteDecimal(value);
  return cents === null
    ? undefined
    : KalshiRestService.normalizeKalshiPrice(cents);
}

@Injectable()
export class KalshiWsService
  extends BaseVenueWsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly privateChannels = new Set<string>();
  private readonly orderbookSeq = new Map<string, number>();

  constructor(
    emitter: EventEmitter2,
    private readonly auth: KalshiAuthService,
    config: ConfigService,
  ) {
    const wsUrl =
      config.get<string>("KALSHI_WS_URL") ??
      "wss://demo-api.kalshi.co/trade-api/ws/v2";
    const enabled =
      (config.get<string>("KALSHI_ENABLED") ?? "false") === "true";

    super(emitter, {
      venueId: "kalshi",
      url: wsUrl,
      enabled,
      pingIntervalMs: 9_000,
    });
  }

  onModuleInit() {
    this.init();
  }

  onModuleDestroy() {
    this.teardown();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  subscribeMarkets(tickers: string[]) {
    this.addSubscriptions(tickers);
  }

  subscribeOrderbookDelta(tickers: string[]) {
    this.privateChannels.add("orderbook_delta");
    this.addSubscriptions(tickers);
    if (this.isConnected) {
      this.sendChannelSubscription("orderbook_delta", tickers);
    }
  }

  subscribeFills() {
    this.privateChannels.add("fill");
    if (this.isConnected) {
      this.sendChannelSubscription("fill");
    }
  }

  subscribeUserOrders() {
    this.privateChannels.add("user_orders");
    if (this.isConnected) {
      this.sendChannelSubscription("user_orders");
    }
  }

  subscribeMarketPositions() {
    this.privateChannels.add("market_positions");
    if (this.isConnected) {
      this.sendChannelSubscription("market_positions");
    }
  }

  subscribeCommunications(rfqIds?: string[]) {
    this.privateChannels.add("communications");
    if (this.isConnected) {
      this.sendChannelSubscription("communications", rfqIds);
    }
  }

  subscribeMarketLifecycle(tickers?: string[]) {
    this.privateChannels.add("market_lifecycle_v2");
    if (this.isConnected) {
      this.sendChannelSubscription("market_lifecycle_v2", tickers);
    }
  }

  getOrderbookSeq(ticker: string): number | undefined {
    return this.orderbookSeq.get(ticker);
  }

  // ─── BaseVenueWsService hooks ─────────────────────────────────────────────

  protected async getConnectionHeaders(): Promise<Record<string, string>> {
    const token = await this.auth.getToken("system");
    return { Authorization: `Bearer ${token}` };
  }

  protected onConnected(): void {
    for (const channel of this.privateChannels) {
      const tickers =
        channel === "orderbook_delta" ? [...this.subscriptions] : undefined;
      this.sendChannelSubscription(channel, tickers);
    }
  }

  protected handleMessage(msg: Record<string, unknown>) {
    const type = msg["type"] as string | undefined;
    const inner = msg["msg"] as Record<string, unknown> | undefined;
    if (!inner) return;

    switch (type) {
      case "ticker":
        this.handleTickerMessage(inner);
        break;
      case "orderbook_delta":
        this.handleOrderbookDeltaMessage(inner);
        break;
      case "fill":
        this.handleFillMessage(inner);
        break;
      case "user_orders":
        this.handleUserOrderMessage(inner);
        break;
      case "market_positions":
        this.handleMarketPositionMessage(inner);
        break;
      case "communications":
        this.handleCommunicationsMessage(inner);
        break;
      case "market_lifecycle_v2":
        this.handleMarketLifecycleMessage(inner);
        break;
    }
  }

  protected sendSubscriptions(tickers: string[]) {
    if (!tickers.length) return;
    this.send({
      id: nextMsgId(),
      cmd: "subscribe",
      params: {
        channels: ["ticker"],
        market_tickers: tickers,
      },
    });
    this.logger.log(`Subscribed to ${tickers.length} Kalshi ticker(s)`);
  }

  // ─── Kalshi-specific internals ────────────────────────────────────────────

  private sendChannelSubscription(channel: string, tickers?: string[]) {
    const params: Record<string, unknown> = { channels: [channel] };
    if (tickers?.length) params["market_tickers"] = tickers;
    this.send({ id: nextMsgId(), cmd: "subscribe", params });
    this.logger.log(
      `Subscribed to Kalshi channel: ${channel}${tickers ? ` (${tickers.length} tickers)` : ""}`,
    );
  }

  private handleTickerMessage(inner: Record<string, unknown>) {
    const ticker = inner["market_ticker"] as string | undefined;
    const dollarPrice = parseKalshiDollars(inner["yes_price_dollars"]);
    const centPrice = normalizeKalshiCentPrice(inner["yes_price"]);
    if (!ticker || (dollarPrice === undefined && centPrice === undefined))
      return;

    const price = dollarPrice ?? centPrice!;

    this.emitter.emit("market-data.price", {
      tokenId: ticker,
      price,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies PriceUpdateEvent);
  }

  private handleOrderbookDeltaMessage(inner: Record<string, unknown>) {
    const ticker = inner["market_ticker"] as string | undefined;
    const seq = inner["seq"] as number | undefined;
    if (!ticker || seq === undefined) return;

    const lastSeq = this.orderbookSeq.get(ticker);
    if (lastSeq !== undefined && seq !== lastSeq + 1 && seq !== 0) {
      this.logger.warn(
        `Orderbook seq gap for ${ticker}: expected ${lastSeq + 1}, got ${seq}. Snapshot needed.`,
      );
    }
    this.orderbookSeq.set(ticker, seq);

    const side = inner["side"] as "yes" | "no" | undefined;
    const dollarPrice = parseKalshiDollars(inner["price_dollars"]);
    const centPrice = normalizeKalshiCentPrice(inner["price"]);
    const delta = parseFiniteDecimal(inner["delta"]);
    if (
      !side ||
      (dollarPrice === undefined && centPrice === undefined) ||
      delta === null
    )
      return;

    const price = dollarPrice ?? centPrice!;

    this.emitter.emit("kalshi.orderbook.delta", {
      ticker,
      side,
      price,
      delta,
      seq,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies OrderbookDeltaEvent);
  }

  private handleFillMessage(inner: Record<string, unknown>) {
    const fillId = inner["fill_id"] as string | undefined;
    const orderId = inner["order_id"] as string | undefined;
    const ticker = inner["ticker"] as string | undefined;
    if (!fillId || !orderId || !ticker) return;

    const dollarPrice = parseKalshiDollars(inner["yes_price_dollars"]);
    const centPrice = normalizeKalshiCentPrice(inner["yes_price"]);
    const price = dollarPrice ?? centPrice ?? 0;

    this.emitter.emit("kalshi.fill", {
      fill_id: fillId,
      order_id: orderId,
      ticker,
      side: (inner["side"] as "yes" | "no") ?? "yes",
      action: (inner["action"] as "buy" | "sell") ?? "buy",
      count: (inner["count"] as number) ?? 0,
      price,
      is_taker: (inner["is_taker"] as boolean) ?? false,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies FillEvent);
  }

  private handleUserOrderMessage(inner: Record<string, unknown>) {
    const orderId = inner["order_id"] as string | undefined;
    const ticker = inner["ticker"] as string | undefined;
    const status = inner["status"] as string | undefined;
    if (!orderId || !ticker || !status) return;

    this.emitter.emit("kalshi.order", {
      order_id: orderId,
      ticker,
      status,
      side: (inner["side"] as "yes" | "no") ?? "yes",
      action: (inner["action"] as "buy" | "sell") ?? "buy",
      remaining_count: (inner["remaining_count"] as number) ?? 0,
      fill_count: (inner["fill_count"] as number) ?? 0,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies UserOrderEvent);
  }

  private handleMarketPositionMessage(inner: Record<string, unknown>) {
    const ticker = inner["ticker"] as string | undefined;
    if (!ticker) return;

    this.emitter.emit("kalshi.position", {
      ticker,
      position: (inner["position"] as number) ?? 0,
      market_exposure: (inner["market_exposure"] as number) ?? 0,
      realized_pnl: (inner["realized_pnl"] as number) ?? 0,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies MarketPositionEvent);
  }

  private handleCommunicationsMessage(inner: Record<string, unknown>) {
    const rfqId = inner["rfq_id"] as string | undefined;
    const type = inner["type"] as string | undefined;
    if (!rfqId || !type) return;

    const dollarPrice = parseKalshiDollars(inner["price_dollars"]);

    this.emitter.emit("kalshi.communications", {
      rfq_id: rfqId,
      type: type as KalshiCommunicationsEvent["type"],
      quote_id: (inner["quote_id"] as string) ?? undefined,
      price: dollarPrice ?? (inner["price"] as number) ?? undefined,
      count: (inner["count"] as number) ?? undefined,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies KalshiCommunicationsEvent);
  }

  private handleMarketLifecycleMessage(inner: Record<string, unknown>) {
    const ticker = inner["market_ticker"] as string | undefined;
    const eventType = inner["event_type"] as string | undefined;
    if (!ticker || !eventType) return;

    this.emitter.emit("kalshi.market.lifecycle", {
      ticker,
      eventType,
      status: (inner["status"] as string) ?? "unknown",
      settlementValue: (inner["settlement_value"] as string) ?? null,
      result: (inner["result"] as string) ?? null,
      timestamp: parseKalshiTimestamp(inner),
    } satisfies MarketLifecycleEvent);
  }
}
