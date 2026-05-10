import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useNotificationStore } from './notification-store';
import type { NotificationItem } from './notification-store';

beforeEach(() => {
  useNotificationStore.setState({ items: [] });
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── addNotification basics ──────────────────────────────────────────────

describe('addNotification — basics', () => {
  it('adds a notification to an empty store', () => {
    useNotificationStore.getState().addNotification({
      id: 'n1',
      title: 'Test',
      body: 'Body',
      severity: 'info',
      timestamp: 1000,
    });

    const items = useNotificationStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('n1');
    expect(items[0].title).toBe('Test');
    expect(items[0].read).toBe(false);
  });

  it('caps items at 50', () => {
    for (let i = 0; i < 60; i++) {
      useNotificationStore.getState().addNotification({
        id: `n${i}`,
        title: `T${i}`,
        body: `B${i}`,
        severity: 'info',
        timestamp: i,
      });
    }

    const items = useNotificationStore.getState().items;
    expect(items).toHaveLength(50);
    // Newest is first
    expect(items[0].id).toBe('n59');
    // Oldest pushed out
    expect(items[49].id).toBe('n10');
  });
});

// ─── Dedup — id present ──────────────────────────────────────────────────

describe('addNotification — dedup by id', () => {
  it('suppresses duplicate when id matches existing item', () => {
    const store = useNotificationStore.getState();

    store.addNotification({
      id: 'dup-1',
      title: 'Title A',
      body: 'Body A',
      severity: 'info',
      timestamp: 1000,
    });

    store.addNotification({
      id: 'dup-1',
      title: 'Title A',
      body: 'Body A',
      severity: 'warning',
      timestamp: 2000,
    });

    expect(useNotificationStore.getState().items).toHaveLength(1);
    expect(useNotificationStore.getState().items[0].id).toBe('dup-1');
    // Original kept (severity not overwritten)
    expect(useNotificationStore.getState().items[0].severity).toBe('info');
  });

  it('does NOT dedup by title+body when different IDs share copy text', () => {
    const store = useNotificationStore.getState();

    store.addNotification({
      id: 'id-a',
      title: 'Same Title',
      body: 'Same Body',
      severity: 'info',
      timestamp: Date.now(),
    });

    store.addNotification({
      id: 'id-b',
      title: 'Same Title',
      body: 'Same Body',
      severity: 'error',
      timestamp: Date.now(),
    });

    // Both should be added because they have different IDs
    expect(useNotificationStore.getState().items).toHaveLength(2);
    expect(useNotificationStore.getState().items[0].id).toBe('id-b');
    expect(useNotificationStore.getState().items[1].id).toBe('id-a');
  });
});

// ─── Dedup — no id (fallback to title+body within window) ────────────────

describe('addNotification — title+body fallback when id absent', () => {
  it('suppresses duplicate by title+body within 5s when _sourceId is null', () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    const store = useNotificationStore.getState();

    store.addNotification({
      _sourceId: null,
      id: 'synthetic-uuid-1',
      title: 'Admin Broadcast',
      body: 'System maintenance in 10 minutes',
      severity: 'info',
      timestamp: now,
    });

    expect(useNotificationStore.getState().items).toHaveLength(1);

    // Same title+body, still within 5s window — should be suppressed
    vi.setSystemTime(now + 2000);
    store.addNotification({
      _sourceId: null,
      id: 'synthetic-uuid-2',
      title: 'Admin Broadcast',
      body: 'System maintenance in 10 minutes',
      severity: 'warning',
      timestamp: now + 2000,
    });

    expect(useNotificationStore.getState().items).toHaveLength(1);
    // Original kept (severity not overwritten)
    expect(useNotificationStore.getState().items[0].severity).toBe('info');
  });

  it('does NOT suppress when _sourceId is a real string (id-based dedup)', () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    const store = useNotificationStore.getState();

    store.addNotification({
      _sourceId: 'real-id-a',
      id: 'real-id-a',
      title: 'Shared Title',
      body: 'Shared Body',
      severity: 'info',
      timestamp: now,
    });

    expect(useNotificationStore.getState().items).toHaveLength(1);

    // Different source ID, same title+body → NOT suppressed
    store.addNotification({
      _sourceId: 'real-id-b',
      id: 'real-id-b',
      title: 'Shared Title',
      body: 'Shared Body',
      severity: 'error',
      timestamp: now,
    });

    expect(useNotificationStore.getState().items).toHaveLength(2);
  });
  it('suppresses duplicate by title+body within 5s when no id', () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    const store = useNotificationStore.getState();

    store.addNotification({
      id: '',
      title: 'No ID Title',
      body: 'No ID Body',
      severity: 'info',
      timestamp: now,
    });

    // Same title+body, still within 5s window
    vi.setSystemTime(now + 2000);
    store.addNotification({
      id: '',
      title: 'No ID Title',
      body: 'No ID Body',
      severity: 'warning',
      timestamp: now + 2000,
    });

    expect(useNotificationStore.getState().items).toHaveLength(1);
  });

  it('does NOT suppress when title+body match but outside 5s window', () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    const store = useNotificationStore.getState();

    store.addNotification({
      id: '',
      title: 'Window Test',
      body: 'Window Body',
      severity: 'info',
      timestamp: now,
    });

    // Outside 5s window (>5000ms later)
    vi.setSystemTime(now + 6000);
    store.addNotification({
      id: '',
      title: 'Window Test',
      body: 'Window Body',
      severity: 'error',
      timestamp: now + 6000,
    });

    expect(useNotificationStore.getState().items).toHaveLength(2);
  });

  it('does NOT suppress when existing notification has a future timestamp', () => {
    vi.useFakeTimers();
    // Server clock is 30s ahead of browser
    const now = 1700000000000;
    vi.setSystemTime(now);

    const store = useNotificationStore.getState();

    // Existing notification has a server ts 30s in the future
    store.addNotification({
      id: '',
      title: 'Admin Broadcast',
      body: 'System maintenance in 10 minutes',
      severity: 'info',
      timestamp: now + 30000,
    });

    expect(useNotificationStore.getState().items).toHaveLength(1);

    // 2s later (in real time), another idless notification with same title+body
    vi.setSystemTime(now + 2000);
    store.addNotification({
      id: '',
      title: 'Admin Broadcast',
      body: 'System maintenance in 10 minutes',
      severity: 'warning',
      timestamp: now + 2000,
    });

    // Should NOT be suppressed — the existing item's future timestamp
    // must not widen the dedup window beyond 5s
    expect(useNotificationStore.getState().items).toHaveLength(2);
  });

  it('does NOT suppress when title differs but body matches and no id', () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    const store = useNotificationStore.getState();

    store.addNotification({
      id: '',
      title: 'Title One',
      body: 'Shared Body',
      severity: 'info',
      timestamp: now,
    });

    store.addNotification({
      id: '',
      title: 'Title Two',
      body: 'Shared Body',
      severity: 'info',
      timestamp: now,
    });

    expect(useNotificationStore.getState().items).toHaveLength(2);
  });
});

