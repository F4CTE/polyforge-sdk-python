import { create } from 'zustand';
import { authApi } from '@/lib/api';

interface Admin {
  id: string;
  email: string;
  role: string;
  displayName: string;
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
      set({
        admin,
        loading: false,
        isAuthenticated: true,
        isSuperAdmin: admin.role === 'SUPER_ADMIN',
      });
    } catch {
      set({ admin: null, loading: false, isAuthenticated: false, isSuperAdmin: false });
    }
  },

  login: async (email: string, password: string, totpCode?: string) => {
    const admin = await authApi.login({ email, password, ...(totpCode ? { totpCode } : {}) });
    set({
      admin,
      isAuthenticated: true,
      isSuperAdmin: admin.role === 'SUPER_ADMIN',
    });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    set({ admin: null, isAuthenticated: false, isSuperAdmin: false });
  },
}));
