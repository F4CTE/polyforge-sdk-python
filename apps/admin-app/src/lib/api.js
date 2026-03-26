const API_BASE = '/api/v1';
const AUTH_BASE = '/auth/v1';
function buildUrl(base, path, params) {
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
async function request(url, options) {
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
                    return request(url, options);
                }
            }
            catch {
                // refresh failed, fall through to redirect
            }
            // Import dynamically to avoid circular deps; show toast before redirect
            const { toast } = await import('sonner');
            toast.error('Session expired. Redirecting to login...');
            setTimeout(() => { window.location.href = '/login'; }, 1500);
            return new Promise(() => { }); // never resolves; page is navigating
        }
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || res.statusText), {
            status: res.status,
            body,
        });
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
    login: (body) => request(`${AUTH_BASE}/login`, { method: 'POST', body: JSON.stringify(body) }),
    me: () => request(`${AUTH_BASE}/me`),
    logout: () => request(`${AUTH_BASE}/logout`, { method: 'POST' }),
};
// ─── Admin API ─────────────────────────────────────────────────────────────────
export const adminApi = {
    // Dashboard
    health: () => request(buildUrl(API_BASE, '/dashboard')),
    rateLimits: () => request(buildUrl(API_BASE, '/dashboard/rate-limits')),
    config: () => request(buildUrl(API_BASE, '/config')),
    setInviteOnly: (enabled) => request(buildUrl(API_BASE, '/config/invite-only'), {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    }),
    // Users
    users: (params) => request(buildUrl(API_BASE, '/users', params)),
    user: (id) => request(buildUrl(API_BASE, `/users/${id}`)),
    suspendUser: (id, reason) => request(buildUrl(API_BASE, `/users/${id}/suspend`), {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    }),
    unsuspendUser: (id) => request(buildUrl(API_BASE, `/users/${id}/unsuspend`), {
        method: 'PATCH',
        body: JSON.stringify({}),
    }),
    updateLimits: (id, limits) => request(buildUrl(API_BASE, `/users/${id}/limits`), {
        method: 'PATCH',
        body: JSON.stringify(limits),
    }),
    userApiKeys: (userId) => request(buildUrl(API_BASE, `/users/${userId}/api-keys`)),
    revokeUserApiKey: (userId, keyId) => request(buildUrl(API_BASE, `/users/${userId}/api-keys/${keyId}`), {
        method: 'DELETE',
    }),
    // Strategies
    strategies: (params) => request(buildUrl(API_BASE, '/strategies', params)),
    forceStop: (id) => request(buildUrl(API_BASE, `/strategies/${id}/force-stop`), {
        method: 'POST',
        body: JSON.stringify({}),
    }),
    // Orders
    orders: (params) => request(buildUrl(API_BASE, '/orders', params)),
    dlq: () => request(buildUrl(API_BASE, '/orders/dlq')),
    dlqReplay: (intentId) => request(buildUrl(API_BASE, `/orders/dlq/${intentId}/replay`), {
        method: 'POST',
        body: JSON.stringify({}),
    }),
    dlqDiscard: (intentId) => request(buildUrl(API_BASE, `/orders/dlq/${intentId}/discard`), {
        method: 'POST',
        body: JSON.stringify({}),
    }),
    // Backtests
    backtests: (params) => request(buildUrl(API_BASE, '/backtests', params)),
    cancelBacktest: (id) => request(buildUrl(API_BASE, `/backtests/${id}/cancel`), {
        method: 'POST',
        body: JSON.stringify({}),
    }),
    // Cache
    cacheStats: () => request(buildUrl(API_BASE, '/cache/stats')),
    cacheFlush: (pattern) => request(buildUrl(API_BASE, `/cache/${encodeURIComponent(pattern)}`), { method: 'DELETE' }),
    // Reports
    reports: (params) => request(buildUrl(API_BASE, '/reports', params)),
    resolveReport: (id, status, adminNote) => request(buildUrl(API_BASE, `/reports/${id}`), {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote }),
    }),
    // Builder
    builderStats: () => request(buildUrl(API_BASE, '/builder/stats')),
    // Logs
    auditLogs: (params) => request(buildUrl(API_BASE, '/logs/audit', params)),
    eventLogs: (params) => request(buildUrl(API_BASE, '/logs/events', params)),
    loginLogs: (params) => request(buildUrl(API_BASE, '/logs/logins', params)),
    // Invites
    generateInvites: (count, uses, ttlDays) => request(buildUrl(API_BASE, '/invites'), {
        method: 'POST',
        body: JSON.stringify({ count, uses, ...(ttlDays ? { ttlDays } : {}) }),
    }),
    listInvites: () => request(buildUrl(API_BASE, '/invites')),
    revokeInvite: (code) => request(buildUrl(API_BASE, `/invites/${encodeURIComponent(code)}`), { method: 'DELETE' }),
    // Tickets
    tickets: (params) => request(buildUrl(API_BASE, '/tickets', params)),
    ticket: (id) => request(buildUrl(API_BASE, `/tickets/${id}`)),
    replyTicket: (id, body) => request(buildUrl(API_BASE, `/tickets/${id}/messages`), {
        method: 'POST',
        body: JSON.stringify({ body }),
    }),
    updateTicket: (id, data) => request(buildUrl(API_BASE, `/tickets/${id}`), {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    // Admins
    listAdmins: () => request(buildUrl(API_BASE, '/admins')),
    createAdmin: (data) => request(buildUrl(API_BASE, '/admins'), {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateAdmin: (id, data) => request(buildUrl(API_BASE, `/admins/${id}`), {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
    deactivateAdmin: (id, password) => request(buildUrl(API_BASE, `/admins/${id}`), {
        method: 'DELETE',
        ...(password ? { body: JSON.stringify({ password }) } : {}),
    }),
};