// ─── unreadCount ──────────────────────────────────────────────────────────

describe('unreadCount', () => {
  it('returns 0 for empty store', () => {
    expect(useNotificationStore.getState().unreadCount()).toBe(0);
  });

  it('returns count of unread notifications', () => {
    useNotificationStore.setState({
      items: [
        { id: 'a', title: '', body: '', severity: 'info', timestamp: 1, read: false },
        { id: 'b', title: '', body: '', severity: 'info', timestamp: 2, read: true },
        { id: 'c', title: '', body: '', severity: 'info', timestamp: 3, read: false },
      ],
    });
    expect(useNotificationStore.getState().unreadCount()).toBe(2);
  });
});

// ─── markRead ─────────────────────────────────────────────────────────────

describe('markRead', () => {
  it('marks a single notification as read by id', () => {
    useNotificationStore.setState({
      items: [
        { id: 'r1', title: '', body: '', severity: 'info', timestamp: 1, read: false },
        { id: 'r2', title: '', body: '', severity: 'info', timestamp: 2, read: false },
      ],
    });

    useNotificationStore.getState().markRead('r1');

    const items = useNotificationStore.getState().items;
    expect(items.find((n) => n.id === 'r1')?.read).toBe(true);
    expect(items.find((n) => n.id === 'r2')?.read).toBe(false);
  });

  it('no-ops when id not found', () => {
    useNotificationStore.setState({
      items: [
        { id: 'r1', title: '', body: '', severity: 'info', timestamp: 1, read: false },
      ],
    });

    useNotificationStore.getState().markRead('nonexistent');
    expect(useNotificationStore.getState().items[0].read).toBe(false);
  });
});

// ─── markAllRead ──────────────────────────────────────────────────────────

describe('markAllRead', () => {
  it('marks all notifications as read', () => {
    useNotificationStore.setState({
      items: [
        { id: 'a', title: '', body: '', severity: 'info', timestamp: 1, read: false },
        { id: 'b', title: '', body: '', severity: 'info', timestamp: 2, read: true },
        { id: 'c', title: '', body: '', severity: 'info', timestamp: 3, read: false },
      ],
    });

    useNotificationStore.getState().markAllRead();

    expect(useNotificationStore.getState().items.every((n) => n.read)).toBe(true);
  });
});
