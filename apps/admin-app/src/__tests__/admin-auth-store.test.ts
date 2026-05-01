import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const logoutMock = vi.fn();

vi.mock('../lib/api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: () => logoutMock(),
  },
}));

vi.mock('../lib/analytics', () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

vi.mock('../lib/sentry', () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}));

describe('admin-auth-store.logout', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.resetModules();
    logoutMock.mockReset();
    originalLocation = window.location;
    // Replace location with a writable href stub so we can assert redirects
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '/dashboard' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('clears state and redirects to /login on success', async () => {
    logoutMock.mockResolvedValueOnce(undefined);
    const { useAdminAuthStore } = await import('../stores/admin-auth-store');
    // seed authenticated state
    useAdminAuthStore.setState({
      admin: { id: '1', email: 'a@x', role: 'SUPER_ADMIN', displayName: 'A' },
      isAuthenticated: true,
      isSuperAdmin: true,
    });

    await useAdminAuthStore.getState().logout();

    const state = useAdminAuthStore.getState();
    expect(state.admin).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isSuperAdmin).toBe(false);
    expect(window.location.href).toBe('/login');
  });

  it('redirects to /login even if the API logout call fails', async () => {
    logoutMock.mockRejectedValueOnce(new Error('network'));
    const { useAdminAuthStore } = await import('../stores/admin-auth-store');
    useAdminAuthStore.setState({
      admin: { id: '1', email: 'a@x', role: 'ADMIN', displayName: 'A' },
      isAuthenticated: true,
      isSuperAdmin: false,
    });

    await useAdminAuthStore.getState().logout();

    expect(useAdminAuthStore.getState().admin).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
