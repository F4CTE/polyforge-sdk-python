import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';
import {
  Users,
  Blocks,
  ShoppingCart,
  TicketCheck,
  Activity,
  Database,
  Server,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Clock,
  ShieldAlert,
  Newspaper,
  BarChart2,
  Layers,
  CheckSquare,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, timeAgo } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

interface HealthData {
  status: string;
  services: Record<string, { status: string; latencyMs: number }>;
  db: { status: string; connections: number };
  redis: { status: string; memoryUsageMb: number };
}

interface AuditLogEntry {
  id: string;
  action: string;
  target?: string;
  targetId?: string;
  createdAt: string;
}

export function Component() {
  const { isSuperAdmin } = useAdminAuthStore();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [config, setConfig] = useState<{ inviteOnly: boolean } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeStrategies: 0,
    totalOrders: 0,
    openTickets: 0,
  });
  const [rateLimits, setRateLimits] = useState<{
    totalTrackedKeys: number;
    recent429Count: number;
    topOffenders: { key: string; hits: number; ttl: number }[];
  } | null>(null);
  const [platformStats, setPlatformStats] = useState<{
    totalNewsSignals: number;
    marketsWithSentiment: number;
    totalLpOrders: number;
    resolvedPositions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthError, setHealthError] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const [rateLimitsError, setRateLimitsError] = useState(false);
  const [platformStatsError, setPlatformStatsError] = useState(false);

  async function load() {
    setLoading(true);
    setHealthError(false);
    setStatsError(false);
    setLogsError(false);
    setRateLimitsError(false);
    setPlatformStatsError(false);

    // Fetch all independent API calls in parallel
    const [healthResult, configResult, statsResult, logsResult, rlResult, platformStatsResult] =
      await Promise.allSettled([
        adminApi.health(),
        adminApi.config(),
        Promise.all([
          adminApi.users({ limit: 1 }),
          adminApi.strategies({ limit: 1, status: 'RUNNING' }),
          adminApi.orders({ limit: 1 }),
          adminApi.tickets({ limit: 1, status: 'OPEN' }),
        ]),
        adminApi.auditLogs({ limit: 5 }),
        adminApi.rateLimits(),
        adminApi.platformStats(),
      ]);

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value ?? null);
    else setHealthError(true);

    if (configResult.status === 'fulfilled') setConfig(configResult.value ?? null);

    if (statsResult.status === 'fulfilled') {
      const [usersRes, strategiesRes, ordersRes, ticketsRes] = statsResult.value;
      setStats({
        totalUsers: usersRes?.total ?? 0,
        activeStrategies: strategiesRes?.total ?? 0,
        totalOrders: ordersRes?.total ?? 0,
        openTickets: ticketsRes?.total ?? 0,
      });
    } else { setStatsError(true); }

    if (logsResult.status === 'fulfilled') {
      setAuditLogs(Array.isArray(logsResult.value?.data) ? logsResult.value.data as unknown as AuditLogEntry[] : []);
    } else { setLogsError(true); }

    if (rlResult.status === 'fulfilled') setRateLimits(rlResult.value);
    else setRateLimitsError(true);

    if (platformStatsResult.status === 'fulfilled') setPlatformStats(platformStatsResult.value ?? null);
    else setPlatformStatsError(true);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleInviteOnly() {
    if (!config) return;
    try {
      const res = await adminApi.setInviteOnly(!config.inviteOnly);
      setConfig(res);
      toast.success(`Invite-only ${res.inviteOnly ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update config');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse">
              <div className="h-3 bg-pf-base rounded w-24 mb-3" />
              <div className="h-7 bg-pf-base rounded w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse">
              <div className="h-3 bg-pf-base rounded w-24 mb-3" />
              <div className="h-7 bg-pf-base rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={20} aria-hidden="true" />, color: 'text-pf-info', bg: 'bg-pf-info/10' },
    { label: 'Active Strategies', value: stats.activeStrategies, icon: <Blocks size={20} aria-hidden="true" />, color: 'text-pf-success', bg: 'bg-pf-success/10' },
    { label: 'Total Orders', value: stats.totalOrders, icon: <ShoppingCart size={20} aria-hidden="true" />, color: 'text-pf-purple-500', bg: 'bg-pf-purple-500/10' },
    { label: 'Open Tickets', value: stats.openTickets, icon: <TicketCheck size={20} aria-hidden="true" />, color: 'text-pf-warning', bg: 'bg-pf-warning/10' },
  ];

  const platformStatCards = [
    { label: 'News Signals (30d)', value: platformStats?.totalNewsSignals ?? 0, icon: <Newspaper size={20} aria-hidden="true" />, color: 'text-pf-cyan-500', bg: 'bg-pf-cyan-500/10' },
    { label: 'Markets w/ Sentiment', value: platformStats?.marketsWithSentiment ?? 0, icon: <BarChart2 size={20} aria-hidden="true" />, color: 'text-pf-info', bg: 'bg-pf-info/10' },
    { label: 'LP Orders', value: platformStats?.totalLpOrders ?? 0, icon: <Layers size={20} aria-hidden="true" />, color: 'text-pf-purple-500', bg: 'bg-pf-purple-500/10' },
    { label: 'Resolved Positions', value: platformStats?.resolvedPositions ?? 0, icon: <CheckSquare size={20} aria-hidden="true" />, color: 'text-pf-success', bg: 'bg-pf-success/10' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stat Cards */}
      {statsError ? (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-2 text-pf-text-tertiary" size={24} aria-hidden="true" />
          <p className="text-sm text-pf-text-secondary">Stats unavailable</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-pf-text-secondary">
                  {card.label}
                </span>
                <div className={`p-2 rounded-pf-sm ${card.bg}`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-pf-text font-mono">
                {card.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Platform Activity */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-pf-text-tertiary mb-3 px-0.5">
          Platform Activity
        </h2>
        {platformStatsError ? (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 text-center">
            <AlertCircle className="mx-auto mb-2 text-pf-text-tertiary" size={24} aria-hidden="true" />
            <p className="text-sm text-pf-text-secondary">Platform stats unavailable</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {platformStatCards.map((card) => (
              <div
                key={card.label}
                className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-pf-text-secondary">
                    {card.label}
                  </span>
                  <div className={`p-2 rounded-pf-sm ${card.bg}`}>
                    <span className={card.color}>{card.icon}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-pf-text font-mono">
                  {card.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        {healthError ? (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-pf-text-tertiary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-pf-text">
                System Health
              </h2>
            </div>
            <div className="text-center py-6">
              <AlertCircle className="mx-auto mb-2 text-pf-text-tertiary" size={24} aria-hidden="true" />
              <p className="text-sm text-pf-text-secondary">Health unavailable</p>
              <Button type="button" variant="ghost" onClick={load} className="text-pf-cyan-400 hover:text-pf-cyan-300 text-xs mt-2">
                Retry
              </Button>
            </div>
          </div>
        ) : health ? (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-pf-cyan-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-pf-text">
                System Health
              </h2>
              <span
                className={`ml-auto px-2 py-0.5 rounded-pf-full text-xs font-medium ${statusColor(health.status)}`}
              >
                {health.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(health.services ?? {}).map(([name, svc]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-2.5 rounded-pf-sm bg-pf-base border border-pf-border"
                >
                  <div>
                    <div className="text-xs font-medium text-pf-text capitalize">
                      {name}
                    </div>
                    <div className="text-pf-label text-pf-text-tertiary">
                      {svc?.latencyMs ?? 0}ms
                    </div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-pf-full ${
                      svc?.status === 'healthy'
                        ? 'bg-pf-success'
                        : svc?.status === 'degraded'
                          ? 'bg-pf-warning'
                          : 'bg-pf-danger'
                    }`}
                    role="img"
                    aria-label={`Status: ${svc?.status ?? 'unknown'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Infrastructure + Launch Control */}
        <div className="space-y-4">
          {health?.db && (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-pf-cyan-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-pf-text">
                Database
              </h2>
              <span
                className={`ml-auto px-2 py-0.5 rounded-pf-full text-xs font-medium ${statusColor(health.db?.status)}`}
              >
                {health.db?.status ?? 'UNKNOWN'}
              </span>
            </div>
            <div className="text-sm text-pf-text-secondary">
              Active connections: <span className="text-pf-text font-medium">{health.db?.connections ?? 0}</span>
            </div>
          </div>
          )}

          {health?.redis && (
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server size={16} className="text-pf-cyan-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-pf-text">
                Redis
              </h2>
              <span
                className={`ml-auto px-2 py-0.5 rounded-pf-full text-xs font-medium ${statusColor(health.redis?.status)}`}
              >
                {health.redis?.status ?? 'UNKNOWN'}
              </span>
            </div>
            <div className="text-sm text-pf-text-secondary">
              Memory usage: <span className="text-pf-text font-medium font-mono">{(health.redis?.memoryUsageMb ?? 0).toFixed(1)} MB</span>
            </div>
          </div>
          )}

          {/* Launch Control */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-pf-text">
                  Launch Control
                </h2>
                <p className="text-xs text-pf-text-tertiary mt-0.5">
                  Invite-only registration
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={toggleInviteOnly}
                disabled={!isSuperAdmin}
                className={`transition-colors ${isSuperAdmin ? 'cursor-pointer text-pf-cyan-500 hover:text-pf-cyan-400' : 'text-pf-text-tertiary opacity-50 cursor-not-allowed'}`}
                aria-label={config?.inviteOnly ? 'Disable invite-only registration' : 'Enable invite-only registration'}
                title={!isSuperAdmin ? 'Super Admin only' : undefined}
              >
                {config?.inviteOnly ? (
                  <ToggleRight size={32} />
                ) : (
                  <ToggleLeft size={32} className="text-pf-text-tertiary" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={16} className="text-pf-cyan-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-pf-text">
            Rate Limiting
          </h2>
        </div>
        {rateLimitsError ? (
          <div className="text-center py-4">
            <AlertCircle className="mx-auto mb-2 text-pf-text-tertiary" size={20} aria-hidden="true" />
            <p className="text-sm text-pf-text-secondary">Rate limit data unavailable</p>
          </div>
        ) : rateLimits ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                <span className="text-pf-label text-pf-text-tertiary uppercase">Tracked Keys</span>
                <span className="block text-lg font-bold text-pf-text">{rateLimits.totalTrackedKeys}</span>
              </div>
              <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                <span className="text-pf-label text-pf-text-tertiary uppercase">Recent 429s</span>
                <span className={`block text-lg font-bold ${rateLimits.recent429Count > 0 ? 'text-pf-warning' : 'text-pf-text'}`}>
                  {rateLimits.recent429Count}
                </span>
              </div>
              <div className="bg-pf-base border border-pf-border rounded-pf-sm p-3">
                <span className="text-pf-label text-pf-text-tertiary uppercase">Top Offenders</span>
                <span className="block text-lg font-bold text-pf-text">{rateLimits.topOffenders?.length ?? 0}</span>
              </div>
            </div>
            {rateLimits.totalTrackedKeys === 0 && rateLimits.recent429Count === 0 && (rateLimits.topOffenders?.length ?? 0) === 0 && (
              <p className="text-xs text-pf-text-tertiary italic">No rate limit events recorded</p>
            )}
            {rateLimits.topOffenders?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <caption className="sr-only">Rate limit top offenders</caption>
                  <thead>
                    <tr className="text-left text-pf-text-tertiary uppercase tracking-wider border-b border-pf-border">
                      <th scope="col" className="pb-2 font-medium">Identifier</th>
                      <th scope="col" className="pb-2 font-medium text-right">Hits</th>
                      <th scope="col" className="pb-2 font-medium text-right">TTL (s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pf-border">
                    {rateLimits.topOffenders.slice(0, 10).map((entry) => (
                      <tr key={entry.key}>
                        <td className="py-1.5 font-mono text-pf-text-secondary truncate max-w-[200px]">{entry.key}</td>
                        <td className={`py-1.5 text-right font-mono ${entry.hits > 50 ? 'text-pf-danger' : 'text-pf-text'}`}>{entry.hits}</td>
                        <td className="py-1.5 text-right font-mono text-pf-text-secondary">{entry.ttl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-pf-text-tertiary" role="status">Loading...</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
        <h2 className="text-sm font-semibold text-pf-text mb-4">
          Recent Activity
        </h2>
        {logsError ? (
          <div className="text-center py-4">
            <Clock className="mx-auto mb-2 text-pf-text-tertiary" size={20} aria-hidden="true" />
            <p className="text-sm text-pf-text-secondary">No recent activity</p>
            <p className="text-xs text-pf-text-tertiary mt-1">Activity will appear here as admins take actions.</p>
            <Button type="button" variant="ghost" onClick={load} className="text-pf-cyan-400 hover:text-pf-cyan-300 text-xs mt-2">
              Refresh
            </Button>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-2">
            <p className="text-sm text-pf-text-secondary">No admin actions recorded yet.</p>
            <p className="text-xs text-pf-text-tertiary mt-1">Activity will appear as admins manage users, strategies, and settings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2 border-b border-pf-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-pf-label font-medium bg-pf-base text-pf-cyan-500 border border-pf-border">
                    {log.action}
                  </span>
                  <span className="text-sm text-pf-text-secondary">
                    {log.target ?? ''}
                    {log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''}
                  </span>
                </div>
                <span className="text-xs text-pf-text-tertiary whitespace-nowrap">
                  {timeAgo(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
