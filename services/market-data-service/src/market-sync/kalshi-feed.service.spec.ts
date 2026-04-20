import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { KalshiFeedService } from "./kalshi-feed.service";

// ── Mock WebSocket ─────────────────────────────────────────────────────────────

type WsHandler = (...args: any[]) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  private handlers = new Map<string, WsHandler[]>();

  on(event: string, handler: WsHandler) {
    const arr = this.handlers.get(event) ?? [];
    arr.push(handler);
    this.handlers.set(event, arr);
  }

  send = vi.fn();
  close = vi.fn();
  ping = vi.fn();
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

let mockWsInstance: MockWebSocket;

vi.mock("ws", () => ({
  default: class {
    static OPEN = 1;
    static CLOSED = 3;
    constructor() {
      mockWsInstance = new MockWebSocket();
      return mockWsInstance;
    }
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(enabled = "true"): ConfigService {
  return {
    get: (k: string, d?: string) => {
      const map: Record<string, string> = {
        KALSHI_ENABLED: enabled,
        KALSHI_BASE_URL: "https://demo-api.kalshi.co/trade-api/v2",
        KALSHI_WS_URL: "wss://demo-api.kalshi.co/trade-api/ws/v2",
        SIGNER_SERVICE_URL: "http://signer:3012",
        INTERNAL_JWT_SECRET: "test-secret",
      };
      return map[k] ?? d ?? "";
    },
  } as any;
}

function makeJwt(): JwtService {
  return { sign: vi.fn().mockReturnValue("svc-jwt") } as any;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("KalshiFeedService", () => {
  let svc: KalshiFeedService;
  let emitter: EventEmitter2;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    emitter = new EventEmitter2();
    vi.spyOn(emitter, "emit");

    // Signer returns a fake JWT
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: "fake.kalshi.jwt",
        expiresAt: Math.floor(Date.now() / 1000) + 1800,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    svc = new KalshiFeedService(emitter, makeJwt(), makeConfig());
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── Feature flag ──────────────────────────────────────────────────────────

  describe("KALSHI_ENABLED flag", () => {
    it("does NOT connect when KALSHI_ENABLED=false", async () => {
      const disabledSvc = new KalshiFeedService(
        new EventEmitter2(),
        makeJwt(),
        makeConfig("false"),
      );
      disabledSvc.onModuleInit();
      await vi.runAllTimersAsync();
      expect(mockWsInstance).toBeUndefined();
      disabledSvc.onModuleDestroy();
    });

    it("connects when KALSHI_ENABLED=true", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      expect(mockWsInstance).toBeDefined();
    });
  });

  // ── Price events ──────────────────────────────────────────────────────────

  describe("price events", () => {
    it("emits market-data.price on Kalshi ticker message", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "ticker",
        msg: {
          market_ticker: "PRES-2024",
          yes_price: 67,
          ts: 1_700_000_000_000,
        },
      });

      expect(emitter.emit).toHaveBeenCalledWith(
        "market-data.price",
        expect.objectContaining({
          tokenId: "PRES-2024",
          price: 0.67,
        }),
      );
    });

    it("normalizes cent price ÷100", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({
        type: "ticker",
        msg: { market_ticker: "ETH-USD", yes_price: 99, ts: 0 },
      });

      const priceCall = (
        emitter.emit as ReturnType<typeof vi.fn>
      ).mock.calls.find(([e]) => e === "market-data.price");
      expect(priceCall?.[1].price).toBeCloseTo(0.99);
    });

    it("ignores non-ticker messages", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance.triggerOpen();

      mockWsInstance.triggerMessage({ type: "subscribed", sid: 42 });

      expect(emitter.emit).not.toHaveBeenCalledWith(
        "market-data.price",
        expect.anything(),
      );
    });
  });

  // ── Reconnection ──────────────────────────────────────────────────────────

  describe("reconnection", () => {
    it("schedules reconnect on close", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      mockWsInstance.triggerOpen();
      mockWsInstance.triggerClose(1006, "lost");

      expect((svc as any).destroyed).toBe(false);
    });

    it("does not reconnect after onModuleDestroy", async () => {
      svc.onModuleInit();
      await vi.runAllTimersAsync();
      svc.onModuleDestroy();
      expect((svc as any).destroyed).toBe(true);
    });
  });

  // ── Token cache ──────────────────────────────────────────────────────────

  describe("token cache", () => {
    it("returns cached token when not expired", async () => {
      // First connect fetches a token
      svc.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Simulate disconnect and reconnect — token still valid
      mockWsInstance.triggerClose(1006, "lost");
      await vi.advanceTimersByTimeAsync(1100); // reconnect timer fires

      // Second connect should reuse cached token (no new fetch to signer)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("refreshes token when near expiry", async () => {
      // First connect fetches a token
      svc.onModuleInit();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Set tokenCache expiresAt to be within REFRESH_MARGIN_SECS (300s)
      const now = Math.floor(Date.now() / 1000);
      (svc as any).tokenCache = { token: "old-token", expiresAt: now + 100 };

      // Simulate disconnect and reconnect — token is near expiry
      mockWsInstance.triggerClose(1006, "lost");
      await vi.advanceTimersByTimeAsync(1100);

      // Should have fetched a new token
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("deduplicates concurrent token refreshes", async () => {
      // Manually invoke getToken concurrently
      const getToken = (svc as any).getToken.bind(svc);

      // Expire the cache so refresh is triggered
      (svc as any).tokenCache = null;

      const [t1, t2, t3] = await Promise.all([
        getToken(),
        getToken(),
        getToken(),
      ]);

      // All should return the same token
      expect(t1).toBe("fake.kalshi.jwt");
      expect(t2).toBe("fake.kalshi.jwt");
      expect(t3).toBe("fake.kalshi.jwt");

      // Only one fetch call to signer despite 3 concurrent getToken() calls
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
