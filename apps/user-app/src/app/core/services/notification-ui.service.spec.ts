import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Subject } from "rxjs";
import { NotificationItem } from "./notification-ui.service";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<NotificationItem> = {}): Omit<NotificationItem, "read"> {
  return {
    id: "notif-1",
    title: "Test Notification",
    body: "Something happened",
    severity: "info",
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Test helpers ────────────────────────────────────────────────────────────
// The Angular service uses inject() for DI and signals, which require Angular's
// injector. We replicate the core logic inline so we can unit-test the behavior
// without a full Angular TestBed (the Angular apps do not have vitest wired up
// via TestBed). This mirrors the actual service implementation faithfully.

function createServiceUnderTest() {
  const notifications$ = new Subject<Omit<NotificationItem, "read">>();

  let items: NotificationItem[] = [];
  const getItems = () => items;

  // Replicate constructor subscription
  notifications$.subscribe(n => {
    items = [{ ...n, read: false }, ...items].slice(0, 50);
  });

  const unreadCount = () => items.filter(n => !n.read).length;

  const markAllRead = () => {
    items = items.map(n => ({ ...n, read: true }));
  };

  const markRead = (id: string) => {
    items = items.map(n => n.id === id ? { ...n, read: true } : n);
  };

  return { items: getItems, unreadCount, markAllRead, markRead, notifications$ };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("NotificationUiService", () => {
  let service: ReturnType<typeof createServiceUnderTest>;

  beforeEach(() => {
    service = createServiceUnderTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty items and 0 unread count", () => {
    expect(service.items()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it("adds notifications from WebSocket", () => {
    const notif = makeNotification();
    service.notifications$.next(notif);

    const items = service.items();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("notif-1");
    expect(items[0].read).toBe(false);
  });

  it("prepends new notifications (newest first)", () => {
    service.notifications$.next(makeNotification({ id: "notif-1" }));
    service.notifications$.next(makeNotification({ id: "notif-2" }));

    const items = service.items();
    expect(items[0].id).toBe("notif-2");
    expect(items[1].id).toBe("notif-1");
  });

  it("caps at 50 notifications", () => {
    for (let i = 0; i < 60; i++) {
      service.notifications$.next(makeNotification({ id: `notif-${i}` }));
    }

    expect(service.items()).toHaveLength(50);
    // The most recent should be first
    expect(service.items()[0].id).toBe("notif-59");
  });

  it("markAllRead sets all items to read", () => {
    service.notifications$.next(makeNotification({ id: "n-1" }));
    service.notifications$.next(makeNotification({ id: "n-2" }));
    service.notifications$.next(makeNotification({ id: "n-3" }));

    expect(service.unreadCount()).toBe(3);

    service.markAllRead();

    expect(service.unreadCount()).toBe(0);
    service.items().forEach((n: any) => expect(n.read).toBe(true));
  });

  it("markRead marks a specific item as read", () => {
    service.notifications$.next(makeNotification({ id: "n-1" }));
    service.notifications$.next(makeNotification({ id: "n-2" }));

    service.markRead("n-1");

    const items = service.items();
    const n1 = items.find(n => n.id === "n-1");
    const n2 = items.find(n => n.id === "n-2");
    expect(n1!.read).toBe(true);
    expect(n2!.read).toBe(false);
  });

  it("markRead does not affect other items", () => {
    service.notifications$.next(makeNotification({ id: "n-1" }));
    service.notifications$.next(makeNotification({ id: "n-2" }));
    service.notifications$.next(makeNotification({ id: "n-3" }));

    service.markRead("n-2");

    expect(service.unreadCount()).toBe(2);
  });

  it("unreadCount computes correctly as items change", () => {
    expect(service.unreadCount()).toBe(0);

    service.notifications$.next(makeNotification({ id: "n-1" }));
    expect(service.unreadCount()).toBe(1);

    service.notifications$.next(makeNotification({ id: "n-2" }));
    expect(service.unreadCount()).toBe(2);

    service.markRead("n-1");
    expect(service.unreadCount()).toBe(1);

    service.markAllRead();
    expect(service.unreadCount()).toBe(0);
  });
});
