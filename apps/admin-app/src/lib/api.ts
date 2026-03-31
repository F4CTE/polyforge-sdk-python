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

interface ServiceHealth {
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  latencyMs: number | null;
  uptime: number | null;
  version?: string;
  lastChecked: string;
  errorMessage?: string;
}

interface QueueHealth {
  name: string;
  depth: number;
  processedPerMin: number;
  consumerCount: number;
  oldestMessageAge?: number;
}

interface DbHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number | null;
  activeConnections: number;
  maxConnections: number;
  pendingMigrations: number;
  redisStatus: 'UP' | 'DOWN';
  redisLatencyMs: number | null;
  redisMemoryMb: number | null;
}

interface HealthStatusData {
  services: ServiceHealth[];
  queues: QueueHealth[];
  database: DbHealth;
  timestamp: string;
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

export interface Listing {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELISTED';
  featured: boolean;
  seller: { id: string; username: string; displayName: string | null };
  strategy: { id: string; name: string; winRate?: string; tradeCount?: number };
  createdAt: string;
  reviewedAt?: string;
  adminNote?: string;
  purchaseCount: number;
  forkCount: number;
  avgRating?: string;
}

export interface Report {
  id: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  reason: string;
  description?: string;
  contentType: 'STRATEGY' | 'REVIEW' | 'USER' | 'COMMENT';
  contentId: string;
  contentPreview?: string;
  reporter: { id: string; username: string; displayName: string | null };
  reported: { id: string; username: string; displayName: string | null };
  createdAt: string;
  resolvedAt?: string;
  adminNote?: string;
}

type ReportData = Report;

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

interface BroadcastData {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'PROMO';
  targetAudience: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'PREMIUM';
  sentAt: string;
  recipientCount: number;
  sentBy: string;
}

export interface AdminMarket {
  id: string;
  slug: string;
  question: string;
  category: string;
  status: 'ACTIVE' | 'RESOLVED' | 'DELISTED' | 'PENDING';
  featured: boolean;
  volume24h: string;
  totalVolume: string;
  participantCount: number;
  yesPrice: string;
  noPrice: string;
  endDate: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionValue?: string;
}

// ─── Admin API ─────────────────────────────────────────────────────────────────

export const adminApi = {
  // Dashboard
  health: () => request<HealthData>(buildUrl(API_BASE, '/dashboard')),
  healthStatus: () => request<HealthStatusData>(buildUrl('/api/admin', '/health')),
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
  setFeatured: (id: string, featured: boolean) =>
    request<StrategyData>(buildUrl('/api/admin', `/strategies/${id}`), {
      method: 'PATCH',
      body: JSON.stringify({ featured }),
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
    request<PaginatedResponse<BacktestData>>(buildUrl('/api/admin', '/backtests', params)),
  cancelBacktest: (id: string) =>
    request<void>(buildUrl('/api/admin', `/backtests/${id}`), {
      method: 'DELETE',
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
    request<PaginatedResponse<Report>>(buildUrl(API_BASE, '/reports', params)),
  actionReport: (id: string, action: 'DISMISS' | 'REMOVE_CONTENT' | 'WARN_USER' | 'BAN_USER', adminNote?: string) =>
    request<Report>(buildUrl(API_BASE, `/reports/${id}`), {
      method: 'PATCH',
      body: JSON.stringify({ action, ...(adminNote ? { adminNote } : {}) }),
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

  // Platform Stats
  platformStats: () =>
    request<{ totalNewsSignals: number; marketsWithSentiment: number; totalLpOrders: number; resolvedPositions: number }>(
      buildUrl(API_BASE, '/dashboard/platform-stats')
    ),

  monthlyRevenue: (months: number) =>
    request<{ data: Array<{ month: string; revenue: number; fees: number; purchases: number }> }>(
      buildUrl(API_BASE, '/admin/revenue/monthly', { months }),
    ),

  marketplaceStats: () =>
    request<{
      totalListings: number;
      activeListings: number;
      totalPurchases: number;
      totalRevenue: number;
      platformFeeTotal: number;
      topListings: Array<{
        id: string; title: string; priceUsdc: string; purchaseCount: number;
        forkCount: number; avgRating: string | null; ratingCount: number;
        totalRevenue: string; seller: { username: string; displayName: string | null };
      }>;
      recentPurchases: Array<{
        id: string; priceUsdc: string; platformFee: string; sellerNet: string;
        createdAt: string; listing: { title: string };
      }>;
    }>(buildUrl(API_BASE, '/dashboard/marketplace-stats')),

  // User Accuracy
  userAccuracy: (userId: string) =>
    request<{ brierScore: number | null; totalPredictions: number; correctPredictions: number; winRate: string; calibration: unknown[]; byCategory: unknown }>(
      buildUrl(API_BASE, `/users/${userId}/accuracy`)
    ),

  // Sentiment Overview
  sentimentOverview: (params?: QueryParams) =>
    request<Array<{ marketId: string; marketTitle: string; score: number; label: string; signalCount: number; bullishCount: number; bearishCount: number; lastUpdated: string }>>(
      buildUrl(API_BASE, '/sentiment', params)
    ),

  sentimentSummary: () =>
    request<{
      totalMarkets: number;
      bullishCount: number;
      bearishCount: number;
      neutralCount: number;
      avgScore: number;
      mostBullishCategory: string;
      mostBearishCategory: string;
      trendingTopics: string[];
    }>(buildUrl('/api/admin', '/sentiment/summary')),

  sentimentByCategory: () =>
    request<{
      data: Array<{
        category: string;
        bullishCount: number;
        bearishCount: number;
        neutralCount: number;
        avgScore: number;
      }>;
    }>(buildUrl('/api/admin', '/sentiment/by-category')),

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

  // Listings
  listings: (params?: QueryParams) =>
    request<PaginatedResponse<Listing>>(buildUrl('/api/admin', '/listings', params)),
  reviewListing: (id: string, data: { status?: 'APPROVED' | 'REJECTED' | 'DELISTED'; adminNote?: string; featured?: boolean }) =>
    request<Listing>(buildUrl('/api/admin', `/listings/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Collections
  collections: (params?: QueryParams) =>
    request<{ data: Array<{ id: string; title: string; description: string; emoji: string; listingCount: number; totalVolume: string; avgWinRate: string; createdAt: string }> }>(
      buildUrl('/api/v1/marketplace', '/collections', params),
    ),
  collection: (id: string) =>
    request<{ collection: { id: string; title: string; description: string; emoji: string; listingCount: number; totalVolume: string; avgWinRate: string; createdAt: string }; listings: Listing[] }>(
      buildUrl('/api/v1/marketplace', `/collections/${id}`),
    ),

  // Markets
  markets: (params?: QueryParams) =>
    request<{ data: AdminMarket[]; total: number; totalPages: number }>(
      buildUrl('/api/admin', '/markets', params),
    ),
  updateMarket: (id: string, data: { featured?: boolean; status?: 'ACTIVE' | 'RESOLVED' | 'DELISTED' }) =>
    request<AdminMarket>(buildUrl('/api/admin', `/markets/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Broadcasts
  broadcasts: (params?: QueryParams) =>
    request<{ data: BroadcastData[]; total: number }>(buildUrl('/api/admin', '/broadcasts', params)),
  sendBroadcast: (data: { title: string; message: string; type: string; targetAudience: string }) =>
    request<BroadcastData>(buildUrl('/api/admin', '/broadcasts'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteBroadcast: (id: string) =>
    request<void>(buildUrl('/api/admin', `/broadcasts/${id}`), {
      method: 'DELETE',
    }),

  // Retention
  retentionOverview: () =>
    request<{
      dau: number;
      wau: number;
      mau: number;
      dauWauRatio: number;
      wauMauRatio: number;
      newUsersToday: number;
      newUsersWeek: number;
      churnRate: number;
    }>(buildUrl(API_BASE, '/admin/retention/overview')),

  retentionTrend: (days: number) =>
    request<{ data: Array<{ date: string; dau: number; newUsers: number; returningUsers: number }> }>(
      buildUrl(API_BASE, '/admin/retention/trend', { days }),
    ),

  retentionCohorts: (months: number) =>
    request<{ data: Array<{ cohort: string; size: number; retention: number[] }> }>(
      buildUrl(API_BASE, '/admin/retention/cohorts', { months }),
    ),
};
