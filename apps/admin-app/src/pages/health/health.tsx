import { useState, useEffect, useCallback } from 'react';
import { Button } from '@polyforge/ui';
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
      <span className="flex items-center gap-2 text-gain text-xs font-medium">
        <span className="animate-pulse bg-gain rounded-pf-full w-2 h-2 shrink-0" />
        UP
      </span>
    );
  }
  if (status === 'DOWN') {
    return (
      <span className="flex items-center gap-2 text-loss text-xs font-medium">
        <XCircle size={14} className="shrink-0" />
        DOWN
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <span className="flex items-center gap-2 text-warning text-xs font-medium">
        <AlertTriangle size={14} className="shrink-0" />
        DEGRADED
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-tertiary text-xs font-medium">
      <span className="bg-tertiary rounded-pf-full w-2 h-2 shrink-0" />
      UNKNOWN
    </span>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const borderColor =
    service.status === 'UP'
      ? 'border-gain/30'
      : service.status === 'DOWN'
        ? 'border-loss/30'
        : service.status === 'DEGRADED'
          ? 'border-warning/30'
          : 'border-default';

  return (
    <div className={`bg-surface rounded-pf border ${borderColor} p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={15} className="text-secondary shrink-0" />
          <span className="text-sm font-medium text-primary truncate">
            {formatServiceName(service.name)}
          </span>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-tertiary">Latency</span>
          <div className="text-primary font-medium mt-1">
            {service.latencyMs !== null ? `${service.latencyMs}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-tertiary">Uptime</span>
          <div className="text-primary font-medium mt-1">
            {formatUptime(service.uptime)}
          </div>
        </div>
      </div>

      {service.version && (
        <div className="text-pf-caption text-tertiary">v{service.version}</div>
      )}

      {(service.status === 'DOWN' || service.status === 'DEGRADED') && service.errorMessage && (
        <div className="text-pf-label text-loss leading-snug">{service.errorMessage}</div>
      )}
    </div>
  );
}

function DbCard({ db }: { db: DbHealth }) {
  const connPct = db.maxConnections > 0
    ? Math.round((db.activeConnections / db.maxConnections) * 100)
    : 0;

  const connBarColor =
    connPct >= 90 ? 'bg-loss' : connPct >= 70 ? 'bg-warning' : 'bg-gain';

  return (
    <div className="bg-surface rounded-pf border border-default p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-secondary" />
          <span className="text-sm font-semibold text-primary">Database</span>
        </div>
        <StatusBadge status={db.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-tertiary">Latency</span>
          <div className="text-primary font-medium mt-1">
            {db.latencyMs !== null ? `${db.latencyMs}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-tertiary">Migrations Pending</span>
          <div className="mt-1">
            {db.pendingMigrations > 0 ? (
              <span className="inline-flex items-center px-2 py-1 rounded text-pf-caption font-semibold bg-loss/15 text-loss">
                {db.pendingMigrations}
              </span>
            ) : (
              <span className="text-gain font-medium">0</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-tertiary">Connections</span>
          <span className="text-primary font-medium">
            {db.activeConnections} / {db.maxConnections}
          </span>
        </div>
        <div className="h-2 bg-elevated rounded-pf-full overflow-hidden">
          <div
            className={`h-full rounded-pf-full transition-all duration-pf-slow ${connBarColor}`}
            style={{ width: `${connPct}%` }}
          />
        </div>
        <div className="text-pf-caption text-tertiary mt-1">{connPct}% utilized</div>
      </div>
    </div>
  );
}

function RedisCard({ db }: { db: DbHealth }) {
  return (
    <div className="bg-surface rounded-pf border border-default p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-secondary" />
          <span className="text-sm font-semibold text-primary">Redis</span>
        </div>
        <StatusBadge status={db.redisStatus} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-tertiary">Latency</span>
          <div className="text-primary font-medium mt-1">
            {db.redisLatencyMs !== null ? `${db.redisLatencyMs}ms` : '—'}
          </div>
        </div>
        <div>
          <span className="text-tertiary">Memory</span>
          <div className="text-primary font-medium mt-1">
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
      ? 'text-loss bg-loss/10'
      : depth >= 100
        ? 'text-warning bg-warning/10'
        : 'text-gain bg-gain/10';

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
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
          <Activity size={22} className="text-accent shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-primary">System Health</h1>
            {lastUpdated && (
              <p className="text-xs text-tertiary mt-1">
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          {refreshing && (
            <Loader2 size={16} className="animate-spin text-tertiary shrink-0" />
          )}
        </div>
        <Button
          type="button"
          variant="default"
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-pf-sm border border-default bg-surface text-sm text-primary hover:bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh Now
        </Button>
      </div>

      {/* Error state */}
      {error && !data && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-loss/30 bg-loss/10 text-loss text-sm">
          <XCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-pf border border-default p-4 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Overall status banner */}
          {overallStatus === 'ok' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-gain/30 bg-gain/10 text-gain text-sm font-medium">
              <CheckCircle2 size={16} className="shrink-0" />
              All systems operational
            </div>
          )}
          {overallStatus === 'degraded' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-warning/30 bg-warning/10 text-warning text-sm font-medium">
              <AlertTriangle size={16} className="shrink-0" />
              Degraded performance detected
            </div>
          )}
          {overallStatus === 'down' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-loss/30 bg-loss/10 text-loss text-sm font-medium">
              <XCircle size={16} className="shrink-0" />
              System outage detected
            </div>
          )}

          {/* Section 1: Services */}
          <section>
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
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
              <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
                Redis Streams
              </h2>
              <div className="bg-surface rounded-pf border border-default overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-default bg-elevated">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                        Stream Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                        Depth
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden sm:table-cell">
                        Processed / min
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden sm:table-cell">
                        Consumers
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                        Oldest Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queues.map((queue, idx) => (
                      <tr
                        key={queue.name}
                        className={`border-b border-default last:border-0 ${idx % 2 === 1 ? 'bg-elevated/30' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-primary">
                          {queue.name}
                        </td>
                        <td className="px-4 py-3">
                          <QueueDepthCell depth={queue.depth} />
                        </td>
                        <td className="px-4 py-3 text-primary text-xs hidden sm:table-cell">
                          {queue.processedPerMin.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-primary text-xs hidden sm:table-cell">
                          {queue.consumerCount}
                        </td>
                        <td className="px-4 py-3 text-secondary text-xs hidden md:table-cell">
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
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
              Infrastructure
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DbCard db={data.database} />
              <RedisCard db={data.database} />
            </div>
          </section>

          {/* Section 4: 24h Uptime Summary */}
          <section>
            <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
              24h Uptime Summary
            </h2>
            <div className="bg-surface rounded-pf border border-default divide-y divide-default">
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
                        className={`w-2 h-2 rounded-pf-full shrink-0 ${
                          service.status === 'UP'
                            ? 'bg-gain'
                            : service.status === 'DOWN'
                              ? 'bg-loss'
                              : service.status === 'DEGRADED'
                                ? 'bg-warning'
                                : 'bg-tertiary'
                        }`}
                      />
                      <span className="text-sm text-primary">
                        {formatServiceName(service.name)}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        uptimePct !== null && parseFloat(uptimePct) >= 99.9
                          ? 'text-gain'
                          : uptimePct !== null && parseFloat(uptimePct) >= 95
                            ? 'text-warning'
                            : 'text-loss'
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
