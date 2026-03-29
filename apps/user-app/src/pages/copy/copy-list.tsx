import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Copy,
  Pause,
  Play,
  Square,
  Pencil,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

type CopyStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';
type CopyMode = 'PERCENTAGE' | 'FIXED' | 'MIRROR';
type FilterStatus = 'ALL' | CopyStatus;

interface CopyConfig {
  id: string;
  targetWallet: string;
  mode: CopyMode;
  status: CopyStatus;
  sizeValue: number;
  maxExposure: number;
  maxDailyLoss: number;
  priceOffset: number;
  totalPnl: number;
  totalCopiedTrades: number;
  createdAt: string;
  updatedAt: string;
}

interface CopyListResponse {
  data: CopyConfig[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<CopyStatus, { dot: string; bg: string; text: string }> = {
  ACTIVE:  { dot: 'bg-pf-success', bg: 'bg-pf-success/10', text: 'text-pf-success' },
  PAUSED:  { dot: 'bg-pf-warning',  bg: 'bg-pf-warning/10',  text: 'text-pf-warning' },
  STOPPED: { dot: 'bg-pf-text-muted',   bg: 'bg-pf-text-muted/10',   text: 'text-pf-text-muted' },
};

const MODE_STYLES: Record<CopyMode, { bg: string; text: string }> = {
  PERCENTAGE: { bg: 'bg-pf-cyan-500/10', text: 'text-pf-cyan-400' },
  FIXED:      { bg: 'bg-pf-purple-500/10',  text: 'text-pf-purple-500' },
  MIRROR:     { bg: 'bg-pf-success/10', text: 'text-pf-success' },
};

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Stopped', value: 'STOPPED' },
];

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Address copied'),
    () => toast.error('Failed to copy'),
  );
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function sizeLabel(mode: CopyMode, value: number): string {
  if (mode === 'PERCENTAGE') return `${value}% of trade`;
  if (mode === 'FIXED') return `$${value.toFixed(2)} fixed`;
  return 'Mirror (1:1)';
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-3 animate-shimmer">
      <div className="flex items-center gap-2">
        <div className="h-4 bg-pf-overlay rounded w-[140px]" />
        <div className="h-5 w-20 bg-pf-overlay rounded-full ml-auto" />
      </div>
      <div className="h-3 bg-pf-overlay rounded w-[60%]" />
      <div className="flex gap-2">
        <div className="h-5 w-24 bg-pf-overlay rounded-full" />
        <div className="h-5 w-16 bg-pf-overlay rounded-full" />
      </div>
      <div className="h-3 bg-pf-overlay rounded w-[80%]" />
      <div className="h-3 bg-pf-overlay rounded w-[50%]" />
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const navigate = useNavigate();

  const [configs, setConfigs] = useState<CopyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const load = useCallback((status?: FilterStatus, p?: number) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '20', page: String(p ?? page) });
    const s = status ?? filter;
    if (s !== 'ALL') params.set('status', s);
    fetch(`/api/v1/copy?${params}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((res: CopyListResponse) => {
        setConfigs(res.data ?? []);
        setTotalPages(res.totalPages ?? 0);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load copy configs');
        setConfigs([]);
        setLoading(false);
      });
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  function onFilterChange(f: FilterStatus) {
    setFilter(f);
    setPage(1);
    load(f, 1);
  }

  async function doAction(configId: string, action: 'pause' | 'resume' | 'stop') {
    setActionLoading((prev) => ({ ...prev, [configId]: true }));
    try {
      const res = await fetch(`/api/v1/copy/${configId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs((prev) =>
          prev.map((c) => (c.id === configId ? { ...c, status: data.status } : c)),
        );
        toast.success(`Config ${action}d`);
      } else {
        toast.error(`Failed to ${action} config`);
      }
    } catch {
      toast.error(`Failed to ${action} config`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [configId]: false }));
    }
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Copy className="size-6 text-pf-cyan-400" />
          <h1 className="text-2xl font-semibold text-pf-text">Copy Trading</h1>
        </div>
        {!loading && configs.length > 0 && (
          <Link
            to="/copy/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors"
          >
            <Plus className="size-4" /> New Copy Config
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === f.value
                ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                : 'border-pf-border text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="size-10 text-pf-text-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="4" />
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            <circle cx="16" cy="4" r="3" opacity="0.6" />
            <path d="M21 21v-2a3 3 0 0 0-3-3h-1" opacity="0.6" />
          </svg>
          <p className="text-pf-text font-medium">No copy configs yet</p>
          <p className="text-sm text-pf-text-muted mt-1">
            Start copying a whale's trades to automate your trading.
          </p>
          <Link
            to="/copy/new"
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors"
          >
            <Plus className="size-4" /> New Copy Config
          </Link>
        </div>
      )}

      {/* Config cards */}
      {!loading && configs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {configs.map((config) => {
            const statusStyle = STATUS_STYLES[config.status];
            const modeStyle = MODE_STYLES[config.mode];
            const busy = !!actionLoading[config.id];

            return (
              <div
                key={config.id}
                data-testid="copy-config-card"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/copy/${config.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(`/copy/${config.id}`);
                }}
                className="group bg-pf-elevated border border-pf-border rounded-pf-lg p-5 cursor-pointer transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5"
              >
                {/* Wallet + Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm text-pf-text group-hover:text-pf-cyan-400 transition-colors truncate">
                      {truncateAddress(config.targetWallet)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(config.targetWallet);
                      }}
                      className="text-pf-text-muted hover:text-pf-text transition-colors shrink-0"
                      title="Copy address"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <span
                    data-testid="status-badge"
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot} ${
                        config.status === 'ACTIVE' ? 'animate-pulse-dot' : ''
                      }`}
                    />
                    {config.status}
                  </span>
                </div>

                {/* Mode + Size badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${modeStyle.bg} ${modeStyle.text}`}
                  >
                    {config.mode}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted text-[11px] font-medium">
                    {sizeLabel(config.mode, config.sizeValue)}
                  </span>
                </div>

                {/* Risk limits */}
                <div className="flex items-center gap-4 text-xs text-pf-text-secondary mb-3">
                  <span>
                    Max Exp: <span className="font-mono text-pf-text">${config.maxExposure.toLocaleString()}</span>
                  </span>
                  <span>
                    Max Loss: <span className="font-mono text-pf-text">${config.maxDailyLoss.toLocaleString()}</span>
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-xs text-pf-text-secondary">
                    P&L:{' '}
                    <span
                      className={`font-mono font-medium ${
                        config.totalPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'
                      }`}
                    >
                      {formatPnl(config.totalPnl)}
                    </span>
                  </span>
                  <span className="text-xs text-pf-text-secondary">
                    Trades:{' '}
                    <span className="font-mono text-pf-text">{config.totalCopiedTrades}</span>
                  </span>
                </div>

                {/* Action buttons */}
                <div
                  className="flex items-center justify-end gap-1 pt-3 border-t border-pf-border-subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  {config.status === 'ACTIVE' && (
                    <button
                      onClick={() => doAction(config.id, 'pause')}
                      disabled={busy}
                      className="p-1.5 rounded-pf-sm text-pf-warning hover:bg-pf-warning/10 disabled:opacity-40 transition-colors"
                      aria-label="Pause config"
                      title="Pause"
                    >
                      <Pause className="size-3.5" />
                    </button>
                  )}
                  {config.status === 'PAUSED' && (
                    <button
                      onClick={() => doAction(config.id, 'resume')}
                      disabled={busy}
                      className="p-1.5 rounded-pf-sm text-pf-cyan-400 hover:bg-pf-cyan-500/10 disabled:opacity-40 transition-colors"
                      aria-label="Resume config"
                      title="Resume"
                    >
                      <Play className="size-3.5" />
                    </button>
                  )}
                  {config.status !== 'STOPPED' && (
                    <button
                      onClick={() => doAction(config.id, 'stop')}
                      disabled={busy}
                      className="p-1.5 rounded-pf-sm text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors"
                      aria-label="Stop config"
                      title="Stop"
                    >
                      <Square className="size-3.5" />
                    </button>
                  )}
                  <Link
                    to={`/copy/${config.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-pf-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-overlay transition-colors"
                    aria-label="View config details"
                    title="View details"
                  >
                    <Eye className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => {
              const p = Math.max(1, page - 1);
              setPage(p);
              load(undefined, p);
            }}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => {
              const p = Math.min(totalPages, page + 1);
              setPage(p);
              load(undefined, p);
            }}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
