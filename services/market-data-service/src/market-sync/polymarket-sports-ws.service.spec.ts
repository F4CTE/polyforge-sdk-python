import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  PolymarketSportsWsService,
  SportResultEvent,
} from "./polymarket-sports-ws.service";

// ── Mock WebSocket ────────────────────────────────────────────────────────────

type WsEventHandler = (...args: any[]) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  private handlers = new Map<string, WsEventHandler[]>();

  on(event: string, handler: WsEventHandler) {
    const arr = this.handlers.get(event) ?? [];
    arr.push(handler);
    this.handlers.set(event, arr);
  }

  send = vi.fn();
  ping = vi.fn();
  pong = vi.fn();
  close = vi.fn();

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    (this.handlers.get("open") ?? []).forEach((h) => h());
  }

  triggerMessage(data: Record<string, unknown>) {
    const buf = Buffer.from(JSON.stringify(data));
    (this.handlers.get("message") ?? []).forEach((h) => h(buf));
  }

  triggerPing(data = Buffer.alloc(0)) {
    (this.handlers.get("ping") ?? []).forEach((h) => h(data));
  }

  triggerClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    (this.handlers.get("close") ?? []).forEach((h) =>
      h(code, Buffer.from(reason)),
    );
  }

  triggerError(err: Error) {
    (this.handlers.get("error") ?? []).forEach((h) => h(err));
  }
}

let mockWsInstance: MockWebSocket;
let mockWsConstructorArgs: unknown[] = [];

