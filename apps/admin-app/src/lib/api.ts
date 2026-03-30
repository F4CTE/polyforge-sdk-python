const API_BASE = '/api/v1';
const AUTH_BASE = '/auth/v1';

type QueryParams = Record<string, string | number | boolean | undefined>;

interface ApiError extends Error {
  status: number;
  body: unknown;
}

function buildUrl(base: string, path: string, params?: QueryParams): string {
  const url = new URL(`${base}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    // Redirect to login on 401 Unauthorized (expired/invalid session)
    if (res.status === 401 && !url.includes('/auth/')) {
      // Try to refresh the session first
      try {
        const refreshRes = await fetch(`${AUTH_BASE}/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (refreshRes.ok) {
          // Retry the original request
          return request<T>(url, options);
        }
      } catch {
        // refresh failed, fall through to redirect
      }
      // Import dynamically to avoid circular deps; show toast before redirect
      const { toast } = await import('sonner');
      toast.error('Session expired. Redirecting to login...');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
      // Reject the promise instead of never resolving to prevent hanging requests
      return Promise.reject(new Error('Session expired - redirecting to login'));
    }
    const body = await res.json().catch(() => ({}));
    const error: ApiError = Object.assign(new Error(typeof body === 'object' && body !== null && 'message' in body ? String(body.message) : res.statusText), {
      status: res.status,
      body,
    }) as ApiError;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (body: { email: string; password: string; totpCode?: string }) =>
    request<{ id: string; email: string; role: string; displayName: string }>(
      `${AUTH_BASE}/login`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  me: () =>
    request<{ id: string; email: string; role: string; displayName: string }>(
      `${AUTH_BASE}/me`,
    ),
  logout: () => request<void>(`${AUTH_BASE}/logout`, { method: 'POST' }),
};

// ─── API Response Types ────────────────────────────────────────────────────────

interface HealthData {
  status: string;
  services: Record<string, { status: string; latencyMs: number }>;
  db: { status: string; connections: number };
  redis: { status: string; memoryUsageMb: number };
}

interface RateLimitsData {
  totalTrackedKeys: number;
  recent429Count: number;
  topOffenders: Array<{ key: string; hits: number; ttl: number }>;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  [key: string]: unknown;
}

