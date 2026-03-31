import { useState, useEffect, useCallback, useRef } from 'react';
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
  TrendingUp,
  Check,
  X,
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
  /* ── per-trader copy stats (optional, populated by API when available) ── */
  copiedPnl?: string;
  copiedWinRate?: string;
  copiedTradeCount?: number;
  copyingSince?: string;
  maxLossUsdc?: number | null;
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

function relativeDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

/* ─── Max-loss inline editor ─────────────────────────────────────────── */

function MaxLossEditor({
  configId,
  value,
  onSaved,
}: {
  configId: string;
  value?: number | null;
  onSaved: (newVal: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(value != null ? String(value) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function save(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    const parsed = draft.trim() === '' ? null : Number(draft);
    if (draft.trim() !== '' && (Number.isNaN(parsed) || (parsed as number) < 0)) {
      toast.error('Enter a valid positive amount or leave blank for no limit');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/copy/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ maxLossUsdc: parsed }),
      });
      if (res.ok) {
        onSaved(parsed);
        setEditing(false);
        toast.success('Max loss limit updated');
      } else {
        toast.error('Failed to update max loss limit');
      }
    } catch {
      toast.error('Failed to update max loss limit');
    } finally {
      setSaving(false);
    }
  }

  function cancel(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-pf-text-muted text-[11px]">$</span>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={1}
          placeholder="no limit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save(e as unknown as React.KeyboardEvent);
            if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
          }}
          disabled={saving}
          className="w-20 px-1.5 py-0.5 rounded bg-pf-surface border border-pf-cyan-500/40 text-pf-text text-[11px] font-mono focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-pf-success hover:text-pf-success/80 disabled:opacity-40 transition-colors"
          aria-label="Save max loss"
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-pf-text-muted hover:text-pf-text transition-colors"
          aria-label="Cancel"
        >
          <X className="size-3" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to set max loss limit"
      className="inline-flex items-center gap-1 text-pf-text-secondary hover:text-pf-text transition-colors"
    >
      <span className="text-[11px]">
        {value != null ? `$${Number(value).toFixed(2)}` : 'No limit'}
      </span>
      <Pencil className="size-2.5 text-pf-text-muted" />
    </button>
  );
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
    /* Optimistic status update */
    const optimisticStatus: CopyStatus =
      action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : 'STOPPED';
    setConfigs((prev) =>
      prev.map((c) => (c.id === configId ? { ...c, status: optimisticStatus } : c)),
    );
    try {
      /* Try PATCH first (new API shape), fall back to POST action endpoint */
      const patchStatus = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'ACTIVE' : 'STOPPED';
      const res = await fetch(`/api/v1/copy/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: patchStatus }),
      });
      const finalRes = res.ok ? res : await fetch(`/api/v1/copy/${configId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (finalRes.ok) {
        const data = await finalRes.json();
        setConfigs((prev) =>
          prev.map((c) => (c.id === configId ? { ...c, status: data.status ?? optimisticStatus } : c)),
        );
        toast.success(`Config ${action}d`);
      } else {
        /* Revert optimistic update */
        setConfigs((prev) =>
          prev.map((c) =>
            c.id === configId
              ? { ...c, status: action === 'pause' ? 'ACTIVE' : action === 'resume' ? 'PAUSED' : c.status }
              : c,
          ),
        );
        toast.error(`Failed to ${action} config`);
      }
    } catch {
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === configId
            ? { ...c, status: action === 'pause' ? 'ACTIVE' : action === 'resume' ? 'PAUSED' : c.status }
            : c,
        ),
      );
      toast.error(`Failed to ${action} config`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [configId]: false }));
    }
  }

  function updateConfigField(configId: string, patch: Partial<CopyConfig>) {
    setConfigs((prev) => prev.map((c) => (c.id === configId ? { ...c, ...patch } : c)));
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Copy className="size-6 text-pf-cyan-400" aria-hidden="true" />
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
            type="button"
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors cursor-pointer ${
              filter === f.value
                ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                : 'border-pf-border text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary stats bar */}
      {!loading && configs.length > 0 && (() => {
        const active = configs.filter((c) => c.status === 'ACTIVE').length;
        const paused = configs.filter((c) => c.status === 'PAUSED').length;
        const totalPnl = configs.reduce((sum, c) => {
          const val = c.copiedPnl
            ? parseFloat(c.copiedPnl.replace(/[^0-9.-]/g, ''))
            : c.totalPnl;
          return sum + (Number.isNaN(val) ? 0 : val);
        }, 0);
        const pnlPositive = totalPnl >= 0;
        return (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-pf-lg bg-pf-elevated border border-pf-border text-sm">
            <span className="flex items-center gap-1.5 text-pf-text-secondary">
              <TrendingUp className="size-4 text-pf-cyan-400" aria-hidden="true" />
              <span className="font-medium text-pf-text">{configs.length}</span>
              <span>trader{configs.length !== 1 ? 's' : ''} copied</span>
            </span>
            <span className="text-pf-border-strong">|</span>
            <span className="text-pf-text-secondary">
              Total copied P&L:{' '}
              <span className={`font-mono font-medium ${pnlPositive ? 'text-pf-success' : 'text-pf-danger'}`}>
                {formatPnl(totalPnl)}
              </span>
            </span>
            <span className="text-pf-border-strong">|</span>
            <span className="text-pf-text-secondary">
              <span className="font-medium text-pf-success">{active} active</span>
              {paused > 0 && (
                <>, <span className="font-medium text-pf-warning">{paused} paused</span></>
              )}
            </span>
          </div>
        );
      })()}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="size-10 text-pf-text-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                aria-label={`Copy config for wallet ${truncateAddress(config.targetWallet)}, status: ${config.status}`}
                onClick={() => navigate(`/copy/${config.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/copy/${config.id}`); }
                }}
                className="group bg-pf-elevated border border-pf-border rounded-pf-lg p-5 cursor-pointer transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
              >
                {/* Wallet + Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm text-pf-text group-hover:text-pf-cyan-400 transition-colors truncate">
                      {truncateAddress(config.targetWallet)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(config.targetWallet);
                      }}
                      className="text-pf-text-muted hover:text-pf-text transition-colors shrink-0"
                      title="Copy address"
                      aria-label="Copy wallet address"
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

                {/* Per-trader P&L breakdown */}
                <div className="rounded-pf bg-pf-surface border border-pf-border-subtle p-3 mb-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-pf-text-secondary">Copied P&L</span>
                    <span
                      className={`font-mono font-semibold ${
                        config.copiedPnl
                          ? config.copiedPnl.startsWith('-') ? 'text-pf-danger' : 'text-pf-success'
                          : config.totalPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'
                      }`}
                    >
                      {config.copiedPnl ?? formatPnl(config.totalPnl)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-pf-text-secondary">Win rate</span>
                    <span className="font-mono text-pf-text">
                      {config.copiedWinRate ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-pf-text-secondary">Trades copied</span>
                    <span className="font-mono text-pf-text">
                      {config.copiedTradeCount ?? config.totalCopiedTrades} trades
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-pf-text-secondary">Copying since</span>
                    <span className="font-mono text-pf-text text-[11px]">
                      {config.copyingSince ? relativeDate(config.copyingSince) : relativeDate(config.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Risk limits + max loss editor */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-pf-text-secondary mb-3">
                  <span>
                    Max Exp: <span className="font-mono text-pf-text">${config.maxExposure.toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    Max loss:{' '}
                    <MaxLossEditor
                      configId={config.id}
                      value={config.maxLossUsdc}
                      onSaved={(val) => updateConfigField(config.id, { maxLossUsdc: val })}
                    />
                  </span>
                </div>

                {/* Action buttons */}
                <div
                  className="flex items-center justify-between gap-1 pt-3 border-t border-pf-border-subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    {config.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => doAction(config.id, 'pause')}
                        disabled={busy}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-pf-sm text-xs font-medium text-pf-warning bg-pf-warning/10 hover:bg-pf-warning/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
                        aria-label="Pause config"
                      >
                        <Pause className="size-3" /> Pause
                      </button>
                    )}
                    {config.status === 'PAUSED' && (
                      <button
                        type="button"
                        onClick={() => doAction(config.id, 'resume')}
                        disabled={busy}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-pf-sm text-xs font-medium text-pf-success bg-pf-success/10 hover:bg-pf-success/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
                        aria-label="Resume config"
                      >
                        <Play className="size-3" /> Resume
                      </button>
                    )}
                    {config.status !== 'STOPPED' && (
                      <button
                        type="button"
                        onClick={() => doAction(config.id, 'stop')}
                        disabled={busy}
                        className="px-2.5 py-1.5 rounded-pf-sm text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
                        aria-label="Stop config"
                        title="Stop"
                      >
                        <Square className="size-3.5" />
                      </button>
                    )}
                  </div>
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
            type="button"
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
            type="button"
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
