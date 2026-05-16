import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import WebSocket from "ws";
import { BaseVenueWsService } from "./base-venue-ws";
import type { VenueWsConfig } from "@polyforge/shared-types";

type WsHandler = (...args: any[]) => void;

class MockVenueSocket {
  readyState = WebSocket.CONNECTING;
  private readonly handlers = new Map<string, WsHandler[]>();

  on(event: string, handler: WsHandler) {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  removeAllListeners = vi.fn();
  ping = vi.fn();
  close = vi.fn();
  send = vi.fn();

  triggerOpen() {
    this.readyState = WebSocket.OPEN;
    (this.handlers.get("open") ?? []).forEach((handler) => handler());
  }

  triggerPong() {
    (this.handlers.get("pong") ?? []).forEach((handler) => handler());
  }
}

// ─── Concrete test subclass ──────────────────────────────────────────────────

class TestWsService extends BaseVenueWsService {
  public receivedMessages: Record<string, unknown>[] = [];
  public sentSubscriptions: string[][] = [];
  public sentUnsubscriptions: string[][] = [];
  public connectedCount = 0;
  public mockSocket: MockVenueSocket | null = null;

  constructor(emitter: EventEmitter2, config: Partial<VenueWsConfig> = {}) {
    super(emitter, {
      venueId: "test-venue",
      url: "ws://localhost:9999",
      enabled: true,
      pingIntervalMs: 5_000,
      reconnectBaseMs: 50,
      reconnectMaxMs: 200,
      ...config,
    });
  }

  protected handleMessage(data: Record<string, unknown>): void {
    this.receivedMessages.push(data);
  }

  protected sendSubscriptions(ids: string[]): void {
    this.sentSubscriptions.push(ids);
  }

  protected sendUnsubscriptions(ids: string[]): void {
    this.sentUnsubscriptions.push(ids);
  }

  protected onConnected(): void {
    this.connectedCount++;
  }

  protected createWebSocket(): WebSocket {
    this.mockSocket = new MockVenueSocket();
    return this.mockSocket as unknown as WebSocket;
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("BaseVenueWsService", () => {
  let emitter: EventEmitter2;

  beforeEach(() => {
    emitter = new EventEmitter2();
  });

  describe("constructor", () => {
    it("sets up with provided config", () => {
      const svc = new TestWsService(emitter, { venueId: "my-venue" });
      expect(svc.isConnected).toBe(false);
      svc.teardown();
    });
  });

  describe("init()", () => {
    it("skips connection when disabled", () => {
      const svc = new TestWsService(emitter, { enabled: false });
      svc.init();
      expect(svc.isConnected).toBe(false);
      svc.teardown();
    });
  });

  describe("subscription management", () => {
    it("tracks subscriptions", () => {
      const svc = new TestWsService(emitter);
      svc.addSubscriptions(["tok-1", "tok-2"]);
      expect(svc["subscriptions"].size).toBe(2);
      expect(svc["subscriptions"].has("tok-1")).toBe(true);
      svc.teardown();
    });

    it("removes subscriptions", () => {
      const svc = new TestWsService(emitter);
      svc.addSubscriptions(["tok-1", "tok-2", "tok-3"]);
      svc.removeSubscriptions(["tok-2"]);
      expect(svc["subscriptions"].size).toBe(2);
      expect(svc["subscriptions"].has("tok-2")).toBe(false);
      svc.teardown();
    });

    it("deduplicates subscriptions", () => {
      const svc = new TestWsService(emitter);
      svc.addSubscriptions(["tok-1", "tok-1", "tok-2"]);
      expect(svc["subscriptions"].size).toBe(2);
      svc.teardown();
    });
  });

  describe("teardown()", () => {
    it("sets destroyed flag", () => {
      const svc = new TestWsService(emitter);
      svc.teardown();
      expect(svc["destroyed"]).toBe(true);
    });

    it("can be called multiple times safely", () => {
      const svc = new TestWsService(emitter);
      svc.teardown();
      svc.teardown();
      expect(svc["destroyed"]).toBe(true);
    });
  });

  describe("send()", () => {
    it("does not throw when no ws connection", () => {
      const svc = new TestWsService(emitter);
      expect(() => svc["send"]({ test: true })).not.toThrow();
      svc.teardown();
    });
  });

  describe("pong timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("closes a stale socket when ping pongs stop", () => {
      const svc = new TestWsService(emitter);
      svc.init();
      svc.mockSocket?.triggerOpen();

      vi.advanceTimersByTime(5_000);
      expect(svc.mockSocket?.ping).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30_000);
      expect(svc.mockSocket?.close).toHaveBeenCalled();

      svc.teardown();
    });

    it("keeps the socket open when pong clears the timeout", () => {
      const svc = new TestWsService(emitter);
      svc.init();
      svc.mockSocket?.triggerOpen();

      vi.advanceTimersByTime(5_000);
      svc.mockSocket?.triggerPong();
      vi.advanceTimersByTime(25_000);

      expect(svc.mockSocket?.close).not.toHaveBeenCalled();

      svc.teardown();
    });
  });
});
