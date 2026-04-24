import { useState, useEffect, useCallback } from 'react';
import { Button } from '@polyforge/ui';
import {
  Globe,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { adminApi, type VenueHealth, type VenueCapabilities } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAPABILITY_LABELS: Record<string, string> = {
  rfq: 'RFQ',
  batchOrders: 'Batch Orders',
  webSocket: 'WebSocket',
  noSideTrading: 'No-Side',
  candlestick: 'Candlestick',
};

function WsStatusBadge({ status }: { status: VenueHealth['wsStatus'] }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-2 text-gain text-label font-medium">
        <span className="w-2 h-2 rounded-full bg-gain animate-pulse shrink-0" aria-hidden="true" />
        Connected
      </span>
    );
  }
  if (status === 'disconnected') {
    return (
      <span className="flex items-center gap-2 text-loss text-label font-medium">
        <WifiOff size={14} className="shrink-0" aria-hidden="true" />
        Disconnected
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-2 text-loss text-label font-medium">
        <XCircle size={14} className="shrink-0" aria-hidden="true" />
        Error
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-tertiary text-label font-medium">
      <span className="w-2 h-2 rounded-full bg-tertiary shrink-0" aria-hidden="true" />
      Unknown
    </span>
  );
}

function CapabilityBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-caption font-medium bg-elevated border border-default text-secondary">
      {label}
    </span>
  );
}

function VenueBadge({ id }: { id: string }) {
  const isPoly = id.toLowerCase().includes('poly');
  return (
    <span
      className={`flex items-center justify-center w-8 h-8 rounded-md text-body-sm font-semibold shrink-0 ${
        isPoly
          ? 'bg-accent/15 text-accent'
          : 'bg-warning/15 text-warning'
      }`}
      aria-hidden="true"
    >
      {isPoly ? 'P' : 'K'}
    </span>
  );
}

function VenueCard({ venue }: { venue: VenueHealth }) {
  const isHealthy = venue.wsStatus === 'connected';
  const borderColor = isHealthy
    ? 'border-gain/30'
    : venue.wsStatus === 'error'
      ? 'border-loss/30'
      : venue.wsStatus === 'disconnected'
        ? 'border-warning/30'
        : 'border-default';

  const enabledCapabilities = Object.entries(venue.config.capabilities)
    .filter(([, v]) => v === true)
    .map(([k]) => CAPABILITY_LABELS[k] ?? k);

  return (
    <div className={`bg-surface rounded-pf border ${borderColor} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <VenueBadge id={venue.id} />
          <div className="min-w-0">
            <div className="text-body-sm font-semibold text-primary truncate">
              {venue.displayName}
            </div>
            <div className="text-caption text-tertiary font-mono truncate">
              {venue.config.restBaseUrl}
            </div>
          </div>
        </div>
        <WsStatusBadge status={venue.wsStatus} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 text-caption">
        <div>
          <span className="text-tertiary block">Latency</span>
          <span className="text-primary font-medium mt-1 block tabular-nums">
            {venue.latencyMs !== null ? `${venue.latencyMs}ms` : '—'}
          </span>
        </div>
        <div>
          <span className="text-tertiary block">Auth Type</span>
          <span className="text-primary font-medium mt-1 block capitalize">
            {venue.config.authType}
          </span>
        </div>
        <div>
          <span className="text-tertiary block">Last Event</span>
          <span className="text-primary font-medium mt-1 block">
            {venue.lastEventAt ? formatDateTime(venue.lastEventAt) : '—'}
          </span>
        </div>
      </div>

      {/* Capabilities */}
      {enabledCapabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {enabledCapabilities.map((cap) => (
            <CapabilityBadge key={cap} label={cap} />
          ))}
        </div>
      )}

      {/* Enabled state */}
      {!venue.config.enabled && (
        <div className="flex items-center gap-2 text-caption text-warning">
          <AlertTriangle size={12} aria-hidden="true" />
          Venue disabled in config
        </div>
      )}
    </div>
  );
}

function VenuesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface rounded-pf border border-default p-5 h-48 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Component() {
  const [venues, setVenues] = useState<VenueHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const result = await adminApi.venueHealth();
      setVenues(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch venue health');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(() => fetch(), 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  const allConnected = venues.length > 0 && venues.every((v) => v.wsStatus === 'connected');
  const anyError = venues.some((v) => v.wsStatus === 'error' || v.wsStatus === 'disconnected');

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Globe size={22} className="text-accent shrink-0" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-primary">Venues</h1>
            {lastUpdated && (
              <p className="text-caption text-tertiary mt-1">
                Updated {lastUpdated.toLocaleTimeString()} · polling every 30s
              </p>
            )}
          </div>
          {refreshing && (
            <Loader2 size={16} className="animate-spin text-tertiary shrink-0" aria-hidden="true" />
          )}
        </div>
        <Button
          type="button"
          variant="default"
          onClick={() => fetch(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-sm border border-default bg-surface text-body-sm text-primary hover:bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-loss/30 bg-loss/10 text-loss text-body-sm">
          <XCircle size={16} className="shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Status banner */}
      {!loading && !error && venues.length > 0 && (
        <>
          {allConnected && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-gain/30 bg-gain/10 text-gain text-body-sm font-medium">
              <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
              All venues connected
            </div>
          )}
          {anyError && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-pf border border-warning/30 bg-warning/10 text-warning text-body-sm font-medium">
              <Wifi size={16} className="shrink-0" aria-hidden="true" />
              One or more venues have connectivity issues
            </div>
          )}
        </>
      )}

      {/* Content */}
      {loading ? (
        <VenuesSkeleton />
      ) : venues.length === 0 && !error ? (
        <div className="text-center py-16">
          <Globe className="mx-auto mb-3 text-tertiary opacity-40" size={40} aria-hidden="true" />
          <p className="text-secondary font-medium">No venues configured</p>
          <p className="text-tertiary text-label mt-1">Venue health data will appear here once venues are configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}
