import { Logger } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import WebSocket from "ws";

// ─── Configuration ───────────────────────────────────────────────────────────

export interface VenueWsConfig {
  venueId: string;
  url: string;
  enabled: boolean;
  pingIntervalMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  reconnectFactor?: number;
  headers?: Record<string, string>;
}

const DEFAULT_PING_MS = 9_000;
const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const DEFAULT_RECONNECT_FACTOR = 2;

// ─── Base Class ──────────────────────────────────────────────────────────────

export abstract class BaseVenueWsService {
  protected readonly logger: Logger;
  protected ws: WebSocket | null = null;
  protected destroyed = false;
  private reconnectDelay: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private readonly pingIntervalMs: number;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly reconnectFactor: number;

  protected readonly subscriptions = new Set<string>();

  constructor(
    protected readonly emitter: EventEmitter2,
    protected readonly wsConfig: VenueWsConfig,
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
    this.pingIntervalMs = wsConfig.pingIntervalMs ?? DEFAULT_PING_MS;
    this.reconnectBaseMs =
      wsConfig.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    this.reconnectMaxMs = wsConfig.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;
    this.reconnectFactor = wsConfig.reconnectFactor ?? DEFAULT_RECONNECT_FACTOR;
    this.reconnectDelay = this.reconnectBaseMs;
  }

  // ─── Lifecycle (call from NestJS hooks) ──────────────────────────────────

  init(): void {
    if (!this.wsConfig.enabled) {
      this.logger.log(
        `${this.wsConfig.venueId} WS disabled — skipping connection`,
      );
      return;
    }
    this.startConnection();
  }

  teardown(): void {
    this.destroyed = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Subscription management ─────────────────────────────────────────────

  addSubscriptions(ids: string[]): void {
    ids.forEach((id) => this.subscriptions.add(id));
    if (this.isConnected) {
      this.sendSubscriptions(ids);
    }
  }

  removeSubscriptions(ids: string[]): void {
    ids.forEach((id) => this.subscriptions.delete(id));
    if (this.isConnected) {
      this.sendUnsubscriptions(ids);
    }
  }

  // ─── Subclass hooks ──────────────────────────────────────────────────────

  protected abstract handleMessage(data: Record<string, unknown>): void;

  protected abstract sendSubscriptions(ids: string[]): void;

  protected sendUnsubscriptions(_ids: string[]): void {
    // Default no-op — override if venue supports unsubscribe
  }

  protected getConnectionHeaders():
    | Record<string, string>
    | Promise<Record<string, string>> {
    return this.wsConfig.headers ?? {};
  }

  protected onConnected(): void {
    // Override for post-connect setup (e.g., resubscribe channels)
  }

  protected createWebSocket(
    url: string,
    opts?: { headers: Record<string, string> },
  ): WebSocket {
    return opts ? new WebSocket(url, opts) : new WebSocket(url);
  }

  // ─── Connection internals ────────────────────────────────────────────────

  private startConnection(): void {
    const headersResult = this.getConnectionHeaders();

    if (headersResult instanceof Promise) {
      void headersResult
        .then((headers) => this.connectWithHeaders(headers))
        .catch((err) => {
          this.logger.error("Failed to build connection headers", String(err));
          this.scheduleReconnect();
        });
    } else {
      this.connectWithHeaders(headersResult);
    }
  }

  private connectWithHeaders(headers: Record<string, string>): void {
    if (this.destroyed) return;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.clearTimers();

    const url = this.wsConfig.url;
    this.logger.log(`Connecting to ${this.wsConfig.venueId} WebSocket: ${url}`);

    const opts = Object.keys(headers).length > 0 ? { headers } : undefined;
    this.ws = this.createWebSocket(url, opts);

    this.ws.on("open", () => {
      this.logger.log(`${this.wsConfig.venueId} WebSocket connected`);
      this.reconnectDelay = this.reconnectBaseMs;
      this.startPing();
      this.onConnected();

      if (this.subscriptions.size > 0) {
        this.sendSubscriptions([...this.subscriptions]);
      }
    });

    this.ws.on("message", (raw: any) => {
      const text = raw.toString();
      if (text === "PONG") return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(text) as Record<string, unknown>;
      } catch {
        this.logger.warn(
          `${this.wsConfig.venueId} WS: unparseable frame (${text.length} bytes)`,
        );
        return;
      }
      try {
        this.handleMessage(msg);
      } catch (err) {
        this.logger.error(
          `${this.wsConfig.venueId} WS: handleMessage threw`,
          String(err),
        );
      }
    });

    this.ws.on("close", (code: any, reason: any) => {
      this.logger.warn(
        `${this.wsConfig.venueId} WebSocket closed [${code}]: ${String(reason) || "no reason"}`,
      );
      this.clearTimers();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err: any) => {
      this.logger.error(
        `${this.wsConfig.venueId} WebSocket error`,
        err.message,
      );
      this.ws?.close();
    });
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.pingIntervalMs);
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.logger.log(
      `${this.wsConfig.venueId} WS reconnecting in ${this.reconnectDelay}ms…`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.startConnection();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * this.reconnectFactor,
      this.reconnectMaxMs,
    );
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  protected send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
