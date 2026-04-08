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

export interface AuthState {
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
  refreshToken: () => Promise<boolean>;
}

// Mutex to prevent concurrent refresh calls
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the JWT access token using the refresh token cookie
 */
async function refreshToken(): Promise<boolean> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing) {
    return refreshPromise || Promise.resolve(false);
  }

  isRefreshing = true;
  try {
    refreshPromise = (async () => {
      const res = await fetch('/auth/v1/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    })();

    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

/**
 * Fetch wrapper that handles 401 responses by attempting token refresh
 * Redirects to login if both the original request and refresh fail
 */
export async function authedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
  });

  // If request succeeded or is not a 401, return as-is
  if (response.ok || response.status !== 401) {
    return response;
  }

  // Token expired: attempt refresh once
  const refreshed = await refreshToken();
  if (!refreshed) {
    // Refresh failed, redirect to login
    window.location.href = '/login';
    return response;
  }

  // Retry the original request with refreshed token
  return fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
  });
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
      let res = await fetch('/auth/v1/me', {
        credentials: 'include',
        signal: controller.signal,
      });

      // If token expired, attempt refresh and retry
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          res = await fetch('/auth/v1/me', {
            credentials: 'include',
            signal: controller.signal,
          });
        }
      }

      if (res.ok) {
        const user = await res.json();
        set({ user, loading: false });
      } else {
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
    const data = await res.json();
    if (data.pending) {
      // Don't set user — they can't access anything yet
      throw { code: 'ACCOUNT_PENDING', message: 'pending' };
    }
    set({ user: data.user ?? data });
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

  refreshToken: async () => {
    return refreshToken();
  },
}));
