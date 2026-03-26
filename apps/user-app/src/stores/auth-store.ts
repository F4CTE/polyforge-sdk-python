import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  status: 'UNVERIFIED' | 'VERIFIED' | 'CONNECTED';
  polymarketConnected: boolean;
  emailVerified: boolean;
  totpEnabled: boolean;
  showPnl: boolean;
  showWinrate: boolean;
  createdAt: string;
  lastSeen: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: () => boolean;
  isVerified: () => boolean;
  isConnected: () => boolean;
  init: () => Promise<void>;
  login: (body: { email: string; password: string; totpCode?: string }) => Promise<void>;
  register: (body: { email: string; password: string; username: string; tosAccepted: boolean; inviteCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  patchUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  isAuthenticated: () => get().user !== null,
  isVerified: () => get().user?.emailVerified === true,
  isConnected: () => get().user?.polymarketConnected === true,

  init: async () => {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/auth/v1/me', {
        credentials: 'include',
        signal: controller.signal,
      });
      if (res.ok) {
        const user = await res.json();
        set({ user, loading: false });
      } else {
        if (res.status === 401) {
          sessionStorage.setItem('session_expired', 'true');
        }
        set({ user: null, loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (body) => {
    const res = await fetch('/auth/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw err;
    }
    const user = await res.json();
    set({ user });
  },

  register: async (body) => {
    const res = await fetch('/auth/v1/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw err;
    }
    const user = await res.json();
    set({ user });
  },

  logout: async () => {
    await fetch('/auth/v1/logout', { method: 'POST', credentials: 'include' });
    set({ user: null });
    window.location.href = '/login';
  },

  patchUser: (partial) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...partial } });
  },
}));
