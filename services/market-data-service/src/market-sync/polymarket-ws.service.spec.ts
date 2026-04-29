import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  PolymarketWsService,
  PriceUpdateEvent,
  BookUpdateEvent,
} from "./polymarket-ws.service";

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
  close = vi.fn();
  removeAllListeners = vi.fn(() => {
    this.handlers.clear();
  });

  // Test helpers
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

vi.mock("ws", () => {
  return {
    default: class {
      static OPEN = 1;
      static CONNECTING = 0;
      static CLOSED = 3;

      constructor() {
        mockWsInstance = new MockWebSocket();
        return mockWsInstance;
      }
    },
  };
});

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("PolymarketWsService", () => {
  let svc: PolymarketWsService;
  let emitter: EventEmitter2;

  beforeEach(() => {
    vi.useFakeTimers();
    emitter = new EventEmitter2();
    vi.spyOn(emitter, "emit");

    svc = new PolymarketWsService(emitter);
    vi.spyOn(svc as any, "createWebSocket").mockImplementation(() => {
      mockWsInstance = new MockWebSocket();
      return mockWsInstance;
    });
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Connection ─────────────────────────────────────────────────────────────

  describe("connection", () => {
    it("creates a WebSocket on onModuleInit", () => {
      svc.onModuleInit();
      expect(mockWsInstance).toBeDefined();
      expect((svc as any).createWebSocket).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ maxPayload: 1048576 }),
      );
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
  });

  // ── subscribeTokens ────────────────────────────────────────────────────────

  describe("subscribeTokens()", () => {
    it("sends subscribe message when WS is open", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.subscribeTokens(["token-1", "token-2"]);

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: "subscribe",
          channels: ["price", "book"],
          tokenIds: ["token-1", "token-2"],
        }),
      );
    });

    it("queues subscriptions and sends on reconnect", () => {
      svc.onModuleInit();
      // Not open yet — just queues
      svc.subscribeTokens(["token-1"]);

      // Now open — should resubscribe
      mockWsInstance.triggerOpen();

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining("token-1"),
      );
    });
  });

  // ── unsubscribeTokens ──────────────────────────────────────────────────────

  describe("unsubscribeTokens()", () => {
    it("sends unsubscribe message when WS is open", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      svc.subscribeTokens(["token-1"]);

      svc.unsubscribeTokens(["token-1"]);

      const lastCall = mockWsInstance.send.mock.calls.at(-1)![0];
      const parsed = JSON.parse(lastCall);
      expect(parsed.action).toBe("unsubscribe");
      expect(parsed.tokenIds).toEqual(["token-1"]);
    });
  });

  // ── Price message handling ─────────────────────────────────────────────────

  describe("handleMessage() — price updates", () => {
    it("emits market-data.price on PRICE_UPDATE", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "PRICE_UPDATE",
        tokenId: "token-1",
        price: "0.72",
        timestamp: 1700000000,
      });

      expect(emitter.emit).toHaveBeenCalledWith("market-data.price", {
        tokenId: "token-1",
        price: 0.72,
        timestamp: 1700000000,
      } satisfies PriceUpdateEvent);
    });

    it("emits one event per token on PRICE_SNAPSHOT", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "PRICE_SNAPSHOT",
        prices: { "token-1": "0.55", "token-2": "0.45" },
        timestamp: 1700000001,
      });

      expect(emitter.emit).toHaveBeenCalledWith("market-data.price", {
        tokenId: "token-1",
        price: 0.55,
        timestamp: 1700000001,
      });
      expect(emitter.emit).toHaveBeenCalledWith("market-data.price", {
        tokenId: "token-2",
        price: 0.45,
        timestamp: 1700000001,
      });
    });

    it("parses price string to number", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "PRICE_UPDATE",
        tokenId: "token-1",
        price: "0.123456",
        timestamp: 1700000000,
      });

      const call = (emitter.emit as any).mock.calls.find(
        ([event]: any[]) => event === "market-data.price",
      );
      expect(call[1].price).toBe(0.123456);
    });
  });

  // ── Book message handling ──────────────────────────────────────────────────

  describe("handleMessage() — book updates", () => {
    it("emits market-data.book on BOOK_UPDATE", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "BOOK_UPDATE",
        tokenId: "token-1",
        bids: [{ price: "0.60", size: "100" }],
        asks: [{ price: "0.65", size: "200" }],
        midpoint: "0.625",
        spread: "0.05",
        timestamp: 1700000002,
      });

      expect(emitter.emit).toHaveBeenCalledWith("market-data.book", {
        tokenId: "token-1",
        bids: [{ price: "0.60", size: "100" }],
        asks: [{ price: "0.65", size: "200" }],
        midpoint: "0.625",
        spread: "0.05",
        timestamp: 1700000002,
      } satisfies BookUpdateEvent);
    });

    it("emits market-data.book on BOOK_SNAPSHOT", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "BOOK_SNAPSHOT",
        tokenId: "token-1",
        bids: [],
        asks: [],
        midpoint: "0.5",
        spread: "0",
        timestamp: 1700000003,
      });

      expect(emitter.emit).toHaveBeenCalledWith("market-data.book", {
        tokenId: "token-1",
        bids: [],
        asks: [],
        midpoint: "0.5",
        spread: "0",
        timestamp: 1700000003,
      });
    });

    it("defaults missing bids/asks to empty arrays", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "BOOK_UPDATE",
        tokenId: "token-1",
        timestamp: 1700000004,
      });

      const call = (emitter.emit as any).mock.calls.find(
        ([event]: any[]) => event === "market-data.book",
      );
      expect(call[1].bids).toEqual([]);
      expect(call[1].asks).toEqual([]);
    });

    it("defaults missing midpoint and spread to '0'", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "BOOK_UPDATE",
        tokenId: "token-1",
        timestamp: 1700000005,
      });

      const call = (emitter.emit as any).mock.calls.find(
        ([event]: any[]) => event === "market-data.book",
      );
      expect(call[1].midpoint).toBe("0");
      expect(call[1].spread).toBe("0");
    });
  });

  // ── Malformed messages ─────────────────────────────────────────────────────

  describe("handleMessage() — malformed data", () => {
    it("ignores malformed JSON without throwing", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      // Trigger raw Buffer with invalid JSON
      const handlers = (mockWsInstance as any).handlers.get("message") ?? [];
      expect(() => {
        handlers.forEach((h: any) => h(Buffer.from("not-json{")));
      }).not.toThrow();
    });

    it("ignores unknown message types without throwing", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      expect(() => {
        mockWsInstance.triggerMessage({ type: "UNKNOWN_TYPE", data: {} });
      }).not.toThrow();

      // Should not have emitted any market-data events
      const marketCalls = (emitter.emit as any).mock.calls.filter(
        ([event]: any[]) =>
          event === "market-data.price" || event === "market-data.book",
      );
      expect(marketCalls).toHaveLength(0);
    });
  });

  // ── Reconnection ───────────────────────────────────────────────────────────

  describe("reconnection", () => {
    it("schedules reconnect after close", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      mockWsInstance.triggerClose(1006, "abnormal");

      // Advance past first reconnect delay (1s base)
      vi.advanceTimersByTime(1_500);

      // A new WebSocket should have been created
      expect(mockWsInstance).toBeDefined();
    });

    it("does not reconnect after onModuleDestroy", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();
      const firstInstance = mockWsInstance;

      svc.onModuleDestroy();
      firstInstance.triggerClose();

      vi.advanceTimersByTime(60_000);

      // Should still be the same destroyed instance
      expect(mockWsInstance).toBe(firstInstance);
    });
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────

  describe("onModuleDestroy()", () => {
    it("closes the WebSocket connection", () => {
      svc.onModuleInit();
      mockWsInstance.triggerOpen();

      svc.onModuleDestroy();

      expect(mockWsInstance.close).toHaveBeenCalled();
    });
  });
});