interface StrategyData {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface OrderData {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface BacktestData {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface CacheStatsData {
  keysCount: number;
  memoryUsageMb: number;
  [key: string]: unknown;
}

interface ReportData {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface BuilderStatsData {
  activeBuilders: number;
  totalStrategies: number;
  [key: string]: unknown;
}

interface AuditLogData {
  id: string;
  action: string;
  timestamp: string;
  [key: string]: unknown;
}

interface EventLogData {
  id: string;
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

interface LoginLogData {
  id: string;
  userId: string;
  timestamp: string;
  [key: string]: unknown;
}

interface InviteData {
  code: string;
  remainingUses: number;
  ttl: number;
}

interface TicketData {
  id: string;
  subject: string;
  status: string;
  [key: string]: unknown;
}

interface AdminData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active?: boolean;
  lastSeen?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface ApiKeyData {
  id: string;
  name: string;
  [key: string]: unknown;
}

// ─── Admin API ─────────────────────────────────────────────────────────────────

export const adminApi = {
  // Dashboard
  health: () => request<HealthData>(buildUrl(API_BASE, '/dashboard')),
  rateLimits: () => request<RateLimitsData>(buildUrl(API_BASE, '/dashboard/rate-limits')),
  config: () => request<{ inviteOnly: boolean }>(buildUrl(API_BASE, '/config')),
  setInviteOnly: (enabled: boolean) =>
    request<{ inviteOnly: boolean }>(buildUrl(API_BASE, '/config/invite-only'), {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  // Users
  users: (params?: QueryParams) =>
    request<PaginatedResponse<UserData>>(buildUrl(API_BASE, '/users', params)),
  user: (id: string) => request<UserData>(buildUrl(API_BASE, `/users/${id}`)),
  suspendUser: (id: string, reason: string) =>
    request<UserData>(buildUrl(API_BASE, `/users/${id}/suspend`), {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  unsuspendUser: (id: string) =>
    request<UserData>(buildUrl(API_BASE, `/users/${id}/unsuspend`), {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),
  approveUser: (id: string) =>
    request<UserData>(buildUrl(API_BASE, `/users/${id}/approve`), {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),
  rejectUser: (id: string, reason?: string) =>
    request<UserData>(buildUrl(API_BASE, `/users/${id}/reject`), {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  updateLimits: (id: string, limits: Record<string, number>) =>
    request<UserData>(buildUrl(API_BASE, `/users/${id}/limits`), {
      method: 'PATCH',
      body: JSON.stringify(limits),
    }),
  userApiKeys: (userId: string) =>
    request<PaginatedResponse<ApiKeyData>>(buildUrl(API_BASE, `/users/${userId}/api-keys`)),
  revokeUserApiKey: (userId: string, keyId: string) =>
    request<void>(buildUrl(API_BASE, `/users/${userId}/api-keys/${keyId}`), {
      method: 'DELETE',
    }),

  // Strategies
  strategies: (params?: QueryParams) =>
    request<PaginatedResponse<StrategyData>>(buildUrl(API_BASE, '/strategies', params)),
  forceStop: (id: string) =>
    request<StrategyData>(buildUrl(API_BASE, `/strategies/${id}/force-stop`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Orders
  orders: (params?: QueryParams) =>
    request<PaginatedResponse<OrderData>>(buildUrl(API_BASE, '/orders', params)),
  dlq: () => request<PaginatedResponse<OrderData>>(buildUrl(API_BASE, '/orders/dlq')),
  dlqReplay: (intentId: string) =>
    request<OrderData>(buildUrl(API_BASE, `/orders/dlq/${intentId}/replay`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  dlqDiscard: (intentId: string) =>
    request<OrderData>(buildUrl(API_BASE, `/orders/dlq/${intentId}/discard`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Backtests
  backtests: (params?: QueryParams) =>
    request<PaginatedResponse<BacktestData>>(buildUrl(API_BASE, '/backtests', params)),
  cancelBacktest: (id: string) =>
    request<BacktestData>(buildUrl(API_BASE, `/backtests/${id}/cancel`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Cache
  cacheStats: () => request<CacheStatsData>(buildUrl(API_BASE, '/cache/stats')),
  cacheFlush: (pattern: string) =>
    request<{ keysDeleted: number }>(
      buildUrl(API_BASE, `/cache/${encodeURIComponent(pattern)}`),
      { method: 'DELETE' },
    ),
  streamStats: () => request<{ streams: { name: string; length: number; groups: { name: unknown; consumers: number; pending: number }[]; error: boolean }[] }>(
    buildUrl(API_BASE, '/cache/streams'),
  ),

  // Reports
  reports: (params?: QueryParams) =>
    request<PaginatedResponse<ReportData>>(buildUrl(API_BASE, '/reports', params)),
  resolveReport: (id: string, status: string, adminNote?: string) =>
    request<ReportData>(buildUrl(API_BASE, `/reports/${id}`), {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote }),
    }),

  // Builder
  builderStats: () => request<BuilderStatsData>(buildUrl(API_BASE, '/builder/stats')),

  // Logs
  auditLogs: (params?: QueryParams) =>
    request<PaginatedResponse<AuditLogData>>(buildUrl(API_BASE, '/logs/audit', params)),
  eventLogs: (params?: QueryParams) =>
    request<PaginatedResponse<EventLogData>>(buildUrl(API_BASE, '/logs/events', params)),
  loginLogs: (params?: QueryParams) =>
    request<PaginatedResponse<LoginLogData>>(buildUrl(API_BASE, '/logs/logins', params)),

  // Invites
  generateInvites: (count: number, uses: number, ttlDays?: number) =>
    request<{ codes: string[] }>(buildUrl(API_BASE, '/invites'), {
      method: 'POST',
      body: JSON.stringify({ count, uses, ...(ttlDays ? { ttlDays } : {}) }),
    }),
  listInvites: () =>
    request<InviteData[]>(
      buildUrl(API_BASE, '/invites'),
    ),
  revokeInvite: (code: string) =>
    request<void>(
      buildUrl(API_BASE, `/invites/${encodeURIComponent(code)}`),
      { method: 'DELETE' },
    ),

  // Tickets
  tickets: (params?: QueryParams) =>
    request<PaginatedResponse<TicketData>>(buildUrl(API_BASE, '/tickets', params)),
  ticket: (id: string) => request<TicketData>(buildUrl(API_BASE, `/tickets/${id}`)),
  replyTicket: (id: string, body: string) =>
    request<TicketData>(buildUrl(API_BASE, `/tickets/${id}/messages`), {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  updateTicket: (id: string, data: Record<string, string>) =>
    request<TicketData>(buildUrl(API_BASE, `/tickets/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Admins
  listAdmins: () => request<AdminData[]>(buildUrl(API_BASE, '/admins')),
  createAdmin: (data: {
    email: string;
    displayName: string;
    password: string;
    role: string;
  }) =>
    request<AdminData>(buildUrl(API_BASE, '/admins'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAdmin: (id: string, data: Record<string, string | number | boolean>) =>
    request<AdminData>(buildUrl(API_BASE, `/admins/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deactivateAdmin: (id: string, password?: string) =>
    request<AdminData>(buildUrl(API_BASE, `/admins/${id}`), {
      method: 'DELETE',
      ...(password ? { body: JSON.stringify({ password }) } : {}),
    }),
};
