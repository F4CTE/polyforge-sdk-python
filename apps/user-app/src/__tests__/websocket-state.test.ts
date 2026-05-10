import { describe, expect, it, vi } from 'vitest';
import { WebSocketManager, type WsConnectionState } from '../lib/websocket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
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
});
