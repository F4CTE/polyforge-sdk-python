import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Play,
  Pause,
  Square,
  Pencil,
  Zap,
  FileText,
  Code2,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type StrategyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'PAPER' | 'ARCHIVED';
type ExecMode = 'TICK' | 'EVENT' | 'HYBRID';
type FilterStatus = 'ALL' | StrategyStatus;

interface BlockConfig {
  type: string;
  config: Record<string, string | number>;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  visibility: string;
  execMode: ExecMode;
  tickMs: number;
  triggers: BlockConfig[];
  conditions: BlockConfig[];
  actions: BlockConfig[];
  safety: BlockConfig[];
  status: StrategyStatus;
  version: number;
  template: boolean;
  forkedFromId: string | null;
  forkCount: number;
  likeCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  totalPnl?: number;
  pnlHistory?: number[];
}

interface StrategiesResponse {
  data: Strategy[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<StrategyStatus, { dot: string; bg: string; text: string }> = {
  RUNNING:  { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  PAPER:    { dot: 'bg-cyan-400',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400' },
  PAUSED:   { dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  IDLE:     { dot: 'bg-gray-400',    bg: 'bg-gray-500/10',    text: 'text-gray-400' },
  ERROR:    { dot: 'bg-red-400',     bg: 'bg-red-500/10',     text: 'text-red-400' },
  ARCHIVED: { dot: 'bg-gray-500',    bg: 'bg-gray-500/10',    text: 'text-gray-500' },
};

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Idle', value: 'IDLE' },
  { label: 'Paper', value: 'PAPER' },
  { label: 'Error', value: 'ERROR' },
];

function execLabel(s: Strategy): string {
  if (s.execMode === 'TICK') return `Tick \u00B7 ${s.tickMs}ms`;
  if (s.execMode === 'EVENT') return 'Event';
  return `Hybrid \u00B7 ${s.tickMs}ms`;
}

function blocksCount(s: Strategy): number {
  return s.safety.length + s.triggers.length + s.conditions.length + s.actions.length;
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-3 animate-pulse">
      <div className="h-5 bg-pf-overlay rounded w-[60%]" />
      <div className="h-3 bg-pf-overlay rounded w-[40%]" />
      <div className="h-3 bg-pf-overlay rounded w-[80%]" />
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const navigate = useNavigate();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  function load(status?: FilterStatus) {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    const s = status ?? filter;
    if (s !== 'ALL') params.set('status', s);
    fetch(`/api/v1/strategies?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res: StrategiesResponse) => {
        setStrategies(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onFilterChange(f: FilterStatus) {
    setFilter(f);
    load(f);
  }

  async function doAction(
    strategyId: string,
    action: 'start' | 'stop' | 'pause' | 'resume',
    body?: object,
  ) {
    setActionLoading((prev) => ({ ...prev, [strategyId]: true }));
    try {
      const res = await fetch(`/api/v1/strategies/${strategyId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategies((prev) =>
          prev.map((s) => (s.id === strategyId ? { ...s, status: data.status } : s)),
        );
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [strategyId]: false }));
    }
  }

  function isActive(s: Strategy) { return s.status === 'RUNNING' || s.status === 'PAPER'; }
  function isPaused(s: Strategy) { return s.status === 'PAUSED'; }
  function isIdle(s: Strategy) { return s.status === 'IDLE' || s.status === 'ERROR'; }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">My Strategies</h1>
        <Link
          to="/strategies/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-white text-sm font-medium hover:bg-pf-cyan-600 transition-colors"
        >
          <Plus className="size-4" /> New Strategy
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-pf-surface rounded-pf-md border border-pf-border-subtle w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-pf-sm text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-pf-elevated text-pf-text shadow-pf-xs'
                : 'text-pf-text-muted hover:text-pf-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && strategies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Code2 className="size-10 text-pf-text-muted mb-4" />
          <p className="text-pf-text font-medium">No strategies yet</p>
          <p className="text-sm text-pf-text-muted mt-1">Create your first strategy to start trading.</p>
          <Link
            to="/strategies/new"
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-white text-sm font-medium hover:bg-pf-cyan-600 transition-colors"
          >
            <Plus className="size-4" /> New Strategy
          </Link>
        </div>
      )}

