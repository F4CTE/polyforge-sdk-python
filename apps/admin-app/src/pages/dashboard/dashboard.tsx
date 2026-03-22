import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, timeAgo } from '@/lib/utils';

interface HealthData {
  status: string;
  services: Record<string, { status: string; latencyMs: number }>;
  db: { status: string; connections: number };
  redis: { status: string; memoryUsageMb: number };
}

export function Component() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [config, setConfig] = useState<{ inviteOnly: boolean } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeStrategies: 0,
    totalOrders: 0,
    openTickets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [healthError, setHealthError] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [logsError, setLogsError] = useState(false);

  async function load() {
    setLoading(true);
    setHealthError(false);
    setStatsError(false);
    setLogsError(false);

    // Fetch each API call independently so one failure doesn't block others
    try {
      const healthRes = await adminApi.health();
      setHealth(healthRes ?? null);
    } catch {
      setHealthError(true);
    }

    try {
      const configRes = await adminApi.config();
      setConfig(configRes ?? null);
    } catch {
      // config failure is non-critical, toggle just won't show current state
    }

    try {
      const [usersRes, strategiesRes, ordersRes, ticketsRes] = await Promise.all([
        adminApi.users({ limit: 1 }),
        adminApi.strategies({ limit: 1, status: 'RUNNING' }),
        adminApi.orders({ limit: 1 }),
        adminApi.tickets({ limit: 1, status: 'OPEN' }),
      ]);
      setStats({
        totalUsers: usersRes?.total ?? 0,
        activeStrategies: strategiesRes?.total ?? 0,
        totalOrders: ordersRes?.total ?? 0,
        openTickets: ticketsRes?.total ?? 0,
      });
    } catch {
      setStatsError(true);
    }

    try {
      const logsRes = await adminApi.auditLogs({ limit: 5 });
      setAuditLogs(Array.isArray(logsRes?.data) ? logsRes.data : []);
    } catch {
      setLogsError(true);
    }

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
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-[var(--color-pf-text-secondary)]">Loading dashboard...</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={20} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Active Strategies', value: stats.activeStrategies, icon: <Blocks size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Total Orders', value: stats.totalOrders, icon: <ShoppingCart size={20} />, color: 'text-violet-400', bg: 'bg-violet-400/10' },
    { label: 'Open Tickets', value: stats.openTickets, icon: <TicketCheck size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stat Cards */}
      {statsError ? (
        <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-2 text-[var(--color-pf-text-tertiary)]" size={24} />
          <p className="text-sm text-[var(--color-pf-text-secondary)]">Stats unavailable</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[var(--color-pf-text-secondary)]">
                  {card.label}
                </span>
                <div className={`p-2 rounded-md ${card.bg}`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-pf-text)]">
                {card.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        {healthError ? (
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-[var(--color-pf-text-tertiary)]" />
              <h2 className="text-sm font-semibold text-[var(--color-pf-text)]">
                System Health
              </h2>
            </div>
            <div className="text-center py-6">
              <AlertCircle className="mx-auto mb-2 text-[var(--color-pf-text-tertiary)]" size={24} />
              <p className="text-sm text-[var(--color-pf-text-secondary)]">Health unavailable</p>
              <button onClick={load} className="text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-xs mt-2">
                Retry
              </button>
            </div>
          </div>
        ) : health ? (
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-[var(--color-pf-cyan-500)]" />
              <h2 className="text-sm font-semibold text-[var(--color-pf-text)]">
                System Health
              </h2>
              <span
                className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(health.status)}`}
              >
                {health.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(health.services ?? {}).map(([name, svc]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-2.5 rounded-md bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]"
                >
                  <div>
                    <div className="text-xs font-medium text-[var(--color-pf-text)] capitalize">
                      {name}
                    </div>
                    <div className="text-[11px] text-[var(--color-pf-text-tertiary)]">
                      {svc?.latencyMs ?? 0}ms
                    </div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      svc?.status === 'healthy'
                        ? 'bg-emerald-400'
                        : svc?.status === 'degraded'
                          ? 'bg-amber-400'
                          : 'bg-red-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Infrastructure + Launch Control */}
        <div className="space-y-4">
          {health?.db && (
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-[var(--color-pf-cyan-500)]" />
              <h2 className="text-sm font-semibold text-[var(--color-pf-text)]">
                Database
              </h2>
              <span
                className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(health.db?.status)}`}
              >
                {health.db?.status ?? 'UNKNOWN'}
              </span>
            </div>
            <div className="text-sm text-[var(--color-pf-text-secondary)]">
              Active connections: <span className="text-[var(--color-pf-text)] font-medium">{health.db?.connections ?? 0}</span>
            </div>
          </div>
          )}

          {health?.redis && (
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server size={16} className="text-[var(--color-pf-cyan-500)]" />
              <h2 className="text-sm font-semibold text-[var(--color-pf-text)]">
                Redis
              </h2>
              <span
                className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(health.redis?.status)}`}
              >
                {health.redis?.status ?? 'UNKNOWN'}
              </span>
            </div>
            <div className="text-sm text-[var(--color-pf-text-secondary)]">
              Memory usage: <span className="text-[var(--color-pf-text)] font-medium">{(health.redis?.memoryUsageMb ?? 0).toFixed(1)} MB</span>
            </div>
          </div>
          )}

          {/* Launch Control */}
          <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-pf-text)]">
                  Launch Control
                </h2>
                <p className="text-xs text-[var(--color-pf-text-tertiary)] mt-0.5">
                  Invite-only registration
                </p>
              </div>
              <button
                onClick={toggleInviteOnly}
                className="text-[var(--color-pf-cyan-500)] hover:text-[var(--color-pf-cyan-400)] transition-colors"
                aria-label="Toggle invite-only"
              >
                {config?.inviteOnly ? (
                  <ToggleRight size={32} />
                ) : (
                  <ToggleLeft size={32} className="text-[var(--color-pf-text-tertiary)]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5">
        <h2 className="text-sm font-semibold text-[var(--color-pf-text)] mb-4">
          Recent Activity
        </h2>
        {logsError ? (
          <div className="text-center py-4">
            <p className="text-sm text-[var(--color-pf-text-secondary)]">Audit logs unavailable</p>
            <button onClick={load} className="text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-xs mt-1">
              Retry
            </button>
          </div>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-[var(--color-pf-text-tertiary)]">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2 border-b border-[var(--color-pf-border)] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-pf-bg)] text-[var(--color-pf-cyan-500)] border border-[var(--color-pf-border)]">
                    {log.action}
                  </span>
                  <span className="text-sm text-[var(--color-pf-text-secondary)]">
                    {log.target ? `${log.target}` : ''}
                    {log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-pf-text-tertiary)] whitespace-nowrap">
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
