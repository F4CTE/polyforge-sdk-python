import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { KalshiWsService } from "./kalshi-ws.service";
import { KalshiAuthService } from "./kalshi-auth.service";

// ── Mock WebSocket ─────────────────────────────────────────────────────────────

type WsHandler = (...args: any[]) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static readonly CLOSED = 3;

  // Starts CONNECTING — only OPEN after triggerOpen()
  readyState = MockWebSocket.CONNECTING;
  private handlers = new Map<string, WsHandler[]>();

  on(event: string, handler: WsHandler) {
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

let mockWsInstance: MockWebSocket | undefined;

vi.mock("ws", () => ({
  default: class {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    constructor() {
      mockWsInstance = new MockWebSocket();
      return mockWsInstance;
    }
  },
}));

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("KalshiWsService", () => {
  let svc: KalshiWsService;
  let emitter: EventEmitter2;
  let auth: KalshiAuthService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWsInstance = undefined;
    emitter = new EventEmitter2();
    vi.spyOn(emitter, "emit");
    auth = { getToken: vi.fn().mockResolvedValue("test.jwt.token") } as any;
    const config = { get: vi.fn().mockImplementation((key: string) => {
      if (key === "KALSHI_ENABLED") return "true";
      return undefined;
    }) } as any;
    svc = new KalshiWsService(emitter, auth, config);
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Connection lifecycle ───────────────────────────────────────────────────

  describe("lifecycle", () => {
    it("creates a WebSocket on onModuleInit after auth resolves", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      expect(mockWsInstance).toBeDefined();
    });

    it("reports isConnected=true after triggerOpen", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      expect(svc.isConnected).toBe(true);
    });

    it("reports isConnected=false before triggerOpen", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      expect(svc.isConnected).toBe(false);
    });
  });

  // ── Subscription ──────────────────────────────────────────────────────────

  describe("subscribeMarkets()", () => {
    it("sends subscription frame when connected and open", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      svc.subscribeMarkets(["BTC-USD", "ETH-USD"]);
      expect(mockWsInstance!.send).toHaveBeenCalled();
      const frame = JSON.parse(mockWsInstance!.send.mock.calls[0][0] as string);
      expect(frame.cmd).toBe("subscribe");
      expect(frame.params.market_tickers).toContain("BTC-USD");
    });

    it("queues subscription and sends after open", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      // Socket exists but is still CONNECTING — send must NOT fire
      svc.subscribeMarkets(["BTC-USD"]);
      expect(mockWsInstance!.send).not.toHaveBeenCalled();

      // Now open — queued subscription flushes
      mockWsInstance!.triggerOpen();
      // subscribeMarkets only sends on open if the sub was done BEFORE connect();
      // the service re-sends in the open handler when subscribedTickers.size > 0
      expect(mockWsInstance!.send).toHaveBeenCalledTimes(1);
    });
  });

  // ── Price event emission ──────────────────────────────────────────────────

  describe("price events", () => {
    it("emits market-data.price on ticker message (yes_price)", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: {
          market_ticker: "BTC-USD",
          yes_price: 45,
          ts: 1_700_000_000_000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({
          tokenId: "BTC-USD",
          price: 0.45,
        }),
      );
    });

    it("normalizes Kalshi cent price to decimal (÷100)", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: { market_ticker: "ETH-USD", yes_price: 67, ts: 0 },
      });

      const call = (emitter.emit as ReturnType<typeof vi.fn>).mock.calls.find(
        ([event]) => event === "market-data.price",
      );
      expect(call?.[1].price).toBeCloseTo(0.67);
    });

    it("ignores malformed JSON messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      const buf = Buffer.from("not json{{{");
      const handlers = (mockWsInstance as any).handlers.get("message") ?? [];
      handlers.forEach((h: WsHandler) => h(buf));

      expect(emitter.emit).not.toHaveBeenCalledWith(
        "market-data.price",
        expect.anything(),
      );
    });

    it("ignores non-ticker message types", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({ type: "subscribed", sid: 1 });

      expect(emitter.emit).not.toHaveBeenCalledWith(
        "market-data.price",
        expect.anything(),
      );
    });
  });

  // ── Reconnection ──────────────────────────────────────────────────────────

  describe("reconnection", () => {
    it("reconnects after close — new socket is created", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      const firstInstance = mockWsInstance!;
      firstInstance.triggerOpen();

      firstInstance.triggerClose(1006, "abnormal");
      await vi.advanceTimersByTimeAsync(1100); // past 1s base reconnect delay
      await vi.runAllTimersAsync();

      // A new socket instance should have been created
      expect(mockWsInstance).not.toBe(firstInstance);
    });

    it("does NOT reconnect after onModuleDestroy", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      svc.onModuleDestroy();
      expect((svc as any).destroyed).toBe(true);
    });

    it("schedules reconnect when getToken rejects", async () => {
      auth.getToken = vi.fn().mockRejectedValue(new Error("signer down"));
      svc.onModuleInit();
      await vi.advanceTimersByTimeAsync(0); // flush microtask for rejected getToken
      // No WebSocket should have been created since auth failed
      expect(mockWsInstance).toBeUndefined();
      // After delay, reconnect should try again with recovered auth
      auth.getToken = vi.fn().mockResolvedValue("recovered-token");
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();
      expect(mockWsInstance).toBeDefined();
    });

    it("re-subscribes active tickers on the new socket after reconnect", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      const firstInstance = mockWsInstance!;
      firstInstance.triggerOpen();
      svc.subscribeMarkets(["BTC-USD"]);

      firstInstance.triggerClose(1006, "lost");
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();

      const secondInstance = mockWsInstance!;
      expect(secondInstance).not.toBe(firstInstance);

      secondInstance.triggerOpen();
      // The open handler should re-send subscriptions for all tracked tickers
      expect(secondInstance.send).toHaveBeenCalledTimes(1);
      const frame = JSON.parse(secondInstance.send.mock.calls[0][0] as string);
      expect(frame.params.market_tickers).toContain("BTC-USD");
    });
  });

  // ── Destroy cleanup ───────────────────────────────────────────────────────

  describe("onModuleDestroy()", () => {
    it("sets destroyed=true and closes the socket", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      svc.onModuleDestroy();
      expect((svc as any).destroyed).toBe(true);
      expect(mockWsInstance!.close).toHaveBeenCalled();
    });
  });
});