      {/* Strategy grid */}
      {!loading && strategies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => {
            const statusStyle = STATUS_STYLES[strategy.status] ?? STATUS_STYLES.IDLE;
            const pnl = strategy.totalPnl ?? null;
            const busy = !!actionLoading[strategy.id];

            return (
              <div
                key={strategy.id}
                data-testid="strategy-card"
                onClick={() => navigate(`/strategies/${strategy.id}`)}
                className="group bg-pf-elevated border border-pf-border rounded-pf-lg p-5 cursor-pointer hover:border-pf-border-strong hover:shadow-pf-md transition-all"
              >
                {/* Name + status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-medium text-pf-text leading-snug line-clamp-1 group-hover:text-pf-cyan-400 transition-colors">
                    {strategy.name}
                  </h3>
                  <span data-testid="status-badge" className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${isActive(strategy) ? 'animate-pulse' : ''}`} />
                    {strategy.status}
                  </span>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pf-cyan-500/10 text-pf-cyan-400 text-[11px] font-medium">
                    {execLabel(strategy)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted text-[11px] font-medium">
                    {blocksCount(strategy)} blocks
                  </span>
                  {strategy.tags.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted text-[11px] font-medium">
                      {strategy.tags[0]}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[11px] font-medium ml-auto">
                    v{strategy.version}
                  </span>
                </div>

                {/* Description */}
                {strategy.description && (
                  <p className="text-xs text-pf-text-secondary line-clamp-2 mb-3">
                    {strategy.description}
                  </p>
                )}

                {/* P&L */}
                <div className="mb-3">
                  {pnl !== null ? (
                    <span className={`font-mono text-sm font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPnl(pnl)}
                    </span>
                  ) : (
                    <span className="font-mono text-sm text-pf-text-muted">P&L: &mdash;</span>
                  )}
                </div>

                {/* Footer: date + actions */}
                <div
                  className="flex items-center justify-between pt-3 border-t border-pf-border-subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-mono text-[11px] text-pf-text-muted">
                    {formatDate(strategy.updatedAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    {isIdle(strategy) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'start', { mode: 'live' }); }}
                          disabled={busy}
                          className="flex items-center gap-1 px-2 py-1 rounded-pf-sm bg-pf-cyan-500/10 text-pf-cyan-400 text-[11px] font-medium hover:bg-pf-cyan-500/20 disabled:opacity-40 transition-colors"
                          title="Start Live"
                        >
                          <Zap className="size-3" /> Live
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'start', { mode: 'paper' }); }}
                          disabled={busy}
                          className="flex items-center gap-1 px-2 py-1 rounded-pf-sm bg-pf-overlay text-pf-text-secondary text-[11px] font-medium hover:bg-pf-border-subtle disabled:opacity-40 transition-colors"
                          title="Start Paper"
                        >
                          <FileText className="size-3" /> Paper
                        </button>
                      </>
                    )}

                    {isActive(strategy) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'pause'); }}
                          disabled={busy}
                          className="p-1.5 rounded-pf-sm text-pf-text-secondary hover:bg-pf-overlay disabled:opacity-40 transition-colors"
                          title="Pause"
                        >
                          <Pause className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'stop'); }}
                          disabled={busy}
                          className="p-1.5 rounded-pf-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                          title="Stop"
                        >
                          <Square className="size-3.5" />
                        </button>
                      </>
                    )}

                    {isPaused(strategy) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'resume'); }}
                          disabled={busy}
                          className="p-1.5 rounded-pf-sm text-pf-cyan-400 hover:bg-pf-cyan-500/10 disabled:opacity-40 transition-colors"
                          title="Resume"
                        >
                          <Play className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'stop'); }}
                          disabled={busy}
                          className="p-1.5 rounded-pf-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                          title="Stop"
                        >
                          <Square className="size-3.5" />
                        </button>
                      </>
                    )}

                    {/* Edit */}
                    <Link
                      to={`/strategies/${strategy.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-pf-sm text-pf-text-muted hover:text-pf-text-secondary hover:bg-pf-overlay transition-colors"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
