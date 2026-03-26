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
    ws = null;
    reconnectDelay = 1000;
    reconnectTimer = null;
    pingInterval = null;
    destroyed = false;
    authenticated = false;
    subscribedTokens = new Set();
    subscribedStrategies = new Set();
    listeners = new Set();
    // ── Listener management ─────────────────────────────────────────────
    addListener(fn) {
        this.listeners.add(fn);
    }
    removeListener(fn) {
        this.listeners.delete(fn);
    }
    emit(msg) {
        for (const fn of this.listeners) {
            try {
                fn(msg);
            }
            catch {
                /* listener errors should not break the socket */
            }
        }
    }
    // ── Connection ──────────────────────────────────────────────────────
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN ||
            this.ws?.readyState === WebSocket.CONNECTING) {
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
                const msg = JSON.parse(data);
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
            }
            catch {
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
    subscribePrices(tokenIds) {
        tokenIds.forEach((id) => this.subscribedTokens.add(id));
        if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
            this.send({ type: 'SUBSCRIBE_PRICES', tokenIds });
        }
    }
    unsubscribePrices(tokenIds) {
        tokenIds.forEach((id) => this.subscribedTokens.delete(id));
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'UNSUBSCRIBE_PRICES', tokenIds });
        }
    }
    subscribeStrategy(strategyId) {
        this.subscribedStrategies.add(strategyId);
        if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
            this.send({ type: 'SUBSCRIBE_STRATEGY', strategyId });
        }
    }
    unsubscribeStrategy(strategyId) {
        this.subscribedStrategies.delete(strategyId);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'UNSUBSCRIBE_STRATEGY', strategyId });
        }
    }
    // ── Helpers ─────────────────────────────────────────────────────────
    send(msg) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    startPing() {
        this.pingInterval = setInterval(() => this.send({ type: 'PING' }), 30_000);
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    destroy() {
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
    static isStrategyEvent(msg) {
        return STRATEGY_EVENT_TYPES.has(msg.type);
    }
    static isBacktestEvent(msg) {
        return BACKTEST_EVENT_TYPES.has(msg.type);
    }
    static isPriceUpdate(msg) {
        return msg.type === 'PRICE_UPDATE';
    }
}
// Singleton instance
export const wsManager = new WebSocketManager();
