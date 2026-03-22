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
  addNotification: (n: Omit<NotificationItem, 'read'>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  bindWebSocket: (ws: WebSocketManager) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],

  unreadCount: () => get().items.filter((n) => !n.read).length,

  addNotification: (n) => {
    set((state) => ({
      items: [{ ...n, read: false }, ...state.items].slice(0, 50),
    }));
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
      get().addNotification({
        id: (msg.id as string) ?? crypto.randomUUID(),
        title: (msg.title as string) ?? 'Notification',
        body: (msg.body as string) ?? '',
        severity: (msg.severity as NotificationItem['severity']) ?? 'info',
        timestamp: msg.ts ? Number(msg.ts) : Date.now(),
      });
    };
    ws.addListener(handler);
    return () => ws.removeListener(handler);
  },
}));
