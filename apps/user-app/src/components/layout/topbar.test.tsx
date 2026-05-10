import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Topbar } from './topbar';
import type { WsConnectionState } from '@/lib/websocket';

let connectionListener: ((state: WsConnectionState) => void) | null = null;
let currentConnectionState: WsConnectionState = 'connected';

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { displayName: 'Ada Trader', username: 'ada', polymarketConnected: true },
    logout: vi.fn(),
  }),
}));

vi.mock('@/stores/theme-store', () => ({
  useThemeStore: () => ({
    isDark: false,
    toggle: vi.fn(),
  }),
}));

vi.mock('@/stores/notification-store', () => ({
  useNotificationStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    items: [],
    unreadCount: () => 0,
    markAllRead: vi.fn(),
    markRead: vi.fn(),
  }),
}));

vi.mock('@/lib/websocket', () => ({
  wsManager: {
    getConnectionState: () => currentConnectionState,
    addConnectionListener: (listener: (state: WsConnectionState) => void) => {
      connectionListener = listener;
      listener(currentConnectionState);
      return () => {
        connectionListener = null;
      };
    },
  },
}));

describe('Topbar websocket status', () => {
  it('renders visible stale-data feedback when reconnecting', async () => {
    currentConnectionState = 'connected';
    render(<Topbar />);

    expect(screen.queryByText('Reconnecting')).toBeNull();

    act(() => {
      currentConnectionState = 'reconnecting';
      connectionListener?.('reconnecting');
    });

    const status = await screen.findByRole('status', {
      name: 'Live updates reconnecting. Data may be stale.',
    });
    expect(within(status).getByText('Reconnecting')).toBeTruthy();
  });
});
