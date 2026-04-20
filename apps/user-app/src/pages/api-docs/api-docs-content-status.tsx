/* Service Status section for API docs — polls GET /api/v1/status */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { PageTitle } from './api-docs-primitives';
import { Button } from '@polyforge/ui';

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
    <span className={`inline-flex size-2 rounded-full shrink-0 ${ok ? 'bg-gain' : 'bg-loss'}`} />
  );
}

function ServiceCard({ svc }: { svc: ServiceEntry }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-elevated border border-default rounded-pf hover:border-strong transition-colors">
      <div className="flex items-center gap-3">
        <StatusDot ok={svc.ok} />
        <span className="text-body-md text-primary">{svc.label}</span>
      </div>
      <div className="flex items-center gap-3">
        {svc.latencyMs !== null && (
          <span className="text-label text-tertiary font-mono">{svc.latencyMs}ms</span>
        )}
        <span className={`text-label font-medium ${svc.ok ? 'text-gain' : 'text-loss'}`}>
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
        <div className={`flex items-center justify-between px-4 py-3 rounded-pf border ${
          allOk
            ? 'bg-gain-subtle border-gain/20'
            : 'bg-loss-subtle border-loss/20'
        }`}>
          <div className="flex items-center gap-3">
            {allOk
              ? <CheckCircle2 className="size-4 text-gain" />
              : <AlertCircle  className="size-4 text-loss" />
            }
            <span className={`text-body-md font-semibold ${allOk ? 'text-gain' : 'text-loss'}`}>
              {allOk ? 'All systems operational' : `${totalCount - totalOk} service${totalCount - totalOk !== 1 ? 's' : ''} degraded`}
            </span>
          </div>
          <div className="flex items-center gap-4 text-label text-tertiary">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Uptime {formatUptime(data.uptime)}
            </span>
            <span>{totalOk}/{totalCount} healthy</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32 text-tertiary">
          <RefreshCw className="size-4 animate-spin mr-2 opacity-50" />
          <span className="text-body-sm">Checking services…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-loss-subtle border border-loss/20 rounded-pf">
          <XCircle className="size-4 text-loss shrink-0" />
          <span className="text-body-md text-loss">{error}</span>
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
      <div className="flex items-center justify-between text-label text-tertiary pt-1">
        <span>
          {lastChecked ? `Last checked ${formatTimestamp(lastChecked.toISOString())}` : ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
          className="flex items-center gap-2 hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
