const API_BASE = '/api/v1';
const AUTH_BASE = '/auth/v1';

type QueryParams = Record<string, string | number | boolean | undefined>;

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
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || res.statusText), {
      status: res.status,
      body,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (body: { email: string; password: string }) =>
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

// ─── Admin API ─────────────────────────────────────────────────────────────────

export const adminApi = {
  // Dashboard
  health: () => request<any>(buildUrl(API_BASE, '/dashboard')),
  config: () => request<{ inviteOnly: boolean }>(buildUrl(API_BASE, '/config')),
  setInviteOnly: (enabled: boolean) =>
    request<{ inviteOnly: boolean }>(buildUrl(API_BASE, '/config/invite-only'), {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  // Users
  users: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/users', params)),
  user: (id: string) => request<any>(buildUrl(API_BASE, `/users/${id}`)),
  suspendUser: (id: string, reason: string) =>
    request<any>(buildUrl(API_BASE, `/users/${id}/suspend`), {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  unsuspendUser: (id: string) =>
    request<any>(buildUrl(API_BASE, `/users/${id}/unsuspend`), {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),
  updateLimits: (id: string, limits: Record<string, number>) =>
    request<any>(buildUrl(API_BASE, `/users/${id}/limits`), {
      method: 'PATCH',
      body: JSON.stringify(limits),
    }),
  userApiKeys: (userId: string) =>
    request<any[]>(buildUrl(API_BASE, `/users/${userId}/api-keys`)),
  revokeUserApiKey: (userId: string, keyId: string) =>
    request<void>(buildUrl(API_BASE, `/users/${userId}/api-keys/${keyId}`), {
      method: 'DELETE',
    }),

  // Strategies
  strategies: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/strategies', params)),
  forceStop: (id: string) =>
    request<any>(buildUrl(API_BASE, `/strategies/${id}/force-stop`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Orders
  orders: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/orders', params)),
  dlq: () => request<any[]>(buildUrl(API_BASE, '/orders/dlq')),
  dlqReplay: (intentId: string) =>
    request<any>(buildUrl(API_BASE, `/orders/dlq/${intentId}/replay`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  dlqDiscard: (intentId: string) =>
    request<any>(buildUrl(API_BASE, `/orders/dlq/${intentId}/discard`), {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Backtests
  backtests: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/backtests', params)),

  // Cache
  cacheStats: () => request<any>(buildUrl(API_BASE, '/cache/stats')),
  cacheFlush: (pattern: string) =>
    request<{ keysDeleted: number }>(
      buildUrl(API_BASE, `/cache/${encodeURIComponent(pattern)}`),
      { method: 'DELETE' },
    ),

  // Reports
  reports: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/reports', params)),
  resolveReport: (id: string, status: string, adminNote?: string) =>
    request<any>(buildUrl(API_BASE, `/reports/${id}`), {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote }),
    }),

  // Builder
  builderStats: () => request<any>(buildUrl(API_BASE, '/builder/stats')),

  // Logs
  auditLogs: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/logs/audit', params)),
  eventLogs: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/logs/events', params)),
  loginLogs: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/logs/logins', params)),

  // Invites
  generateInvites: (count: number, uses: number, ttlDays?: number) =>
    request<{ codes: string[] }>(buildUrl(API_BASE, '/invites'), {
      method: 'POST',
      body: JSON.stringify({ count, uses, ...(ttlDays ? { ttlDays } : {}) }),
    }),
  listInvites: () =>
    request<{ code: string; remainingUses: number; ttl: number }[]>(
      buildUrl(API_BASE, '/invites'),
    ),
  revokeInvite: (code: string) =>
    request<void>(
      buildUrl(API_BASE, `/invites/${encodeURIComponent(code)}`),
      { method: 'DELETE' },
    ),

  // Tickets
  tickets: (params?: QueryParams) =>
    request<any>(buildUrl(API_BASE, '/tickets', params)),
  ticket: (id: string) => request<any>(buildUrl(API_BASE, `/tickets/${id}`)),
  replyTicket: (id: string, body: string) =>
    request<any>(buildUrl(API_BASE, `/tickets/${id}/messages`), {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  updateTicket: (id: string, data: Record<string, string>) =>
    request<any>(buildUrl(API_BASE, `/tickets/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Admins
  listAdmins: () => request<any[]>(buildUrl(API_BASE, '/admins')),
  createAdmin: (data: {
    email: string;
    displayName: string;
    password: string;
    role: string;
  }) =>
    request<any>(buildUrl(API_BASE, '/admins'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAdmin: (id: string, data: Record<string, any>) =>
    request<any>(buildUrl(API_BASE, `/admins/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deactivateAdmin: (id: string) =>
    request<any>(buildUrl(API_BASE, `/admins/${id}`), { method: 'DELETE' }),
};
