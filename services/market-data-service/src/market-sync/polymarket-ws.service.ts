import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BaseVenueWsService } from "@polyforge/shared-types";

const SUBSCRIBE_BATCH_SIZE = 200;

export interface PriceUpdateEvent {
  tokenId: string;
  price: number;
  timestamp: number;
}

export interface BookUpdateEvent {
  tokenId: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  midpoint: string;
  spread: string;
  timestamp: number;
  minOrderSize?: string;
  tickSize?: string;
  negRisk?: boolean;
}

@Injectable()
export class PolymarketWsService
  extends BaseVenueWsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly isRealPolymarket: boolean;

  constructor(emitter: EventEmitter2) {
    const url = process.env.CLOB_WS_URL ?? "ws://localhost:3098";
    super(emitter, {
      venueId: "polymarket",
      url,
      enabled: true,
      pingIntervalMs: 9_000,
    });
    this.isRealPolymarket = url.includes("polymarket.com");
  }

  onModuleInit() {
    this.init();
  }

  onModuleDestroy() {
    this.teardown();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  subscribeTokens(tokenIds: string[]) {
    this.addSubscriptions(tokenIds);
  }

  unsubscribeTokens(tokenIds: string[]) {
    this.removeSubscriptions(tokenIds);
  }

  // ─── BaseVenueWsService hooks ─────────────────────────────────────────────

  protected handleMessage(msg: Record<string, unknown>) {
    const eventType = (msg.event_type ?? msg.type) as string | undefined;
    const ts = msg.timestamp
      ? typeof msg.timestamp === "string"
        ? Date.parse(msg.timestamp)
        : (msg.timestamp as number)
      : Date.now();

    switch (eventType) {
      case "price_change": {
        const changes = msg.price_changes as
          | Array<{ asset_id: string; price: string }>
          | undefined;
        if (Array.isArray(changes)) {
          for (const pc of changes) {
            this.emitter.emit("market-data.price", {
              tokenId: pc.asset_id,
              price: parseFloat(pc.price),
              timestamp: ts,
            } satisfies PriceUpdateEvent);
          }
        }
        break;
      }
      case "last_trade_price": {
        this.emitter.emit("market-data.price", {
          tokenId: msg.asset_id as string,
          price: parseFloat(msg.price as string),
          timestamp: ts,
        } satisfies PriceUpdateEvent);
        break;
      }
      case "book": {
        this.emitter.emit("market-data.book", {
          tokenId: msg.asset_id as string,
          bids: (msg.bids as BookUpdateEvent["bids"]) ?? [],
          asks: (msg.asks as BookUpdateEvent["asks"]) ?? [],
          midpoint: "0",
          spread: "0",
          timestamp: ts,
          ...(msg.min_order_size !== undefined && {
            minOrderSize: msg.min_order_size as string,
          }),
          ...(msg.tick_size !== undefined && {
            tickSize: msg.tick_size as string,
          }),
          ...(msg.neg_risk !== undefined && {
            negRisk: msg.neg_risk as boolean,
          }),
        } satisfies BookUpdateEvent);
        break;
      }
      case "best_bid_ask": {
        this.emitter.emit("market-data.book", {
          tokenId: msg.asset_id as string,
          bids: msg.best_bid
            ? [{ price: msg.best_bid as string, size: "0" }]
            : [],
          asks: msg.best_ask
            ? [{ price: msg.best_ask as string, size: "0" }]
            : [],
          midpoint: "0",
          spread: (msg.spread as string) ?? "0",
          timestamp: ts,
        } satisfies BookUpdateEvent);
        break;
      }
      case "PRICE_UPDATE": {
        this.emitter.emit("market-data.price", {
          tokenId: msg.tokenId as string,
          price: parseFloat(msg.price as string),
          timestamp: ts,
        } satisfies PriceUpdateEvent);
        break;
      }
      case "PRICE_SNAPSHOT": {
        if (msg.prices) {
          for (const [tokenId, price] of Object.entries(
            msg.prices as Record<string, string>,
          )) {
            this.emitter.emit("market-data.price", {
              tokenId,
              price: parseFloat(price),
              timestamp: ts,
            } satisfies PriceUpdateEvent);
          }
        }
        break;
      }
      case "BOOK_UPDATE":
      case "BOOK_SNAPSHOT": {
        this.emitter.emit("market-data.book", {
          tokenId: msg.tokenId as string,
          bids: (msg.bids as BookUpdateEvent["bids"]) ?? [],
          asks: (msg.asks as BookUpdateEvent["asks"]) ?? [],
          midpoint: (msg.midpoint as string) ?? "0",
          spread: (msg.spread as string) ?? "0",
          timestamp: ts,
        } satisfies BookUpdateEvent);
        break;
      }
    }
  }

  protected sendSubscriptions(tokenIds: string[]) {
    if (!tokenIds.length) return;

    if (this.isRealPolymarket) {
      for (let i = 0; i < tokenIds.length; i += SUBSCRIBE_BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + SUBSCRIBE_BATCH_SIZE);
        this.send({
          assets_ids: batch,
          type: "market",
          initial_dump: true,
        });
      }
      this.logger.log(
        `Subscribed to ${tokenIds.length} tokens in ${Math.ceil(tokenIds.length / SUBSCRIBE_BATCH_SIZE)} batch(es)`,
      );
    } else {
      this.send({
        action: "subscribe",
        channels: ["price", "book"],
        tokenIds,
      });
    }
  }

  protected sendUnsubscriptions(tokenIds: string[]) {
    if (this.isRealPolymarket || !tokenIds.length) return;
    this.send({
      action: "unsubscribe",
      channels: ["price", "book"],
      tokenIds,
    });
  }
}
