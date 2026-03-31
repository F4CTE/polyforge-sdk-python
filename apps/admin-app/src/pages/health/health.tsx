import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Database,
  Server,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

interface HealthResponse {
  services: ServiceHealth[];
  queues: QueueHealth[];
  database: DbHealth;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatServiceName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

function formatAge(seconds?: number): string {
  if (seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function getOverallStatus(data: HealthResponse): 'ok' | 'degraded' | 'down' {
  const allStatuses = [
    ...data.services.map((s) => s.status),
    data.database.status,
  ];
  if (allStatuses.some((s) => s === 'DOWN')) return 'down';
  if (allStatuses.some((s) => s === 'DEGRADED')) return 'degraded';
  return 'ok';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' }) {
  if (status === 'UP') {
    return (
      <span className="flex items-center gap-1.5 text-pf-success text-xs font-medium">
        <span className="animate-pulse bg-pf-success rounded-full w-2 h-2 shrink-0" />
        UP
      </span>
    );
  }
  if (status === 'DOWN') {
    return (
      <span className="flex items-center gap-1.5 text-pf-danger text-xs font-medium">
        <XCircle size={14} className="shrink-0" />
        DOWN
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <span className="flex items-center gap-1.5 text-pf-warning text-xs font-medium">
        <AlertTriangle size={14} className="shrink-0" />
        DEGRADED
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-pf-text-tertiary text-xs font-medium">
      <span className="bg-pf-text-tertiary rounded-full w-2 h-2 shrink-0" />
      UNKNOWN
    </span>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const borderColor =
    service.status === 'UP'
      ? 'border-pf-success/30'
      : service.status === 'DOWN'
        ? 'border-pf-danger/30'
        : service.status === 'DEGRADED'
          ? 'border-pf-warning/30'
          : 'border-pf-border';

  return (
    <div className={`bg-pf-surface rounded-pf border ${borderColor} p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={15} className="text-pf-text-secondary shrink-0" />
          <span className="text-sm font-medium text-pf-text truncate">
            {formatServiceName(service.name)}
          </span>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-pf-text-tertiary">Latency</span>
          <div className="text-pf-text font-medium mt-0.5">
            {service.latencyMs !== null ? `${service.latencyMs}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-pf-text-tertiary">Uptime</span>
          <div className="text-pf-text font-medium mt-0.5">
            {formatUptime(service.uptime)}
          </div>
        </div>
      </div>

      {service.version && (
        <div className="text-[10px] text-pf-text-tertiary">v{service.version}</div>
      )}

      {(service.status === 'DOWN' || service.status === 'DEGRADED') && service.errorMessage && (
        <div className="text-[11px] text-pf-danger leading-snug">{service.errorMessage}</div>
      )}
    </div>
  );
}

function DbCard({ db }: { db: DbHealth }) {
  const connPct = db.maxConnections > 0
    ? Math.round((db.activeConnections / db.maxConnections) * 100)
    : 0;

  const connBarColor =
    connPct >= 90 ? 'bg-pf-danger' : connPct >= 70 ? 'bg-pf-warning' : 'bg-pf-success';

  return (
    <div className="bg-pf-surface rounded-pf border border-pf-border p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-pf-text-secondary" />
          <span className="text-sm font-semibold text-pf-text">Database</span>
        </div>
        <StatusBadge status={db.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-pf-text-tertiary">Latency</span>
          <div className="text-pf-text font-medium mt-0.5">
            {db.latencyMs !== null ? `${db.latencyMs}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-pf-text-tertiary">Migrations Pending</span>
          <div className="mt-0.5">
            {db.pendingMigrations > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-pf-danger/15 text-pf-danger">
                {db.pendingMigrations}
              </span>
            ) : (
              <span className="text-pf-success font-medium">0</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-pf-text-tertiary">Connections</span>
          <span className="text-pf-text font-medium">
            {db.activeConnections} / {db.maxConnections}
          </span>
        </div>
        <div className="h-1.5 bg-pf-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${connBarColor}`}
            style={{ width: `${connPct}%` }}
          />
        </div>
        <div className="text-[10px] text-pf-text-tertiary mt-1">{connPct}% utilized</div>
      </div>
    </div>
  );
}

function RedisCard({ db }: { db: DbHealth }) {
  return (
    <div className="bg-pf-surface rounded-pf border border-pf-border p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-pf-text-secondary" />
          <span className="text-sm font-semibold text-pf-text">Redis</span>
        </div>
        <StatusBadge status={db.redisStatus} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-pf-text-tertiary">Latency</span>
          <div className="text-pf-text font-medium mt-0.5">
            {db.redisLatencyMs !== null ? `${db.redisLatencyMs}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-pf-text-tertiary">Memory</span>
          <div className="text-pf-text font-medium mt-0.5">
            {db.redisMemoryMb !== null ? `${db.redisMemoryMb.toFixed(1)} MB` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueDepthCell({ depth }: { depth: number }) {
  const colorClass =
    depth > 1000
      ? 'text-pf-danger bg-pf-danger/10'
      : depth >= 100
        ? 'text-pf-warning bg-pf-warning/10'
        : 'text-pf-success bg-pf-success/10';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {depth.toLocaleString()}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Component() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const result = await adminApi.healthStatus();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const overallStatus = data ? getOverallStatus(data) : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Activity size={22} className="text-pf-cyan-500 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-pf-text">System Health</h1>
            {lastUpdated && (
              <p className="text-xs text-pf-text-tertiary mt-0.5">
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          {refreshing && (
            <Loader2 size={16} className="animate-spin text-pf-text-tertiary shrink-0" />
          )}
        </div>
        <button
          type="button"
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-pf-sm border border-pf-border bg-pf-surface text-sm text-pf-text hover:bg-pf-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh Now
        </button>
      </div>

      {/* Error state */}
      {error && !data && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-pf-danger/30 bg-pf-danger/10 text-pf-danger text-sm">
          <XCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-pf-surface rounded-pf border border-pf-border p-4 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Overall status banner */}
          {overallStatus === 'ok' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-pf-success/30 bg-pf-success/10 text-pf-success text-sm font-medium">
              <CheckCircle2 size={16} className="shrink-0" />
              All systems operational
            </div>
          )}
          {overallStatus === 'degraded' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-pf-warning/30 bg-pf-warning/10 text-pf-warning text-sm font-medium">
              <AlertTriangle size={16} className="shrink-0" />
              Degraded performance detected
            </div>
          )}
          {overallStatus === 'down' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-pf-danger/30 bg-pf-danger/10 text-pf-danger text-sm font-medium">
              <XCircle size={16} className="shrink-0" />
              System outage detected
            </div>
          )}

          {/* Section 1: Services */}
          <section>
            <h2 className="text-sm font-semibold text-pf-text-secondary uppercase tracking-wider mb-3">
              Services
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {data.services.map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          </section>

          {/* Section 2: Redis Streams */}
          {data.queues.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-pf-text-secondary uppercase tracking-wider mb-3">
                Redis Streams
              </h2>
              <div className="bg-pf-surface rounded-pf border border-pf-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pf-border bg-pf-elevated">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-pf-text-secondary uppercase tracking-wider">
                        Stream Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-pf-text-secondary uppercase tracking-wider">
                        Depth
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-pf-text-secondary uppercase tracking-wider hidden sm:table-cell">
                        Processed / min
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-pf-text-secondary uppercase tracking-wider hidden sm:table-cell">
                        Consumers
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-pf-text-secondary uppercase tracking-wider hidden md:table-cell">
                        Oldest Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queues.map((queue, idx) => (
                      <tr
                        key={queue.name}
                        className={`border-b border-pf-border last:border-0 ${idx % 2 === 1 ? 'bg-pf-elevated/30' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-pf-text">
                          {queue.name}
                        </td>
                        <td className="px-4 py-3">
                          <QueueDepthCell depth={queue.depth} />
                        </td>
                        <td className="px-4 py-3 text-pf-text text-xs hidden sm:table-cell">
                          {queue.processedPerMin.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-pf-text text-xs hidden sm:table-cell">
                          {queue.consumerCount}
                        </td>
                        <td className="px-4 py-3 text-pf-text-secondary text-xs hidden md:table-cell">
                          {formatAge(queue.oldestMessageAge)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section 3: Database & Redis */}
          <section>
            <h2 className="text-sm font-semibold text-pf-text-secondary uppercase tracking-wider mb-3">
              Infrastructure
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DbCard db={data.database} />
              <RedisCard db={data.database} />
            </div>
          </section>

          {/* Section 4: 24h Uptime Summary */}
          <section>
            <h2 className="text-sm font-semibold text-pf-text-secondary uppercase tracking-wider mb-3">
              24h Uptime Summary
            </h2>
            <div className="bg-pf-surface rounded-pf border border-pf-border divide-y divide-pf-border">
              {data.services.map((service) => {
                const uptimePct =
                  service.uptime !== null
                    ? Math.min(100, (service.uptime / 86400) * 100).toFixed(1)
                    : null;
                return (
                  <div
                    key={service.name}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          service.status === 'UP'
                            ? 'bg-pf-success'
                            : service.status === 'DOWN'
                              ? 'bg-pf-danger'
                              : service.status === 'DEGRADED'
                                ? 'bg-pf-warning'
                                : 'bg-pf-text-tertiary'
                        }`}
                      />
                      <span className="text-sm text-pf-text">
                        {formatServiceName(service.name)}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        uptimePct !== null && parseFloat(uptimePct) >= 99.9
                          ? 'text-pf-success'
                          : uptimePct !== null && parseFloat(uptimePct) >= 95
                            ? 'text-pf-warning'
                            : 'text-pf-danger'
                      }`}
                    >
                      {uptimePct !== null ? `${uptimePct}% uptime` : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
