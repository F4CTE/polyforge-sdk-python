export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

type MessageListener = (msg: WsMessage) => void;

const STRATEGY_EVENT_TYPES = new Set([
  'STRATEGY_STARTED',
  'STRATEGY_STOPPED',
  'STRATEGY_PAUSED',
  'STRATEGY_RESUMED',
  'STRATEGY_ERROR',
]);

const BACKTEST_EVENT_TYPES = new Set([
  'BACKTEST_PROGRESS',
  'BACKTEST_COMPLETED',
  'BACKTEST_FAILED',
]);

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private authenticated = false;

  private readonly subscribedTokens = new Set<string>();
  private readonly subscribedStrategies = new Set<string>();
  private readonly listeners = new Set<MessageListener>();

  // ── Listener management ─────────────────────────────────────────────

  addListener(fn: MessageListener): void {
    this.listeners.add(fn);
  }

  removeListener(fn: MessageListener): void {
    this.listeners.delete(fn);
  }

  private emit(msg: WsMessage): void {
    for (const fn of this.listeners) {
      try {
        fn(msg);
      } catch {
        /* listener errors should not break the socket */
      }
    }
  }

  // ── Connection ──────────────────────────────────────────────────────

  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);
    this.authenticated = false;

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.startPing();
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg: WsMessage = JSON.parse(data);
        this.emit(msg);

        if (msg.type === 'AUTH_OK' && !this.authenticated) {
          this.authenticated = true;
          if (this.subscribedTokens.size > 0) {
            this.send({
              type: 'SUBSCRIBE_PRICES',
              tokenIds: [...this.subscribedTokens],
            });
          }
          for (const id of this.subscribedStrategies) {
            this.send({ type: 'SUBSCRIBE_STRATEGY', strategyId: id });
          }
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.authenticated = false;
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  // ── Subscriptions ───────────────────────────────────────────────────

  subscribePrices(tokenIds: string[]): void {
    tokenIds.forEach((id) => this.subscribedTokens.add(id));
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: 'SUBSCRIBE_PRICES', tokenIds });
    }
  }

  unsubscribePrices(tokenIds: string[]): void {
    tokenIds.forEach((id) => this.subscribedTokens.delete(id));
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

  // ── Helpers ─────────────────────────────────────────────────────────

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => this.send({ type: 'PING' }), 30_000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    this.ws?.close();
    this.listeners.clear();
  }

  // ── Static helpers for filtering by event type ──────────────────────

  static isStrategyEvent(msg: WsMessage): boolean {
    return STRATEGY_EVENT_TYPES.has(msg.type);
  }

  static isBacktestEvent(msg: WsMessage): boolean {
    return BACKTEST_EVENT_TYPES.has(msg.type);
  }

  static isPriceUpdate(msg: WsMessage): boolean {
    return msg.type === 'PRICE_UPDATE';
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
