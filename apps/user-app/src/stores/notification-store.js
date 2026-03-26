import { create } from 'zustand';
export const useNotificationStore = create((set, get) => ({
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
    bindWebSocket: (ws) => {
        const handler = (msg) => {
            if (msg.type !== 'NOTIFICATION')
                return;
            get().addNotification({
                id: msg.id ?? crypto.randomUUID(),
                title: msg.title ?? 'Notification',
                body: msg.body ?? '',
                severity: msg.severity ?? 'info',
                timestamp: msg.ts ? Number(msg.ts) : Date.now(),
            });
        };
        ws.addListener(handler);
        return () => ws.removeListener(handler);
    },
}));
