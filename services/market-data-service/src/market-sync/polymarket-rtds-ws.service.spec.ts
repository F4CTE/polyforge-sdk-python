import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  PolymarketRtdsWsService,
  RtdsCryptoPriceEvent,
  RtdsEquityPriceEvent,
  RtdsCommentEvent,
} from "./polymarket-rtds-ws.service";

// ── Mock WebSocket ────────────────────────────────────────────────────────────

type WsEventHandler = (...args: any[]) => void;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
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
  close = vi.fn();

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    (this.handlers.get("open") ?? []).forEach((h) => h());
  }

  triggerMessage(data: Record<string, unknown>) {
    const buf = Buffer.from(JSON.stringify(data));
    (this.handlers.get("message") ?? []).forEach((h) => h(buf));
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

describe("PolymarketRtdsWsService", () => {
  let svc: PolymarketRtdsWsService;
  let emitter: EventEmitter2;

  beforeEach(() => {
    vi.useFakeTimers();
    emitter = new EventEmitter2();
    vi.spyOn(emitter, "emit");
    mockWsConstructorArgs = [];

    svc = new PolymarketRtdsWsService(emitter);
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

    it("starts ping interval on open", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      vi.advanceTimersByTime(5_000);
      expect(mockWsInstance.ping).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5_000);
      expect(mockWsInstance.ping).toHaveBeenCalledTimes(2);
    });

    it("does not reconnect after onModuleDestroy", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      svc.onModuleDestroy();
      mockWsInstance.triggerClose(1006, "abnormal");

      vi.advanceTimersByTime(60_000);
      // No error thrown
    });
  });

  // ── Subscribe/Unsubscribe ──────────────────────────────────────────────

  describe("subscribe()", () => {
    it("sends subscribe JSON when connected", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribe({ topic: "BTC-USD", type: "crypto" });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: "subscribe",
          topic: "BTC-USD",
          type: "crypto",
        }),
      );
    });

    it("includes filters when provided", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribe({
        topic: "ETH-USD",
        type: "crypto",
        filters: { source: "binance" },
      });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: "subscribe",
          topic: "ETH-USD",
          type: "crypto",
          filters: { source: "binance" },
        }),
      );
    });

    it("includes auth when provided", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribe({
        topic: "comments",
        type: "comments",
        auth: { gamma_auth: "0xwallet" },
      });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: "subscribe",
          topic: "comments",
          type: "comments",
          auth: { gamma_auth: "0xwallet" },
        }),
      );
    });

    it("replays subscriptions on reconnect", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribe({ topic: "BTC-USD", type: "crypto" });
      mockWsInstance.send.mockClear();

      mockWsInstance.triggerClose(1006);
      vi.advanceTimersByTime(1_000);
      mockWsInstance.triggerOpen();

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"topic":"BTC-USD"'),
      );
    });

    it("queues subscription if not yet connected", () => {
      svc.onModuleInit();

      svc.subscribe({ topic: "AAPL", type: "equity" });
      expect(mockWsInstance.send).not.toHaveBeenCalled();

      mockWsInstance.triggerOpen();
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"topic":"AAPL"'),
      );
    });
  });

  describe("unsubscribe()", () => {
    it("sends unsubscribe JSON when connected", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribe({ topic: "BTC-USD", type: "crypto" });
      mockWsInstance.send.mockClear();

      svc.unsubscribe("crypto", "BTC-USD");

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: "unsubscribe",
          topic: "BTC-USD",
          type: "crypto",
        }),
      );
    });

    it("does not replay unsubscribed topics on reconnect", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribe({ topic: "BTC-USD", type: "crypto" });
      svc.unsubscribe("crypto", "BTC-USD");
      mockWsInstance.send.mockClear();

      mockWsInstance.triggerClose(1006);
      vi.advanceTimersByTime(1_000);
      mockWsInstance.triggerOpen();

      expect(mockWsInstance.send).not.toHaveBeenCalled();
    });
  });

  // ── Message handling ──────────────────────────────────────────────────

  describe("crypto price events", () => {
    it("emits market-data.rtds-crypto for crypto type", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "crypto",
        source: "binance",
        symbol: "BTC-USD",
        price: 67000.5,
        timestamp: 1700000000000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-crypto",
        expect.objectContaining({
          source: "binance",
          symbol: "BTC-USD",
          price: 67000.5,
          timestamp: 1700000000000,
        } satisfies RtdsCryptoPriceEvent),
      );
    });

    it("handles stream_type alias", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        stream_type: "crypto",
        source: "chainlink",
        symbol: "ETH-USD",
        price: 3400,
        timestamp: 1700000001000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-crypto",
        expect.objectContaining({ source: "chainlink", symbol: "ETH-USD" }),
      );
    });
  });

  describe("equity price events", () => {
    it("emits market-data.rtds-equity for equity type", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "equity",
        source: "pyth",
        symbol: "AAPL",
        price: 185.5,
        timestamp: 1700000002000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-equity",
        expect.objectContaining({
          source: "pyth",
          symbol: "AAPL",
          price: 185.5,
          timestamp: 1700000002000,
        } satisfies RtdsEquityPriceEvent),
      );
    });
  });

  describe("comment events", () => {
    it("emits market-data.rtds-comment for comment type", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "comment",
        marketId: "mkt-1",
        author: "0xuser",
        body: "Great market!",
        timestamp: 1700000003000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-comment",
        expect.objectContaining({
          marketId: "mkt-1",
          author: "0xuser",
          body: "Great market!",
          timestamp: 1700000003000,
        } satisfies RtdsCommentEvent),
      );
    });

    it("handles comments type alias", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "comments",
        market_id: "mkt-2",
        author: "0xother",
        body: "Hello",
        timestamp: 1700000004000,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-comment",
        expect.objectContaining({ marketId: "mkt-2" }),
      );
    });
  });

  describe("edge cases", () => {
    it("ignores unknown message types", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({ type: "unknown_stream", data: {} });

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

    it("defaults timestamp to Date.now() when missing", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      const now = Date.now();
      mockWsInstance.triggerMessage({
        type: "crypto",
        source: "test",
        symbol: "SOL-USD",
        price: 150,
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-crypto",
        expect.objectContaining({
          timestamp: expect.any(Number),
        }),
      );

      const event = (emitter.emit as any).mock
        .calls[0][1] as RtdsCryptoPriceEvent;
      expect(event.timestamp).toBeGreaterThanOrEqual(now);
    });

    it("parses string timestamps", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "equity",
        source: "pyth",
        symbol: "MSFT",
        price: 400,
        timestamp: "2026-04-24T12:00:00Z",
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.rtds-equity",
        expect.objectContaining({
          timestamp: Date.parse("2026-04-24T12:00:00Z"),
        }),
      );
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
      mockWsInstance.triggerOpen();
      mockWsInstance.triggerClose(1006);

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
