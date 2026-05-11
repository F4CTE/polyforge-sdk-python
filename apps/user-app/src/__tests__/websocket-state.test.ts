import { describe, expect, it, vi } from 'vitest';
import { WebSocketManager, type WsConnectionState } from '../lib/websocket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: '', wasClean: true } as CloseEvent);
  });

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
}

describe('WebSocketManager connection state', () => {
  it('publishes connecting, connected, and reconnecting states', () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('location', { protocol: 'https:', host: 'app.test' });
    const manager = new WebSocketManager();
    const states: WsConnectionState[] = [];

    const unsubscribe = manager.addConnectionListener((state) => states.push(state));
    manager.connect();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].close();

    expect(states).toEqual(['disconnected', 'connecting', 'connected', 'reconnecting']);
    expect(manager.getConnectionState()).toBe('reconnecting');

    unsubscribe();
    manager.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('injects CONNECTION_STATE messages into the addListener event stream on open/close', () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('location', { protocol: 'https:', host: 'app.test' });
    const manager = new WebSocketManager();
    const messages: Array<{ type: string; state?: string; code?: number; reason?: string }> = [];

    manager.addListener((msg) => {
      if (msg.type === 'CONNECTION_STATE') {
        const record: Record<string, unknown> = { type: msg.type, state: msg.state };
        if (msg.code !== undefined) record.code = msg.code;
        if (msg.reason !== undefined) record.reason = msg.reason;
        messages.push(record as { type: string; state?: string; code?: number; reason?: string });
      }
    });

    manager.connect();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].close();

    expect(messages).toEqual([
      { type: 'CONNECTION_STATE', state: 'connected' },
      { type: 'CONNECTION_STATE', state: 'reconnecting', code: 1000 },
    ]);

    manager.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('message listeners that ignore CONNECTION_STATE survive open/close without throwing', () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('location', { protocol: 'https:', host: 'app.test' });
    const manager = new WebSocketManager();
    let domainEventCount = 0;

    manager.addListener((msg) => {
      // Domain listener that only handles PRICE_UPDATE — CONNECTION_STATE must not throw
      if (msg.type === 'PRICE_UPDATE') {
        domainEventCount += 1;
      }
    });

    manager.connect();
    FakeSocket.instances[0].open();
    // Simulate a domain message arriving after connect
    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'PRICE_UPDATE', price: 0.65 }) });
    FakeSocket.instances[0].close();

    expect(domainEventCount).toBe(1);

    manager.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
