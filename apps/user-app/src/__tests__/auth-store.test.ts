import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth-store';

vi.mock('../lib/analytics', () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

vi.mock('../lib/sentry', () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}));

describe('auth store logout', () => {
  const locationAssign = vi.fn();
  let removeItem: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network stalled')));
    removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => undefined);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: locationAssign,
      },
    });
    locationAssign.mockClear();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        username: 'alice',
        status: 'VERIFIED',
        polymarketConnected: false,
        kalshiConnected: false,
        emailVerified: true,
        totpEnabled: false,
        showPnl: true,
        showWinrate: true,
        createdAt: '2026-05-05T00:00:00.000Z',
        lastSeen: '2026-05-05T00:00:00.000Z',
      },
      loading: true,
    });
  });

  it('clears local auth state and redirects when the network logout fails', async () => {
    await useAuthStore.getState().logout();

    expect(fetch).toHaveBeenCalledWith('/auth/v1/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
    expect(removeItem).toHaveBeenCalledWith('access_token');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
    expect(locationAssign).toHaveBeenCalledWith('/login');
  });
});
