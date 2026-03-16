import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;
const PING_INTERVAL_MS = 20_000;

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
}

/**
 * Maintains a persistent WebSocket connection to the CLOB feed
 * (mock-polymarket in dev, real Polymarket WS in prod).
 *
 * Emits typed events via EventEmitter2:
 *   - market-data.price  → PriceUpdateEvent
 *   - market-data.book   → BookUpdateEvent
 */
@Injectable()
export class PolymarketWsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PolymarketWsService.name);
    private ws: WebSocket | null = null;
    private reconnectDelay = RECONNECT_BASE_MS;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingTimer: NodeJS.Timeout | null = null;
    private destroyed = false;

    /** tokenIds currently subscribed to */
    private readonly subscribedTokens = new Set<string>();

    constructor(private readonly emitter: EventEmitter2) {}

    onModuleInit() {
        this.connect();
    }

    onModuleDestroy() {
        this.destroyed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.ws?.close();
        this.ws = null;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    subscribeTokens(tokenIds: string[]) {
        tokenIds.forEach(id => this.subscribedTokens.add(id));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendSubscription(tokenIds);
        }
    }

    unsubscribeTokens(tokenIds: string[]) {
        tokenIds.forEach(id => this.subscribedTokens.delete(id));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'unsubscribe',
                channels: ['price', 'book'],
                tokenIds,
            }));
        }
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    // ─── Connection management ────────────────────────────────────────────────

    private connect() {
        if (this.destroyed) return;

        const url = process.env.CLOB_WS_URL ?? 'ws://localhost:3098';
        this.logger.log(`Connecting to CLOB WebSocket: ${url}`);

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            this.logger.log('WebSocket connected');
            this.reconnectDelay = RECONNECT_BASE_MS; // reset backoff on success

            // Resubscribe all known tokens on reconnect
            if (this.subscribedTokens.size > 0) {
                this.sendSubscription([...this.subscribedTokens]);
            }

            // Keep-alive ping
            this.pingTimer = setInterval(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.ping();
                }
            }, PING_INTERVAL_MS);
        });

        this.ws.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                this.handleMessage(msg);
            } catch {
                // ignore malformed frames
            }
        });

        this.ws.on('close', (code, reason) => {
            this.logger.warn(`WebSocket closed [${code}]: ${reason.toString() || 'no reason'}`);
            this.clearTimers();
            this.scheduleReconnect();
        });

        this.ws.on('error', err => {
            this.logger.error('WebSocket error', err.message);
            // 'error' is always followed by 'close', so no need to reconnect here
        });
    }

    private handleMessage(msg: any) {
        switch (msg.type) {
            case 'PRICE_UPDATE':
            case 'PRICE_SNAPSHOT': {
                if (msg.type === 'PRICE_UPDATE') {
                    this.emitter.emit('market-data.price', {
                        tokenId: msg.tokenId,
                        price: parseFloat(msg.price),
                        timestamp: msg.timestamp,
                    } satisfies PriceUpdateEvent);
                } else if (msg.prices) {
                    // Snapshot: emit one event per token
                    for (const [tokenId, price] of Object.entries(msg.prices)) {
                        this.emitter.emit('market-data.price', {
                            tokenId,
                            price: parseFloat(price as string),
                            timestamp: msg.timestamp,
                        } satisfies PriceUpdateEvent);
                    }
                }
                break;
            }
            case 'BOOK_UPDATE':
            case 'BOOK_SNAPSHOT': {
                this.emitter.emit('market-data.book', {
                    tokenId: msg.tokenId,
                    bids: msg.bids ?? [],
                    asks: msg.asks ?? [],
                    midpoint: msg.midpoint ?? '0',
                    spread: msg.spread ?? '0',
                    timestamp: msg.timestamp,
                } satisfies BookUpdateEvent);
                break;
            }
        }
    }

    private sendSubscription(tokenIds: string[]) {
        if (!tokenIds.length) return;
        this.ws!.send(JSON.stringify({
            action: 'subscribe',
            channels: ['price', 'book'],
            tokenIds,
        }));
    }

    private scheduleReconnect() {
        if (this.destroyed) return;
        this.logger.log(`Reconnecting in ${this.reconnectDelay}ms…`);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * RECONNECT_FACTOR, RECONNECT_MAX_MS);
    }

    private clearTimers() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
}
