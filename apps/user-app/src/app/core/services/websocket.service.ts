import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface PriceUpdate {
  type: 'PRICE_UPDATE';
  tokenId: string;
  price: string;
  timestamp: number;
}

export interface StrategyEvent {
  type: 'STRATEGY_STARTED' | 'STRATEGY_STOPPED' | 'STRATEGY_PAUSED' | 'STRATEGY_RESUMED' | 'STRATEGY_ERROR';
  strategyId: string;
  reason?: string;
  error?: string;
  blockType?: string;
}

export interface BacktestEvent {
  type: 'BACKTEST_PROGRESS' | 'BACKTEST_COMPLETED' | 'BACKTEST_FAILED';
  runId: string;
  progress?: number;
  winRate?: string;
  totalPnl?: string;
  totalOrders?: number;
  filledOrders?: number;
  hasDataGaps?: boolean;
  error?: string;
}

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

const STRATEGY_EVENT_TYPES = new Set([
  'STRATEGY_STARTED', 'STRATEGY_STOPPED', 'STRATEGY_PAUSED', 'STRATEGY_RESUMED', 'STRATEGY_ERROR',
]);

const BACKTEST_EVENT_TYPES = new Set([
  'BACKTEST_PROGRESS', 'BACKTEST_COMPLETED', 'BACKTEST_FAILED',
]);

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  // Track whether the server acknowledged auth so we can send queued subscriptions
  private authenticated = false;

  private readonly subscribedTokens     = new Set<string>();
  private readonly subscribedStrategies = new Set<string>();

  private readonly messages$ = new Subject<WsMessage>();

  readonly priceUpdates$: Observable<PriceUpdate> = this.messages$.pipe(
    filter(m => m['type'] === 'PRICE_UPDATE'),
    map(m => m as unknown as PriceUpdate),
  );

  readonly strategyEvents$: Observable<StrategyEvent> = this.messages$.pipe(
    filter(m => STRATEGY_EVENT_TYPES.has(m['type'] as string)),
    map(m => m as unknown as StrategyEvent),
  );

  readonly backtestEvents$: Observable<BacktestEvent> = this.messages$.pipe(
    filter(m => BACKTEST_EVENT_TYPES.has(m['type'] as string)),
    map(m => m as unknown as BacktestEvent),
  );

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);
    this.authenticated = false;

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      // Cookie is sent automatically in the HTTP upgrade request —
      // the server will reply AUTH_OK immediately if the cookie is valid.
      // No explicit AUTH message needed for browser clients.
      this.startPing();
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg: WsMessage = JSON.parse(data);
        this.messages$.next(msg);

        // When the server confirms auth (either from cookie or explicit AUTH message),
        // flush any pending subscriptions.
        if (msg['type'] === 'AUTH_OK' && !this.authenticated) {
          this.authenticated = true;
          if (this.subscribedTokens.size > 0) {
            this.send({ type: 'SUBSCRIBE_PRICES', tokenIds: [...this.subscribedTokens] });
          }
          for (const id of this.subscribedStrategies) {
            this.send({ type: 'SUBSCRIBE_STRATEGY', strategyId: id });
          }
        }
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.authenticated = false;
      if (!this.destroyed) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  subscribePrices(tokenIds: string[]): void {
    tokenIds.forEach(id => this.subscribedTokens.add(id));
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: 'SUBSCRIBE_PRICES', tokenIds });
    }
  }

  unsubscribePrices(tokenIds: string[]): void {
    tokenIds.forEach(id => this.subscribedTokens.delete(id));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'UNSUBSCRIBE_PRICES', tokenIds });
    }
  }

  subscribeStrategy(strategyId: string): void {
    this.subscribedStrategies.add(strategyId);
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: 'SUBSCRIBE_STRATEGY', strategyId });
    }
  }

  unsubscribeStrategy(strategyId: string): void {
    this.subscribedStrategies.delete(strategyId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'UNSUBSCRIBE_STRATEGY', strategyId });
    }
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => this.send({ type: 'PING' }), 30_000);
  }

  private stopPing(): void {
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPing();
    this.ws?.close();
  }
}
