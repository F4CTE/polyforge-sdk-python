import { create } from "zustand";
import { identifyUser, resetAnalytics } from "../lib/analytics";
import { captureError, setSentryUser, clearSentryUser } from "../lib/sentry";

interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  status: "UNVERIFIED" | "VERIFIED" | "CONNECTED";
  polymarketConnected: boolean;
  polymarketRail?: "global" | "us";
  kalshiConnected: boolean;
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
  login: (body: {
    email: string;
    password: string;
    totpCode?: string;
  }) => Promise<void>;
  register: (body: {
    email: string;
    password: string;
    username: string;
    tosAccepted: boolean;
    inviteCode?: string;
  }) => Promise<void>;
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
    // Propagate transport errors to all callers (don't convert to false
    // which authedFetch would misinterpret as a server-rejected token).
    return refreshPromise ?? Promise.resolve(false);
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const res = await fetch("/auth/v1/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  })();

  try {
    return await refreshPromise;
  } catch (err) {
    console.error(
      "Token refresh failed:",
      err instanceof Error ? err.message : err,
    );
    throw err;
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
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      credentials: options.credentials ?? "include",
    });
  } catch (err) {
    console.error(
      "authedFetch failed:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }

  // If request succeeded or is not a 401, return as-is
  if (response.ok || response.status !== 401) {
    return response;
  }

  // Token expired: attempt refresh once
  let refreshed: boolean;
  try {
    refreshed = await refreshToken();
  } catch (err) {
    // Transport error during refresh — log and re-throw, don't force logout
    console.error(
      "Token refresh transport error:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }

  if (!refreshed) {
    // Server rejected the refresh token — force logout
    window.location.href = "/login";
    return response;
  }

  // Retry the original request with refreshed token
  try {
    return await fetch(url, {
      ...options,
      credentials: options.credentials ?? "include",
    });
  } catch (err) {
    console.error(
      "authedFetch retry failed:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
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
      let res = await fetch("/auth/v1/me", {
        credentials: "include",
        signal: controller.signal,
      });

      // If token expired, attempt refresh and retry
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          res = await fetch("/auth/v1/me", {
            credentials: "include",
            signal: controller.signal,
          });
        }
      }

      if (res.ok) {
        const user = await res.json();
        identifyUser(user.id, { email: user.email, username: user.username });
        set({ user, loading: false });
        setSentryUser(user.id, user.email, user.username);
      } else {
        set({ user: null, loading: false });
      }
    } catch (err) {
      console.error(
        "Auth init failed:",
        err instanceof Error ? err.message : err,
      );
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        captureError(err instanceof Error ? err : new Error(String(err)), {
          action: "auth:init",
        });
      }
      set({ user: null, loading: false });
    }
  },

  login: async (body) => {
    const res = await fetch("/auth/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw err;
    }
    const user = await res.json();
    identifyUser(user.id, { email: user.email, username: user.username });
    set({ user });
    setSentryUser(user.id, user.email, user.username);
  },

  register: async (body) => {
    const res = await fetch("/auth/v1/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw err;
    }
    const data = await res.json();
    if (data.pending) {
      // Don't set user — they can't access anything yet
      throw { code: "ACCOUNT_PENDING", message: "pending" };
    }
    set({ user: data.user ?? data });
  },

  logout: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
      try {
        await fetch("/auth/v1/logout", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
        });
      } catch (err) {
        // Continue local logout even if the network request is slow or fails.
        console.warn(
          "Logout request failed (continuing local cleanup):",
          err instanceof Error ? err.message : err,
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    } finally {
      resetAnalytics();
      clearSentryUser();
      try {
        localStorage.removeItem("access_token");
      } catch {
        // ignore — defensive scrub of any residual token from prior versions
      }
      set({ user: null, loading: false });
      window.location.assign("/login");
    }
  },

  patchUser: (partial) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...partial } });
  },

  refreshToken: async () => {
    return refreshToken();
  },
}));
