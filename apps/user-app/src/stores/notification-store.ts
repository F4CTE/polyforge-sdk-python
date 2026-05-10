import { create } from 'zustand';
import type { WebSocketManager } from '@/lib/websocket';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: () => number;
  addNotification: (
    n: Omit<NotificationItem, 'read'> & { _sourceId?: string | null },
  ) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  bindWebSocket: (ws: WebSocketManager) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],

  unreadCount: () => get().items.filter((n) => !n.read).length,

  addNotification: (n) => {
    const { _sourceId, ...rest } = n;
    set((state) => {
      // Dedup: skip if a notification with the same source id arrived
      // within the last 5 seconds.  Only fall back to title+body match
      // when the wire payload had no id (avoid suppressing distinct
      // events that legitimately share copy text).
      const now = Date.now();
      const DUPE_WINDOW_MS = 5000;
      const sourceId =
        _sourceId === undefined ? rest.id || undefined : _sourceId ?? undefined;
      const isDuplicate = state.items.some((item) => {
        if (sourceId && item.id === sourceId) return true;
        if (
          !sourceId &&
          item.title === rest.title &&
          item.body === rest.body &&
          now - item.timestamp >= 0 && now - item.timestamp < DUPE_WINDOW_MS
        )
          return true;
        return false;
      });
      if (isDuplicate) return state;

      return {
        items: [{ ...rest, read: false }, ...state.items].slice(0, 50),
      };
    });
  },

  markAllRead: () => {
    set((state) => ({
      items: state.items.map((n) => ({ ...n, read: true })),
    }));
  },

  markRead: (id) => {
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  bindWebSocket: (ws: WebSocketManager) => {
    const handler = (msg: Record<string, unknown>) => {
      if (msg.type !== 'NOTIFICATION') return;
      const payload = (msg.data && typeof msg.data === 'object') ? msg.data as Record<string, unknown> : msg;
      get().addNotification({
        _sourceId: (payload.id as string) ?? (payload.alertId as string) ?? null,
        id: (payload.id as string) ?? (payload.alertId as string) ?? crypto.randomUUID(),
        title: (payload.title as string) ?? (payload.subject as string) ?? (payload.type === 'PRICE_ALERT' ? 'Price Alert' : 'Notification'),
        body: (payload.body as string) ?? (payload.message as string) ?? '',
        severity: (payload.severity as NotificationItem['severity']) ?? 'info',
        timestamp: payload.ts ? Number(payload.ts) : Date.now(),
      });
    };
    ws.addListener(handler);
    return () => ws.removeListener(handler);
  },
}));
