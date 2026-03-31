import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Ban,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate, formatDateTime } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  role: string;
  status: string;
  suspended: boolean;
  createdAt: string;
  lastSeen?: string;
  polymarketConnected?: boolean;
  totpEnabled?: boolean;
  tradeCount?: number;
  totalPnl?: number | string;
  winRate?: number | string;
  followerCount?: number;
  followingCount?: number;
  [key: string]: unknown;
}

interface RiskSettings {
  enabled?: boolean;
  dailyLossLimit?: number;
  maxPositionSize?: number;
  maxOpenPositions?: number;
  [key: string]: unknown;
}

interface OrderRow {
  id: string;
  createdAt?: string;
  market?: string;
  side?: string;
  outcome?: string;
  size?: number | string;
  price?: number | string;
  status?: string;
  [key: string]: unknown;
}

interface StrategyCard {
  id: string;
  name?: string;
  status?: string;
  createdAt?: string;
  tradeCount?: number;
  [key: string]: unknown;
}

type ActiveTab = 'overview' | 'orders' | 'strategies' | 'risk';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(displayName?: string, username?: string): string {
  const name = displayName || username || '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function fmtPnl(val?: number | string): string {
  if (val === undefined || val === null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtWinRate(val?: number | string): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'string') return val.includes('%') ? val : `${val}%`;
  return `${(val * 100).toFixed(1)}%`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams<{ id: string }>();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [riskSettings, setRiskSettings] = useState<RiskSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const ordersLimit = 10;

  const [strategies, setStrategies] = useState<StrategyCard[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesLoaded, setStrategiesLoaded] = useState(false);

  // ── Initial load: user profile + risk settings in parallel ──────────────────

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const [userRes, riskRes] = await Promise.all([
          adminApi.user(id!),
          fetch(`/api/v1/users/${id}/risk-settings`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        const u = userRes as unknown as UserProfile;
        // Normalise counts that may be nested under _count
        const raw = userRes as any;
        if (raw._count) {
          u.tradeCount = u.tradeCount ?? raw._count.orders ?? raw._count.trades ?? 0;
          u.followerCount = u.followerCount ?? raw._count.followers ?? 0;
          u.followingCount = u.followingCount ?? raw._count.following ?? 0;
        }
        setUser(u);
        setRiskSettings(riskRes as RiskSettings | null);
      } catch {
        toast.error('Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Lazy: orders ────────────────────────────────────────────────────────────

  async function loadOrders(page = 1) {
    if (!id) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(
        `/api/v1/users/${id}/orders?limit=${ordersLimit}&page=${page}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : (data.data ?? []));
        setOrdersTotal(data.total ?? data.data?.length ?? 0);
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
      setOrdersLoaded(true);
    }
  }

  // ── Lazy: strategies ────────────────────────────────────────────────────────

  async function loadStrategies() {
    if (!id) return;
    setStrategiesLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${id}/strategies?limit=5`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStrategies(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch {
      toast.error('Failed to load strategies');
    } finally {
      setStrategiesLoading(false);
      setStrategiesLoaded(true);
    }
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === 'orders' && !ordersLoaded) loadOrders(1);
    if (tab === 'strategies' && !strategiesLoaded) loadStrategies();
  }

  function handleOrdersPage(next: number) {
    setOrdersPage(next);
    loadOrders(next);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleSuspend() {
    if (!id || !user) return;
    if (!window.confirm(`Suspend ${user.username}? This will prevent them from logging in.`)) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/users/${id}/suspend`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setUser((u) => (u ? { ...u, suspended: true, status: 'SUSPENDED' } : u));
      toast.success('User suspended');
    } catch {
      toast.error('Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnsuspend() {
    if (!id || !user) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/users/${id}/unsuspend`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setUser((u) => (u ? { ...u, suspended: false, status: 'ACTIVE' } : u));
      toast.success('User unsuspended');
    } catch {
      toast.error('Failed to unsuspend user');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!id) return;
    setActionLoading(true);
    try {
      await fetch(`/api/v1/users/${id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      toast.success('Password reset email sent');
    } catch {
      toast.error('Failed to send password reset');
    } finally {
      setActionLoading(false);
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" role="status" aria-label="Loading user details">
        <div className="h-4 bg-pf-elevated rounded w-28" />
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-pf-base" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-pf-base rounded w-48" />
              <div className="h-4 bg-pf-base rounded w-64" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-pf-base rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-pf-text-secondary">User not found</p>
        <Link
          to="/users"
          className="mt-4 inline-block text-sm text-pf-cyan-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded"
        >
          Back to users
        </Link>
      </div>
    );
  }

  const isSuspended = user.suspended || user.status?.toUpperCase() === 'SUSPENDED';
  const ordersPageCount = Math.ceil(ordersTotal / ordersLimit) || 1;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back link */}
      <Link
        to="/users"
        className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded-pf-sm"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Back to users
      </Link>

      {/* ── Section 1: Profile Header Card ─────────────────────────────────── */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          {/* Avatar + identity */}
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-full bg-pf-cyan-500/20 text-pf-cyan-400 flex items-center justify-center text-xl font-bold shrink-0 select-none"
              aria-hidden="true"
            >
              {getInitials(user.displayName, user.username)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-pf-text leading-tight">
                {user.displayName || user.username}
              </h2>
              <p className="text-sm text-pf-text-secondary">@{user.username}</p>
              <p className="text-sm text-pf-text-tertiary">{user.email}</p>

              {/* Status + badges */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(
                    isSuspended ? 'SUSPENDED' : user.status,
                  )}`}
                >
                  {isSuspended ? 'SUSPENDED' : (user.status || 'ACTIVE')}
                </span>
                {user.polymarketConnected && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-cyan-400 bg-cyan-400/10">
                    Polymarket Connected
                  </span>
                )}
                {(user.totpEnabled) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-pf-success bg-pf-success/10">
                    2FA Enabled
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isSuspended ? (
              <button
                type="button"
                onClick={handleUnsuspend}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm border border-pf-success text-pf-success hover:bg-pf-success/10 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-success"
              >
                <UserCheck size={14} aria-hidden="true" />
                Unsuspend
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSuspend}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm border border-pf-danger text-pf-danger hover:bg-pf-danger/10 disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
              >
                <Ban size={14} aria-hidden="true" />
                Suspend
              </button>
            )}
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-base hover:text-pf-text disabled:opacity-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reset Password
            </button>
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-pf-border">
          <div className="bg-pf-base border border-pf-border rounded-pf-sm px-4 py-3 text-center">
            <div className="text-xs text-pf-text-tertiary mb-0.5">Trades</div>
            <div className="text-lg font-bold text-pf-text">
              {(user.tradeCount ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-pf-base border border-pf-border rounded-pf-sm px-4 py-3 text-center">
            <div className="text-xs text-pf-text-tertiary mb-0.5">Total P&amp;L</div>
            <div
              className={`text-lg font-bold ${
                typeof user.totalPnl === 'number' && user.totalPnl < 0
                  ? 'text-pf-danger'
                  : 'text-pf-success'
              }`}
            >
              {fmtPnl(user.totalPnl)}
            </div>
          </div>
          <div className="bg-pf-base border border-pf-border rounded-pf-sm px-4 py-3 text-center">
            <div className="text-xs text-pf-text-tertiary mb-0.5">Win Rate</div>
            <div className="text-lg font-bold text-pf-text">{fmtWinRate(user.winRate)}</div>
          </div>
          <div className="bg-pf-base border border-pf-border rounded-pf-sm px-4 py-3 text-center">
            <div className="text-xs text-pf-text-tertiary mb-0.5">Followers</div>
            <div className="text-lg font-bold text-pf-text">
              {(user.followerCount ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Tabs ────────────────────────────────────────────────── */}
      <div>
        <div className="flex gap-1 border-b border-pf-border mb-4" role="tablist" aria-label="User detail sections">
          {(['overview', 'orders', 'strategies', 'risk'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded-t-pf-sm -mb-px border-b-2 ${
                activeTab === tab
                  ? 'border-pf-cyan-500 text-pf-cyan-500'
                  : 'border-transparent text-pf-text-secondary hover:text-pf-text'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Overview tab ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Risk settings summary */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={16} className="text-pf-cyan-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-pf-text">Risk Settings</h3>
                {riskSettings?.enabled !== undefined && (
                  <span
                    className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                      riskSettings.enabled
                        ? 'text-pf-success bg-pf-success/10'
                        : 'text-pf-text-tertiary bg-pf-base'
                    }`}
                  >
                    {riskSettings.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                )}
              </div>
              {riskSettings ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Daily Loss Limit</div>
                    <div className="text-pf-text font-medium">
                      {riskSettings.dailyLossLimit !== undefined
                        ? `$${Number(riskSettings.dailyLossLimit).toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Max Position Size</div>
                    <div className="text-pf-text font-medium">
                      {riskSettings.maxPositionSize !== undefined
                        ? `$${Number(riskSettings.maxPositionSize).toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Max Open Positions</div>
                    <div className="text-pf-text font-medium">
                      {riskSettings.maxOpenPositions ?? '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-pf-text-tertiary">No risk settings configured</p>
              )}
            </div>

            {/* Account details */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
              <h3 className="text-sm font-semibold text-pf-text mb-4">Account Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-pf-text-tertiary mb-0.5">Joined</div>
                  <div className="text-pf-text">{formatDate(user.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-pf-text-tertiary mb-0.5">Last Active</div>
                  <div className="text-pf-text">
                    {user.lastSeen ? formatDateTime(user.lastSeen) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-pf-text-tertiary mb-0.5">Role</div>
                  <div className="text-pf-text capitalize">{user.role}</div>
                </div>
                <div>
                  <div className="text-xs text-pf-text-tertiary mb-0.5">Following</div>
                  <div className="text-pf-text">{(user.followingCount ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-pf-text-tertiary mb-0.5">Polymarket</div>
                  <div className="text-pf-text">
                    {user.polymarketConnected ? 'Connected' : 'Not connected'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-pf-text-tertiary mb-0.5">2FA</div>
                  <div className="text-pf-text">
                    {user.totpEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Orders tab ────────────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Recent orders</caption>
                <thead>
                  <tr className="border-b border-pf-border">
                    {['Date', 'Market', 'Side', 'Outcome', 'Size', 'Price', 'Status'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-pf-base rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10">
                        <p className="text-pf-text-secondary">No orders found</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="border-b border-pf-border last:border-0">
                        <td className="px-4 py-3 text-pf-text-tertiary whitespace-nowrap">
                          {order.createdAt ? formatDate(order.createdAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-pf-text max-w-[200px] truncate">
                          {String(order.market ?? '—')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              String(order.side).toUpperCase() === 'BUY'
                                ? 'text-pf-success bg-pf-success/10'
                                : 'text-pf-danger bg-pf-danger/10'
                            }`}
                          >
                            {String(order.side ?? '—').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-pf-text-secondary">
                          {String(order.outcome ?? '—')}
                        </td>
                        <td className="px-4 py-3 text-pf-text-secondary">
                          {order.size !== undefined ? Number(order.size).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-pf-text-secondary">
                          {order.price !== undefined
                            ? `$${Number(order.price).toFixed(4)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(
                              String(order.status ?? ''),
                            )}`}
                          >
                            {String(order.status ?? '—')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Orders pagination */}
            {ordersLoaded && ordersPageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-pf-border">
                <span className="text-xs text-pf-text-tertiary">
                  Page {ordersPage} of {ordersPageCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOrdersPage(ordersPage - 1)}
                    disabled={ordersPage === 1 || ordersLoading}
                    aria-label="Previous page"
                    className="p-1.5 rounded hover:bg-pf-base text-pf-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOrdersPage(ordersPage + 1)}
                    disabled={ordersPage === ordersPageCount || ordersLoading}
                    aria-label="Next page"
                    className="p-1.5 rounded hover:bg-pf-base text-pf-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Strategies tab ────────────────────────────────────────────────── */}
        {activeTab === 'strategies' && (
          <div>
            {strategiesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse space-y-3"
                  >
                    <div className="h-4 bg-pf-base rounded w-3/4" />
                    <div className="h-3 bg-pf-base rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : strategies.length === 0 ? (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-10 text-center">
                <p className="text-pf-text-secondary">No strategies found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {strategies.map((s) => (
                    <div
                      key={s.id}
                      className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-pf-text truncate">
                          {String(s.name ?? 'Unnamed Strategy')}
                        </span>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(
                            String(s.status ?? ''),
                          )}`}
                        >
                          {String(s.status ?? '—')}
                        </span>
                      </div>
                      <div className="text-xs text-pf-text-tertiary">
                        Created {s.createdAt ? formatDate(s.createdAt) : '—'}
                      </div>
                      {s.tradeCount !== undefined && (
                        <div className="text-xs text-pf-text-tertiary mt-0.5">
                          {s.tradeCount.toLocaleString()} trades
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Link
                  to="/strategies"
                  className="inline-flex items-center gap-1 text-sm text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 rounded"
                >
                  View all strategies
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Risk tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'risk' && (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-pf-cyan-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-pf-text">Risk Configuration</h3>
              <span className="ml-auto text-xs text-pf-text-tertiary italic">Read-only admin view</span>
            </div>
            {riskSettings ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Daily Loss Limit</div>
                    <div className="text-pf-text font-medium">
                      {riskSettings.dailyLossLimit !== undefined
                        ? `$${Number(riskSettings.dailyLossLimit).toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Max Position Size</div>
                    <div className="text-pf-text font-medium">
                      {riskSettings.maxPositionSize !== undefined
                        ? `$${Number(riskSettings.maxPositionSize).toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Max Open Positions</div>
                    <div className="text-pf-text font-medium">
                      {riskSettings.maxOpenPositions ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-pf-text-tertiary mb-0.5">Risk Controls</div>
                    <div
                      className={`font-medium ${
                        riskSettings.enabled ? 'text-pf-success' : 'text-pf-text-tertiary'
                      }`}
                    >
                      {riskSettings.enabled !== undefined
                        ? riskSettings.enabled
                          ? 'Enabled'
                          : 'Disabled'
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Extra fields */}
                {Object.entries(riskSettings)
                  .filter(
                    ([k]) =>
                      !['enabled', 'dailyLossLimit', 'maxPositionSize', 'maxOpenPositions'].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2 border-t border-pf-border text-sm">
                      <span className="text-pf-text-tertiary capitalize">
                        {k.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-pf-text font-medium">{String(v ?? '—')}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-pf-text-tertiary">No risk settings configured</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
