/* Service Status section for API docs — polls GET /api/v1/status */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { PageTitle } from './api-docs-primitives';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface ServiceEntry {
  name: string;
  label: string;
  ok: boolean;
  latencyMs: number | null;
}

interface StatusResponse {
  status: 'operational' | 'degraded';
  uptime: number;
  timestamp: string;
  latencyMs: number;
  services: ServiceEntry[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex size-2 rounded-full shrink-0 ${ok ? 'bg-pf-success' : 'bg-pf-danger'}`} />
  );
}

function ServiceCard({ svc }: { svc: ServiceEntry }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-pf-elevated border border-pf-border rounded-pf-lg hover:border-pf-border-strong transition-colors">
      <div className="flex items-center gap-2.5">
        <StatusDot ok={svc.ok} />
        <span className="text-sm text-pf-text">{svc.label}</span>
      </div>
      <div className="flex items-center gap-3">
        {svc.latencyMs !== null && (
          <span className="text-xs text-pf-text-muted font-mono">{svc.latencyMs}ms</span>
        )}
        <span className={`text-xs font-medium ${svc.ok ? 'text-pf-success' : 'text-pf-danger'}`}>
          {svc.ok ? 'Operational' : 'Down'}
        </span>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function StatusSection() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const r = await fetch('/api/v1/status', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body: StatusResponse = await r.json();
      setData(body);
      setError(null);
      setLastChecked(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* Initial fetch + 30s auto-refresh */
  useEffect(() => {
    fetchStatus();
    const id = setInterval(() => fetchStatus(), 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const allOk      = data?.status === 'operational';
  const totalOk    = data?.services.filter(s => s.ok).length ?? 0;
  const totalCount = data?.services.length ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Service Status"
        subtitle="Live health of all Polyforge backend services. Auto-refreshes every 30 seconds."
      />

      {/* Overall banner */}
      {!loading && !error && data && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-pf-lg border ${
          allOk
            ? 'bg-pf-success/5 border-pf-success/20'
            : 'bg-pf-danger/5 border-pf-danger/20'
        }`}>
          <div className="flex items-center gap-2.5">
            {allOk
              ? <CheckCircle2 className="size-4 text-pf-success" />
              : <AlertCircle  className="size-4 text-pf-danger" />
            }
            <span className={`text-sm font-semibold ${allOk ? 'text-pf-success' : 'text-pf-danger'}`}>
              {allOk ? 'All systems operational' : `${totalCount - totalOk} service${totalCount - totalOk !== 1 ? 's' : ''} degraded`}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-pf-text-muted">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Uptime {formatUptime(data.uptime)}
            </span>
            <span>{totalOk}/{totalCount} healthy</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32 text-pf-text-muted">
          <RefreshCw className="size-4 animate-spin mr-2 opacity-50" />
          <span className="text-sm">Checking services…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-pf-danger/5 border border-pf-danger/20 rounded-pf-lg">
          <XCircle className="size-4 text-pf-danger shrink-0" />
          <span className="text-sm text-pf-danger">{error}</span>
        </div>
      )}

      {/* Service grid */}
      {!loading && !error && data && (
        <div className="space-y-2">
          {data.services.map(svc => (
            <ServiceCard key={svc.name} svc={svc} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-pf-text-muted pt-1">
        <span>
          {lastChecked ? `Last checked ${formatTimestamp(lastChecked.toISOString())}` : ''}
        </span>
        <button
          type="button"
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 hover:text-pf-text transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}
