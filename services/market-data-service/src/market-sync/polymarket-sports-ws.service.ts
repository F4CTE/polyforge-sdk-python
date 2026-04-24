import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import WebSocket from "ws";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;
const PONG_TIMEOUT_MS = 10_000;

export interface SportResultEvent {
  gameId: string;
  leagueAbbreviation: string;
  slug: string;
  teams: Array<{ name: string; abbreviation?: string; score?: number }>;
  status: string;
  score?: { home: number; away: number };
  period?: string;
  live: boolean;
  ended: boolean;
  timestamp: number;
}

@Injectable()
export class PolymarketSportsWsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PolymarketSportsWsService.name);
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(private readonly emitter: EventEmitter2) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Connection management ────────────────────────────────────────────────

  private connect() {
    if (this.destroyed) return;

    const url =
      process.env.SPORTS_WS_URL ?? "wss://sports-api.polymarket.com/ws";
    this.logger.log(`Connecting to Sports WebSocket: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.logger.log("Sports WebSocket connected");
      this.reconnectDelay = RECONNECT_BASE_MS;
    });

    this.ws.on("ping", (data: Buffer) => {
      this.resetPongTimer();
      this.ws?.pong(data);
    });

    this.ws.on("message", (data: Buffer) => {
      const text = data.toString();
      if (text === "PONG" || text === "PING") return;

      try {
        const msg = JSON.parse(text);
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    });

    this.ws.on("close", (code, reason) => {
      this.logger.warn(
        `Sports WebSocket closed [${code}]: ${reason.toString() || "no reason"}`,
      );
      this.clearTimers();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.logger.error("Sports WebSocket error", err.message);
    });
  }

  private handleMessage(msg: Record<string, unknown>) {
    const eventType = (msg.event_type ?? msg.type) as string | undefined;
    if (eventType !== "sport_result") return;

    const ts =
      typeof msg.timestamp === "number"
        ? msg.timestamp
        : typeof msg.timestamp === "string"
          ? Date.parse(msg.timestamp)
          : Date.now();

    this.emitter.emit("market-data.sport-result", {
      gameId: (msg.gameId ?? msg.game_id ?? "") as string,
      leagueAbbreviation: (msg.leagueAbbreviation ??
        msg.league_abbreviation ??
        "") as string,
      slug: (msg.slug as string) ?? "",
      teams: (msg.teams as SportResultEvent["teams"]) ?? [],
      status: (msg.status as string) ?? "",
      score: msg.score as SportResultEvent["score"],
      period: msg.period as string | undefined,
      live: Boolean(msg.live),
      ended: Boolean(msg.ended),
      timestamp: ts,
    } satisfies SportResultEvent);
  }

  private resetPongTimer() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      this.logger.warn("Pong timeout — forcing reconnect");
      this.ws?.close();
    }, PONG_TIMEOUT_MS);
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.logger.log(`Reconnecting in ${this.reconnectDelay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_FACTOR,
      RECONNECT_MAX_MS,
    );
  }

  private clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}
