import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PolymarketUserWsService } from "./polymarket-user-ws.service";

// ── Mock WebSocket ───────────────────────────────────────────────────────────

type WsEventHandler = (...args: any[]) => void;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  private handlers = new Map<string, WsEventHandler[]>();

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  on(event: string, handler: WsEventHandler) {
    const arr = this.handlers.get(event) ?? [];
    arr.push(handler);
    this.handlers.set(event, arr);
  }

  send = vi.fn();
  close = vi.fn();

  // Test helpers
  triggerMessage(data: Record<string, unknown>) {
    const buf = Buffer.from(JSON.stringify(data));
    (this.handlers.get("message") ?? []).forEach((h) => h(buf));
  }

  triggerClose(code = 1006, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    (this.handlers.get("close") ?? []).forEach((h) =>
      h(code, Buffer.from(reason)),
    );
  }

  triggerError(err: Error) {
    (this.handlers.get("error") ?? []).forEach((h) => h(err));
  }
}

let mockWsInstances: MockWebSocket[] = [];

vi.mock("ws", () => {
  return {
    default: class {
      constructor(url: string) {
        return new MockWebSocket(url);
      }
    },
  };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeMocks() {
  const redis = {
    xadd: vi.fn().mockResolvedValue("1234567890-0"),
  } as any;

  const config = {
    get: vi
      .fn()
      .mockReturnValue("wss://ws-subscriptions-clob.polymarket.com/ws/user"),
  } as any;

  return { redis, config };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PolymarketUserWsService", () => {
  let svc: PolymarketUserWsService;
  let redis: ReturnType<typeof makeMocks>["redis"];
  let config: ReturnType<typeof makeMocks>["config"];

  beforeEach(() => {
    vi.useFakeTimers();
    mockWsInstances = [];
    const m = makeMocks();
    ({ redis, config } = m);
    svc = new PolymarketUserWsService(redis, config);
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Subscribes user, creates WebSocket connection ──────────────────────

  it("subscribes user and creates a WebSocket connection", () => {
    svc.subscribeUser("user-1", "0xWallet");

    expect(mockWsInstances).toHaveLength(1);
    expect(mockWsInstances[0].url).toContain("address=0xWallet");
  });

  // ── Does not create duplicate connection ───────────────────────────────

  it("does not create duplicate connection for same user", () => {
    svc.subscribeUser("user-1", "0xWallet");
    svc.subscribeUser("user-1", "0xWallet");

    expect(mockWsInstances).toHaveLength(1);
  });

  // ── Publishes ORDER_FILLED to stream:events ───────────────────────────

  it("publishes ORDER_FILLED to stream:events on ORDER_FILL message", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const ws = mockWsInstances[0];

    ws.triggerMessage({
      type: "ORDER_FILL",
      asset: "token-abc",
      price: "0.65",
      size: "100",
      side: "BUY",
    });

    // Allow async handler to complete
    await vi.advanceTimersByTimeAsync(0);

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({
        type: "ORDER_FILLED",
        userId: "user-1",
        tokenId: "token-abc",
        fillPrice: "0.65",
        fillSize: "100",
        side: "BUY",
      }),
    );
  });

  // ── Publishes ORDER_CANCELLED to stream:events ─────────────────────────

  it("publishes ORDER_CANCELLED to stream:events on ORDER_CANCELLED message", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const ws = mockWsInstances[0];

    ws.triggerMessage({
      type: "ORDER_CANCELLED",
      orderId: "order-xyz",
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({
        type: "ORDER_CANCELLED",
        userId: "user-1",
        orderId: "order-xyz",
      }),
    );
  });

  // ── Reconnects on abnormal close ────────────────────────────────────────

  it("auto-reconnects on abnormal close (code 1006)", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const firstWs = mockWsInstances[0];

    firstWs.triggerClose(1006, "abnormal");

    // Advance past the first reconnect delay (1000ms)
    await vi.advanceTimersByTimeAsync(1100);

    // A second WS should have been created for the reconnect
    expect(mockWsInstances).toHaveLength(2);
    expect(mockWsInstances[1].url).toContain("address=0xWallet");
  });

  // ── Does NOT reconnect on normal close ─────────────────────────────────

  it("does not reconnect on normal close (code 1000)", () => {
    svc.subscribeUser("user-1", "0xWallet");
    const firstWs = mockWsInstances[0];

    firstWs.triggerClose(1000);

    vi.advanceTimersByTime(5_000);
    expect(mockWsInstances).toHaveLength(1);
  });

  // ── Does NOT reconnect on going-away close ──────────────────────────────

  it("does not reconnect on going-away close (code 1001)", () => {
    svc.subscribeUser("user-1", "0xWallet");
    const firstWs = mockWsInstances[0];

    firstWs.triggerClose(1001);

    vi.advanceTimersByTime(5_000);
    expect(mockWsInstances).toHaveLength(1);
  });

  // ── Reconnect uses exponential backoff ──────────────────────────────────

  it("uses increasing delays on repeated reconnect failures", async () => {
    svc.subscribeUser("user-1", "0xWallet");

    // Trigger 2 consecutive abnormal closes
    mockWsInstances[0].triggerClose(1006);
    await vi.advanceTimersByTimeAsync(1100); // first reconnect delay = 1000ms

    expect(mockWsInstances).toHaveLength(2);

    mockWsInstances[1].triggerClose(1006);
    // Second reconnect delay = 2000ms; 1100ms should NOT be enough
    await vi.advanceTimersByTimeAsync(1100);
    expect(mockWsInstances).toHaveLength(2); // still waiting

    await vi.advanceTimersByTimeAsync(1000); // now past 2000ms total
    expect(mockWsInstances).toHaveLength(3);
  });

  // ── Stops reconnecting after max attempts ──────────────────────────────

  it("stops reconnecting after max attempts (5)", async () => {
    svc.subscribeUser("user-1", "0xWallet");

    // Trigger 5 closes to exhaust all reconnect attempts
    for (let i = 0; i < 5; i++) {
      const ws = mockWsInstances[mockWsInstances.length - 1];
      ws.triggerClose(1006);
      // Advance past the delay for this attempt (max 30s for last ones)
      await vi.advanceTimersByTimeAsync(35_000);
    }

    const countAfterExhaustion = mockWsInstances.length;

    // One more large advance should not create more WS instances
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockWsInstances).toHaveLength(countAfterExhaustion);
  });

  // ── Cancels pending reconnect on explicit unsubscribe ──────────────────

  it("cancels pending reconnect timer on unsubscribeUser", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const firstWs = mockWsInstances[0];

    firstWs.triggerClose(1006); // schedule reconnect

    // Unsubscribe before timer fires
    svc.unsubscribeUser("user-1");

    await vi.advanceTimersByTimeAsync(2000);

    // No reconnect should have occurred
    expect(mockWsInstances).toHaveLength(1);
  });

  // ── Does not reconnect if user was manually resubscribed ───────────────

  it("does not reconnect if user was manually resubscribed before timer fires", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const firstWs = mockWsInstances[0];

    firstWs.triggerClose(1006);

    // Manually resubscribe before reconnect timer fires (timer = 1000ms)
    svc.subscribeUser("user-1", "0xWallet2");

    await vi.advanceTimersByTimeAsync(2000);

    // Should be 2 total: the closed one + the manual resubscribe (no extra reconnect)
    expect(mockWsInstances).toHaveLength(2);
  });

  // ── Unsubscribes user, closes connection ───────────────────────────────

  it("unsubscribes user and closes WebSocket connection", () => {
    svc.subscribeUser("user-1", "0xWallet");
    const ws = mockWsInstances[0];

    svc.unsubscribeUser("user-1");

    expect(ws.close).toHaveBeenCalled();
  });

  // ── Unsubscribe is no-op for unknown user ─────────────────────────────

  it("does nothing when unsubscribing unknown user", () => {
    expect(() => svc.unsubscribeUser("nonexistent")).not.toThrow();
  });

  // ── Handles parse errors gracefully ────────────────────────────────────

  it("handles malformed JSON without throwing", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const ws = mockWsInstances[0];

    // Trigger raw invalid JSON
    const handlers = (ws as any).handlers.get("message") ?? [];
    expect(() => {
      handlers.forEach((h: any) => h(Buffer.from("not-json{")));
    }).not.toThrow();

    expect(redis.xadd).not.toHaveBeenCalled();
  });

  // ── Ignores unknown message types ──────────────────────────────────────

  it("ignores unknown message types without publishing", async () => {
    svc.subscribeUser("user-1", "0xWallet");
    const ws = mockWsInstances[0];

    ws.triggerMessage({ type: "UNKNOWN_EVENT", data: {} });

    await vi.advanceTimersByTimeAsync(0);

    expect(redis.xadd).not.toHaveBeenCalled();
  });

  // ── onModuleDestroy closes all connections ─────────────────────────────

  it("closes all connections on onModuleDestroy", () => {
    svc.subscribeUser("user-1", "0xW1");
    svc.subscribeUser("user-2", "0xW2");

    svc.onModuleDestroy();

    expect(mockWsInstances[0].close).toHaveBeenCalled();
    expect(mockWsInstances[1].close).toHaveBeenCalled();
  });
});