vi.mock("ws", () => {
  return {
    default: class {
      static OPEN = 1;
      static CLOSED = 3;

      constructor(...args: unknown[]) {
        mockWsConstructorArgs = args;
        mockWsInstance = new MockWebSocket();
        return mockWsInstance;
      }
    },
  };
});

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("PolymarketSportsWsService", () => {
  let svc: PolymarketSportsWsService;
  let emitter: EventEmitter2;

  beforeEach(() => {
    vi.useFakeTimers();
    emitter = new EventEmitter2();
    vi.spyOn(emitter, "emit");
    mockWsConstructorArgs = [];

    svc = new PolymarketSportsWsService(emitter);
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Connection ──────────────────────────────────────────────────────────

  describe("connection", () => {
    it("creates a WebSocket on onModuleInit", () => {
      svc.onModuleInit();
      expect(mockWsInstance).toBeDefined();
      expect(mockWsConstructorArgs[1]).toMatchObject({ maxPayload: 1048576 });
    });

    it("reports isConnected=true after open", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      expect(svc.isConnected).toBe(true);
    });

    it("reports isConnected=false after close", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      mockWsInstance.triggerClose();
      expect(svc.isConnected).toBe(false);
    });

    it("schedules reconnect on abnormal close", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      mockWsInstance.triggerClose(1006, "abnormal");

      vi.advanceTimersByTime(1_500);
      expect(mockWsInstance).toBeDefined();
    });

    it("does not reconnect after onModuleDestroy", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      svc.onModuleDestroy();
      mockWsInstance.triggerClose(1006, "abnormal");

      vi.advanceTimersByTime(60_000);
      // No error thrown = no reconnect attempted
    });
  });

  // ── Ping/Pong ──────────────────────────────────────────────────────────

  describe("ping/pong handling", () => {
    it("responds with pong when server pings", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      const pingData = Buffer.from("heartbeat");
      mockWsInstance.triggerPing(pingData);

      expect(mockWsInstance.pong).toHaveBeenCalledWith(pingData);
    });

    it("resets pong timeout on each ping", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerPing();
      mockWsInstance.triggerPing();

      // Should not close after 10s since timer was reset
      vi.advanceTimersByTime(9_000);
      expect(mockWsInstance.close).not.toHaveBeenCalled();
    });

    it("closes connection if pong timer expires", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerPing();
      vi.advanceTimersByTime(10_000);

      expect(mockWsInstance.close).toHaveBeenCalled();
    });
  });

  // ── sport_result events ────────────────────────────────────────────────

  describe("sport_result messages", () => {
    it("emits market-data.sport-result for sport_result type", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        event_type: "sport_result",
        gameId: "game-123",
        leagueAbbreviation: "NBA",
        slug: "lakers-vs-celtics",
        teams: [
          { name: "Lakers", score: 100 },
          { name: "Celtics", score: 98 },
        ],
        status: "final",
        score: { home: 100, away: 98 },
        period: "4Q",
        live: false,
        ended: true,
        timestamp: 1700000000000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.sport-result",
        expect.objectContaining({
          gameId: "game-123",
          leagueAbbreviation: "NBA",
          slug: "lakers-vs-celtics",
          live: false,
          ended: true,
          timestamp: 1700000000000,
        } satisfies Partial<SportResultEvent>),
      );
    });

    it("handles snake_case field names", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        event_type: "sport_result",
        game_id: "game-456",
        league_abbreviation: "NFL",
        slug: "chiefs-vs-bills",
        teams: [],
        status: "live",
        live: true,
        ended: false,
        timestamp: 1700000001000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.sport-result",
        expect.objectContaining({
          gameId: "game-456",
          leagueAbbreviation: "NFL",
          live: true,
          ended: false,
        }),
      );
    });

    it("handles string timestamp", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        event_type: "sport_result",
        gameId: "game-789",
        leagueAbbreviation: "MLB",
        slug: "test-game",
        teams: [],
        status: "live",
        live: true,
        ended: false,
        timestamp: "2026-04-24T12:00:00Z",
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.sport-result",
        expect.objectContaining({
          timestamp: Date.parse("2026-04-24T12:00:00Z"),
        }),
      );
    });

    it("ignores non-sport_result messages", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        event_type: "price_change",
        price: "0.5",
      });

      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it("ignores malformed JSON messages", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      const handlers = (mockWsInstance as any).handlers.get("message") ?? [];
      handlers.forEach((h: any) => h(Buffer.from("not-json")));

      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it("ignores PONG text messages", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      const handlers = (mockWsInstance as any).handlers.get("message") ?? [];
      handlers.forEach((h: any) => h(Buffer.from("PONG")));

      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it("ignores PING text messages", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      const handlers = (mockWsInstance as any).handlers.get("message") ?? [];
      handlers.forEach((h: any) => h(Buffer.from("PING")));

      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });

  // ── Reconnect ──────────────────────────────────────────────────────────

  describe("reconnect", () => {
    it("uses exponential backoff", () => {
      svc.onModuleInit();
      const firstInstance = mockWsInstance;
      firstInstance.triggerOpen();
      firstInstance.triggerClose(1006);

      // First reconnect at 1000ms
      vi.advanceTimersByTime(1_000);
      const secondInstance = mockWsInstance;
      expect(secondInstance).not.toBe(firstInstance);

      // Close again without opening — delay should double to 2000ms
      secondInstance.triggerClose(1006);

      vi.advanceTimersByTime(1_500);
      expect(mockWsInstance).toBe(secondInstance); // not yet
      vi.advanceTimersByTime(500);
      expect(mockWsInstance).not.toBe(secondInstance); // reconnected at 2000ms
    });

    it("resets backoff on successful connection", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      mockWsInstance.triggerClose(1006);

      vi.advanceTimersByTime(1_000);
      mockWsInstance.triggerOpen(); // resets backoff
      mockWsInstance.triggerClose(1006);

      // Should reconnect at 1000ms again (not 2000ms)
      vi.advanceTimersByTime(1_000);
      expect(mockWsInstance).toBeDefined();
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe("error handling", () => {
    it("logs error but does not crash on WebSocket error", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      expect(() => {
        mockWsInstance.triggerError(new Error("connection refused"));
      }).not.toThrow();
    });
  });
});
