import { create } from 'zustand';
import { authApi } from '@/lib/api';
import { identifyUser, resetAnalytics } from '@/lib/analytics';
import { captureError, setSentryUser, clearSentryUser } from '@/lib/sentry';

interface Admin {
  id: string;
  email: string;
  role: string;
  displayName: string;
  totpEnabled: boolean;
}

interface AdminAuthState {
  admin: Admin | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  init: () => void;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  loading: true,
  isAuthenticated: false,
  isSuperAdmin: false,

  init: async () => {
    try {
      const admin = await authApi.me();
      identifyUser(admin.id, { email: admin.email });
      set({
        admin,
        loading: false,
        isAuthenticated: true,
        isSuperAdmin: admin.role === 'SUPER_ADMIN',
      });
      setSentryUser(admin.id, admin.email);
    } catch (err) {
      console.error('Admin auth init failed:', err instanceof Error ? err.message : err);
      const status = (err as { status?: number }).status;
      if (status !== 401) {
        captureError(err instanceof Error ? err : new Error(String(err)), { action: 'admin-auth:init' });
      }
      set({ admin: null, loading: false, isAuthenticated: false, isSuperAdmin: false });
    }
  },

  login: async (email: string, password: string, totpCode?: string) => {
    const admin = await authApi.login({ email, password, ...(totpCode ? { totpCode } : {}) });
    identifyUser(admin.id, { email: admin.email });
    set({
      admin,
      isAuthenticated: true,
      isSuperAdmin: admin.role === 'SUPER_ADMIN',
    });
    setSentryUser(admin.id, admin.email);
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Admin logout request failed (continuing local cleanup):', err instanceof Error ? err.message : err);
    }
    resetAnalytics();
    clearSentryUser();
    set({ admin: null, isAuthenticated: false, isSuperAdmin: false });
    // Hard-redirect so any cached privileged page state is dropped before
    // a different admin can sign in on the same browser.
    window.location.href = '/login';
  },
}));
