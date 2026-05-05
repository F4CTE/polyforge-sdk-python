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

  triggerRawMessage(raw: string) {
    const buf = Buffer.from(raw);
    (this.handlers.get("message") ?? []).forEach((h) => h(buf));
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
    const config = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === "KALSHI_ENABLED") return "true";
        return undefined;
      }),
    } as any;
    svc = new KalshiWsService(emitter, auth, config);
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

  // ── Phase 5b: ts_ms migration ──────────────────────────────────────────

  describe("ts_ms migration", () => {
    it("prefers ts_ms over ts for ticker messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: {
          market_ticker: "BTC-USD",
          yes_price: 45,
          ts_ms: 1700000000123,
          ts: 1700000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({ timestamp: 1700000000123 }),
      );
    });

    it("falls back to ts*1000 when ts_ms is absent", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: { market_ticker: "BTC-USD", yes_price: 45, ts: 1700000000 },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({ timestamp: 1700000000000 }),
      );
    });

    it("uses Date.now() when neither ts_ms nor ts is present", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      vi.setSystemTime(1700099999000);
      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: { market_ticker: "BTC-USD", yes_price: 45 },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({ timestamp: 1700099999000 }),
      );
    });

    it("uses ts_ms for orderbook_delta messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "orderbook_delta",
        msg: {
          market_ticker: "BTC-USD",
          side: "yes",
          price: 45,
          delta: 10,
          seq: 1,
          ts_ms: 1700000000555,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.orderbook.delta",
        expect.objectContaining({ timestamp: 1700000000555 }),
      );
    });

    it("uses ts_ms for fill messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "fill",
        msg: {
          fill_id: "f-ts",
          order_id: "o-ts",
          ticker: "BTC-USD",
          yes_price: 45,
          ts_ms: 1700000000777,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.fill",
        expect.objectContaining({ timestamp: 1700000000777 }),
      );
    });
  });

  // ── Phase 5b: _dollars field migration ────────────────────────────────────

  describe("_dollars field migration", () => {
    it("prefers yes_price_dollars over yes_price for ticker messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: {
          market_ticker: "BTC-USD",
          yes_price_dollars: "0.4567",
          yes_price: 45,
          ts_ms: 1700000000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({ price: 0.4567 }),
      );
    });

    it("falls back to yes_price when yes_price_dollars is non-finite", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: {
          market_ticker: "BTC-USD",
          yes_price_dollars: "Infinity",
          yes_price: 45,
          ts_ms: 1700000000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({ price: 0.45 }),
      );
    });

    it("falls back to yes_price cents when yes_price_dollars is absent", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: {
          market_ticker: "BTC-USD",
          yes_price: 45,
          ts_ms: 1700000000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({ price: 0.45 }),
      );
    });

    it("prefers price_dollars for orderbook_delta", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "orderbook_delta",
        msg: {
          market_ticker: "BTC-USD",
          side: "yes",
          price_dollars: "0.4500",
          price: 45,
          delta: 10,
          seq: 1,
          ts_ms: 1700000000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.orderbook.delta",
        expect.objectContaining({ price: 0.45 }),
      );
    });

    it("prefers yes_price_dollars for fill messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "fill",
        msg: {
          fill_id: "f-d",
          order_id: "o-d",
          ticker: "BTC-USD",
          yes_price_dollars: "0.4567",
          yes_price: 45,
          ts_ms: 1700000000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.fill",
        expect.objectContaining({ price: 0.4567 }),
      );
    });

    it("prefers price_dollars for communications messages", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "communications",
        msg: {
          rfq_id: "rfq-d",
          type: "quote_received",
          price_dollars: "0.5500",
          price: 55,
          ts_ms: 1700000000000,
        },
      });

      const commCall = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.communications",
      );
      expect(commCall).toBeDefined();
      expect(commCall![1]).toMatchObject({ price: 0.55 });
    });
  });

  // ── Phase 3: orderbook_delta channel ────────────────────────────────────

  describe("orderbook_delta channel", () => {
    it("emits kalshi.orderbook.delta on orderbook_delta message", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "orderbook_delta",
        msg: {
          market_ticker: "BTC-USD",
          side: "yes",
          price: 45,
          delta: 10,
          seq: 1,
          ts: 1700000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.orderbook.delta",
        expect.objectContaining({
          ticker: "BTC-USD",
          side: "yes",
          price: 0.45,
          delta: 10,
          seq: 1,
        }),
      );
    });

    it("tracks seq numbers and detects gaps", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "orderbook_delta",
        msg: {
          market_ticker: "BTC",
          side: "yes",
          price: 50,
          delta: 1,
          seq: 1,
          ts: 0,
        },
      });
      expect(svc.getOrderbookSeq("BTC")).toBe(1);

      mockWsInstance!.triggerMessage({
        type: "orderbook_delta",
        msg: {
          market_ticker: "BTC",
          side: "yes",
          price: 50,
          delta: 1,
          seq: 3,
          ts: 0,
        },
      });
      expect(svc.getOrderbookSeq("BTC")).toBe(3);
    });

    it("sends subscription for orderbook_delta channel", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      svc.subscribeOrderbookDelta(["BTC-USD"]);
      const frame = JSON.parse(
        mockWsInstance!.send.mock.calls[
          mockWsInstance!.send.mock.calls.length - 1
        ][0] as string,
      );
      expect(frame.params.channels).toContain("orderbook_delta");
      expect(frame.params.market_tickers).toContain("BTC-USD");
    });
  });

  // ── Phase 3: fill channel ─────────────────────────────────────────────────

  describe("fill channel", () => {
    it("emits kalshi.fill on fill message", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "fill",
        msg: {
          fill_id: "f-1",
          order_id: "ord-1",
          ticker: "BTC-USD",
          side: "yes",
          action: "buy",
          count: 5,
          yes_price: 45,
          is_taker: true,
          ts: 1700000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.fill",
        expect.objectContaining({
          fill_id: "f-1",
          order_id: "ord-1",
          ticker: "BTC-USD",
          price: 0.45,
          is_taker: true,
        }),
      );
    });

    it("subscribes to fill channel", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      svc.subscribeFills();
      const frame = JSON.parse(
        mockWsInstance!.send.mock.calls[
          mockWsInstance!.send.mock.calls.length - 1
        ][0] as string,
      );
      expect(frame.params.channels).toContain("fill");
    });
  });

  // ── Phase 3: user_orders channel ──────────────────────────────────────────

  describe("user_orders channel", () => {
    it("emits kalshi.order on user_orders message", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "user_orders",
        msg: {
          order_id: "ord-1",
          ticker: "BTC-USD",
          status: "executed",
          side: "yes",
          action: "buy",
          remaining_count: 0,
          fill_count: 10,
          ts: 1700000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.order",
        expect.objectContaining({
          order_id: "ord-1",
          status: "executed",
          fill_count: 10,
        }),
      );
    });

    it("subscribes to user_orders channel", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      svc.subscribeUserOrders();
      const frame = JSON.parse(
        mockWsInstance!.send.mock.calls[
          mockWsInstance!.send.mock.calls.length - 1
        ][0] as string,
      );
      expect(frame.params.channels).toContain("user_orders");
    });
  });

  // ── Phase 3: market_positions channel ─────────────────────────────────────

  describe("market_positions channel", () => {
    it("emits kalshi.position on market_positions message", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "market_positions",
        msg: {
          ticker: "BTC-USD",
          position: 25,
          market_exposure: 1000,
          realized_pnl: 150,
          ts: 1700000000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "kalshi.position",
        expect.objectContaining({
          ticker: "BTC-USD",
          position: 25,
          market_exposure: 1000,
          realized_pnl: 150,
        }),
      );
    });

    it("subscribes to market_positions channel", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      svc.subscribeMarketPositions();
      const frame = JSON.parse(
        mockWsInstance!.send.mock.calls[
          mockWsInstance!.send.mock.calls.length - 1
        ][0] as string,
      );
      expect(frame.params.channels).toContain("market_positions");
    });
  });

  // ── Phase 3: private channel reconnection ─────────────────────────────────

  describe("private channel reconnection", () => {
    it("re-subscribes private channels on reconnect", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      const firstInstance = mockWsInstance!;
      firstInstance.triggerOpen();

      svc.subscribeFills();
      svc.subscribeUserOrders();

      firstInstance.triggerClose(1006, "lost");
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();

      const secondInstance = mockWsInstance!;
      secondInstance.triggerOpen();

      const calls = secondInstance.send.mock.calls.map((c: unknown[]) =>
        JSON.parse(c[0] as string),
      );
      const channels = calls.flatMap(
        (f: { params?: { channels?: string[] } }) => f.params?.channels ?? [],
      );
      expect(channels).toContain("fill");
      expect(channels).toContain("user_orders");
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

  // ── Phase 4: Communications channel ──────────────────────────────────────

  describe("subscribeCommunications()", () => {
    it("sends channel subscription when socket is open", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      svc.subscribeCommunications(["rfq-1"]);
      const calls = mockWsInstance!.send.mock.calls;
      const frame = JSON.parse(calls[calls.length - 1][0] as string);
      expect(frame.cmd).toBe("subscribe");
      expect(frame.params.channels).toContain("communications");
      expect(frame.params.market_tickers).toContain("rfq-1");
    });

    it("queues subscription if socket not yet open", async () => {
      svc.subscribeCommunications();
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      const calls = mockWsInstance!.send.mock.calls;
      const commFrame = calls.find((c: any) => {
        const f = JSON.parse(c[0] as string);
        return f.params.channels?.includes("communications");
      });
      expect(commFrame).toBeDefined();
    });

    it("emits kalshi.communications event on communications message", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      svc.subscribeCommunications();

      mockWsInstance!.triggerMessage({
        type: "communications",
        msg: {
          rfq_id: "rfq-1",
          type: "quote_received",
          quote_id: "q-1",
          price: 50,
          count: 100,
          ts: 1700000000,
        },
      });

      const commCall = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.communications",
      );
      expect(commCall).toBeDefined();
      expect(commCall![1]).toMatchObject({
        rfq_id: "rfq-1",
        type: "quote_received",
        quote_id: "q-1",
        price: 50,
        count: 100,
        timestamp: 1700000000000,
      });
    });

    it("skips communications messages with missing rfq_id", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "communications",
        msg: { type: "quote_received" },
      });

      const commCall = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.communications",
      );
      expect(commCall).toBeUndefined();
    });
  });

  // ── Market lifecycle v2 channel ────────────────────────────────────────────

  describe("subscribeMarketLifecycle()", () => {
    it("sends channel subscription when socket is open", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      svc.subscribeMarketLifecycle(["BTC-USD"]);
      const calls = mockWsInstance!.send.mock.calls;
      const frame = JSON.parse(calls[calls.length - 1][0] as string);
      expect(frame.cmd).toBe("subscribe");
      expect(frame.params.channels).toContain("market_lifecycle_v2");
      expect(frame.params.market_tickers).toContain("BTC-USD");
    });

    it("queues subscription if socket not yet open", async () => {
      svc.subscribeMarketLifecycle();
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();
      const calls = mockWsInstance!.send.mock.calls;
      const lifecycleFrame = calls.find((c: any) => {
        const f = JSON.parse(c[0] as string);
        return f.params.channels?.includes("market_lifecycle_v2");
      });
      expect(lifecycleFrame).toBeDefined();
    });

    it("emits kalshi.market.lifecycle on market_determined event", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "market_lifecycle_v2",
        msg: {
          market_ticker: "PRES-2028",
          event_type: "market_determined",
          status: "settled",
          settlement_value: "yes",
          result: "Yes",
          ts_ms: 1700000000999,
        },
      });

      const call = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.market.lifecycle",
      );
      expect(call).toBeDefined();
      expect(call![1]).toMatchObject({
        ticker: "PRES-2028",
        eventType: "market_determined",
        status: "settled",
        settlementValue: "yes",
        result: "Yes",
        timestamp: 1700000000999,
      });
    });

    it("emits lifecycle event with null settlement for non-determined events", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "market_lifecycle_v2",
        msg: {
          market_ticker: "ETH-MERGE",
          event_type: "market_closed",
          status: "closed",
          ts: 1700000000,
        },
      });

      const call = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.market.lifecycle",
      );
      expect(call).toBeDefined();
      expect(call![1]).toMatchObject({
        ticker: "ETH-MERGE",
        eventType: "market_closed",
        settlementValue: null,
        result: null,
      });
    });

    it("skips lifecycle messages with missing ticker", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "market_lifecycle_v2",
        msg: { event_type: "market_determined" },
      });

      const call = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.market.lifecycle",
      );
      expect(call).toBeUndefined();
    });

    it("skips lifecycle messages with missing event_type", async () => {
      const emitSpy = vi.fn();
      emitter.emit = emitSpy;
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerMessage({
        type: "market_lifecycle_v2",
        msg: { market_ticker: "BTC-USD" },
      });

      const call = emitSpy.mock.calls.find(
        (c: any[]) => c[0] === "kalshi.market.lifecycle",
      );
      expect(call).toBeUndefined();
    });

    it("re-subscribes market_lifecycle_v2 on reconnect", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      const firstInstance = mockWsInstance!;
      firstInstance.triggerOpen();

      svc.subscribeMarketLifecycle();

      firstInstance.triggerClose(1006, "lost");
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();

      const secondInstance = mockWsInstance!;
      secondInstance.triggerOpen();

      const calls = secondInstance.send.mock.calls.map((c: unknown[]) =>
        JSON.parse(c[0] as string),
      );
      const channels = calls.flatMap(
        (f: { params?: { channels?: string[] } }) => f.params?.channels ?? [],
      );
      expect(channels).toContain("market_lifecycle_v2");
    });
  });

  // ── Error handling branches ───────────────────────────────────────────────

  describe("error handling", () => {
    it("logs and ignores unparseable WS frames", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerRawMessage("not valid json {{{");
      expect(emitter.emit).not.toHaveBeenCalledWith(
        "market-data.price",
        expect.anything(),
      );
    });

    it("logs and recovers when handleMessage throws", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      vi.spyOn(svc as any, "handleMessage").mockImplementationOnce(() => {
        throw new Error("boom");
      });

      mockWsInstance!.triggerMessage({
        type: "ticker",
        msg: { market_ticker: "X" },
      });
      expect(mockWsInstance!.close).not.toHaveBeenCalled();
    });

    it("closes socket on WebSocket error event", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance!.triggerOpen();

      mockWsInstance!.triggerError(new Error("connection reset"));
      expect(mockWsInstance!.close).toHaveBeenCalled();
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
