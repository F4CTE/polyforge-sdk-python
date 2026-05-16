export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type MessageListener = (msg: WsMessage) => void;
export type WsConnectionState = ConnectionState;
type ConnectionListener = (state: ConnectionState) => void;

const STRATEGY_EVENT_TYPES = new Set([
  "STRATEGY_STARTED",
  "STRATEGY_STOPPED",
  "STRATEGY_PAUSED",
  "STRATEGY_RESUMED",
  "STRATEGY_ERROR",
]);

const BACKTEST_EVENT_TYPES = new Set([
  "BACKTEST_PROGRESS",
  "BACKTEST_COMPLETED",
  "BACKTEST_FAILED",
]);

const ORDER_EVENT_TYPES = new Set([
  "ORDER_SUBMITTED",
  "ORDER_FILLED",
  "ORDER_PARTIALLY_FILLED",
  "ORDER_CANCELLED",
  "ORDER_FAILED",
]);

const WHALE_EVENT_TYPES = new Set(["WHALE_TRADE", "WHALE_ALERT"]);

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private authenticated = false;
  private connectionState: ConnectionState = "disconnected";

  private readonly subscribedTokens = new Set<string>();
  private readonly subscribedStrategies = new Set<string>();
  private subscribedWhales = false;
  private subscribedPortfolioPnl = false;
  private readonly listeners = new Set<MessageListener>();
  private readonly connectionListeners = new Set<ConnectionListener>();

  // ── Listener management ─────────────────────────────────────────────

  addListener(fn: MessageListener): void {
    this.listeners.add(fn);
  }

  removeListener(fn: MessageListener): void {
    this.listeners.delete(fn);
  }

  addConnectionListener(fn: ConnectionListener): () => void {
    this.connectionListeners.add(fn);
    fn(this.connectionState);
    return () => this.connectionListeners.delete(fn);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    for (const fn of this.connectionListeners) {
      try {
        fn(state);
      } catch {
        /* connection listener errors should not break the socket */
      }
    }
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
    this.destroyed = false;
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.setConnectionState(
      this.connectionState === "disconnected" ? "connecting" : "reconnecting",
    );
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);
    this.authenticated = false;

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.setConnectionState("connected");
      this.emit({ type: "CONNECTION_STATE", state: "connected" });
      this.startPing();
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(String(data)) as WsMessage;
        this.emit(msg);

        if (msg.type === "AUTH_OK" && !this.authenticated) {
          this.authenticated = true;
          if (this.subscribedTokens.size > 0) {
            this.send({
              type: "SUBSCRIBE_PRICES",
              tokenIds: [...this.subscribedTokens],
            });
          }
          for (const id of this.subscribedStrategies) {
            this.send({ type: "SUBSCRIBE_STRATEGY", strategyId: id });
          }
          if (this.subscribedWhales) {
            this.send({ type: "SUBSCRIBE_WHALES" });
          }
          if (this.subscribedPortfolioPnl) {
            this.send({ type: "SUBSCRIBE_PORTFOLIO_PNL" });
          }
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopPing();
      this.authenticated = false;
      if (!this.destroyed) {
        this.setConnectionState("reconnecting");
        this.emit({
          type: "CONNECTION_STATE",
          state: "reconnecting",
          code: event.code,
          reason: event.reason || undefined,
        });
        this.reconnectTimer = setTimeout(
          () => this.connect(),
          this.reconnectDelay,
        );
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      } else {
        this.setConnectionState("disconnected");
        this.emit({
          type: "CONNECTION_STATE",
          state: "disconnected",
          code: event.code,
          reason: event.reason || undefined,
        });
      }
    };

    this.ws.onerror = () => {
      console.warn("[ws] WebSocket error — closing connection");
      this.ws?.close();
    };
  }

  // ── Subscriptions ───────────────────────────────────────────────────

  subscribePrices(tokenIds: string[]): void {
    tokenIds.forEach((id) => this.subscribedTokens.add(id));
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: "SUBSCRIBE_PRICES", tokenIds });
    }
  }

  unsubscribePrices(tokenIds: string[]): void {
    tokenIds.forEach((id) => this.subscribedTokens.delete(id));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "UNSUBSCRIBE_PRICES", tokenIds });
    }
  }

  subscribeStrategy(strategyId: string): void {
    this.subscribedStrategies.add(strategyId);
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: "SUBSCRIBE_STRATEGY", strategyId });
    }
  }

  unsubscribeStrategy(strategyId: string): void {
    this.subscribedStrategies.delete(strategyId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "UNSUBSCRIBE_STRATEGY", strategyId });
    }
  }

  subscribeWhales(): void {
    this.subscribedWhales = true;
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: "SUBSCRIBE_WHALES" });
    }
  }

  unsubscribeWhales(): void {
    this.subscribedWhales = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "UNSUBSCRIBE_WHALES" });
    }
  }

  subscribePortfolioPnl(): void {
    this.subscribedPortfolioPnl = true;
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.send({ type: "SUBSCRIBE_PORTFOLIO_PNL" });
    }
  }

  unsubscribePortfolioPnl(): void {
    this.subscribedPortfolioPnl = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "UNSUBSCRIBE_PORTFOLIO_PNL" });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => this.send({ type: "PING" }), 30_000);
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
    this.setConnectionState("disconnected");
    this.ws?.close();
    this.listeners.clear();
    this.connectionListeners.clear();
  }

  // ── Test-only hook ─────────────────────────────────────────────────
  __testFireConnectionState(state: ConnectionState): void {
    // Callers (E2E tests) already gate on window.__wsManager
    // existence, which app.tsx only exposes on localhost/DEV.
    // No guard here so the hook works in CI builds too.
    this.connectionState = state;
    for (const fn of this.connectionListeners) {
      try {
        fn(state);
      } catch {
        /* listener errors should not break the socket */
      }
    }
  }

  // ── Static helpers for filtering by event type ──────────────────────

  static isStrategyEvent(msg: WsMessage): boolean {
    return STRATEGY_EVENT_TYPES.has(msg.type);
  }

  static isBacktestEvent(msg: WsMessage): boolean {
    return BACKTEST_EVENT_TYPES.has(msg.type);
  }

  static isPriceUpdate(msg: WsMessage): boolean {
    return msg.type === "PRICE_UPDATE";
  }

  static isOrderEvent(msg: WsMessage): boolean {
    return ORDER_EVENT_TYPES.has(msg.type);
  }

  static isWhaleEvent(msg: WsMessage): boolean {
    return WHALE_EVENT_TYPES.has(msg.type);
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
