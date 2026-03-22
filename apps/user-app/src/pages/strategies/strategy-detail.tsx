import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Pencil,
  Zap,
  Shield,
  Filter,
  PlayCircle,
  FileText,
  Download,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

type StrategyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'PAPER' | 'ARCHIVED';
type ExecMode = 'TICK' | 'EVENT' | 'HYBRID';

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
}

interface LiveLogEntry {
  time: Date;
  type: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
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

const LOG_COLORS: Record<LiveLogEntry['severity'], string> = {
  success: 'text-emerald-400',
  info: 'text-pf-cyan-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

const LOG_DOT_COLORS: Record<LiveLogEntry['severity'], string> = {
  success: 'bg-emerald-400',
  info: 'bg-pf-cyan-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
};

function blockLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function execLabel(s: Strategy): string {
  if (s.execMode === 'TICK') return `Tick \u00B7 ${s.tickMs}ms`;
  if (s.execMode === 'EVENT') return 'Event';
  return `Hybrid \u00B7 ${s.tickMs}ms`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function isActive(status: StrategyStatus) { return status === 'RUNNING' || status === 'PAPER'; }
function isPaused(status: StrategyStatus) { return status === 'PAUSED'; }
function isIdle(status: StrategyStatus) { return status === 'IDLE' || status === 'ERROR'; }

/* ─── Section icons ──────────────────────────────────────────────────── */

const SECTION_ICONS: Record<string, React.ReactNode> = {
  safety: <Shield className="size-3" />,
  trigger: <Zap className="size-3" />,
  condition: <Filter className="size-3" />,
  action: <PlayCircle className="size-3" />,
};

const SECTION_STYLES: Record<string, string> = {
  safety: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  trigger: 'bg-pf-cyan-500/10 text-pf-cyan-400 border-pf-cyan-500/20',
  condition: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  action: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveLog] = useState<LiveLogEntry[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/v1/strategies/${id}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        if (r.status === 403) { setLoadError('You do not have permission to view this strategy.'); setLoading(false); return null; }
        if (!r.ok) { setLoadError('Failed to load strategy. Please try again.'); setLoading(false); return null; }
        return r.json();
      })
      .then((s: Strategy | null) => {
        if (s) { setStrategy(s); setLoading(false); }
      })
      .catch(() => { setLoadError('Failed to load strategy. Please try again.'); setLoading(false); });
  }, [id]);

  async function doAction(action: 'start' | 'stop' | 'pause' | 'resume', body?: object) {
    if (!strategy) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/strategies/${strategy.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategy((prev) => prev ? { ...prev, status: data.status } : prev);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport() {
    if (!strategy) return;
    try {
      const res = await fetch(`/api/v1/strategies/${strategy.id}/export`, {
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Failed to export strategy');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `${strategy.name}.polyforge`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Strategy exported');
    } catch {
      toast.error('Failed to export strategy');
    }
  }

  function handleShare() {
    if (!strategy) return;
    const url = `${window.location.origin}/strategies/${strategy.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  }

  const status = strategy?.status ?? 'IDLE';
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.IDLE;
  const totalBlocks = strategy
    ? strategy.safety.length + strategy.triggers.length + strategy.conditions.length + strategy.actions.length
    : 0;
  const pnl = strategy?.totalPnl ?? null;

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Link
        to="/strategies"
        className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Strategies
      </Link>

      {/* Loading */}
      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="h-7 bg-pf-overlay rounded w-[40%]" />
          <div className="h-4 bg-pf-overlay rounded w-[60%]" />
        </div>
      )}

      {/* Not found */}
      {!loading && notFound && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-pf-text font-medium text-lg">Strategy not found</p>
          <p className="text-sm text-pf-text-muted mt-1">This strategy may have been deleted or the link is invalid.</p>
          <button
            onClick={() => navigate('/strategies')}
            className="mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors"
          >
            Back to Strategies
          </button>
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-pf-text font-medium">{loadError}</p>
          <button
            onClick={() => navigate('/strategies')}
            className="mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors"
          >
            Back to Strategies
          </button>
        </div>
      )}

      {/* Strategy detail */}
      {!loading && strategy && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-xl font-semibold text-pf-text">{strategy.name}</h1>
                <span data-testid="status-badge" className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${isActive(status) ? 'animate-pulse-dot' : ''}`} />
                  {status}
                </span>
              </div>
              {strategy.description && (
                <p className="text-sm text-pf-text-secondary">{strategy.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isIdle(status) && (
                <>
                  <button
                    onClick={() => doAction('start', { mode: 'live' })}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-600 disabled:opacity-40 transition-colors"
                  >
                    <Zap className="size-3.5" /> Start Live
                  </button>
                  <button
                    onClick={() => doAction('start', { mode: 'paper' })}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors"
                  >
                    <FileText className="size-3.5" /> Start Paper
                  </button>
                </>
              )}
              {isActive(status) && (
                <>
                  <button
                    onClick={() => doAction('pause')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors"
                  >
                    <Pause className="size-3.5" /> Pause
                  </button>
                  <button
                    onClick={() => doAction('stop')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors text-sm"
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                </>
              )}
              {isPaused(status) && (
                <>
                  <button
                    onClick={() => doAction('resume')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-600 disabled:opacity-40 transition-colors"
                  >
                    <Play className="size-3.5" /> Resume
                  </button>
                  <button
                    onClick={() => doAction('stop')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors text-sm"
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                </>
              )}
              <Link
                to={`/strategies/${strategy.id}/edit`}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                title="Edit"
              >
                <Pencil className="size-4" />
              </Link>
              <button
                onClick={handleExport}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                title="Export"
              >
                <Download className="size-4" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                title="Share"
              >
                <Share2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium">
              {execLabel(strategy)}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium">
              v{strategy.version}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium">
              {strategy.visibility.toLowerCase()}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium">
              {totalBlocks} blocks
            </span>
            {strategy.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full bg-pf-cyan-500/10 text-pf-cyan-400 text-xs font-medium">
                {tag}
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-full text-pf-text-muted text-xs ml-auto">
              Updated {formatDate(strategy.updatedAt)}
            </span>
          </div>

          {/* P&L */}
          {pnl !== null && (
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <span className="text-xs text-pf-text-muted block mb-1">Total P&L</span>
              <span className={`font-mono text-2xl font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPnl(pnl)}
              </span>
            </div>
          )}

          {/* Body grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Blocks summary */}
            <div className="lg:col-span-3 bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-5">
              {(
                [
                  { key: 'safety', title: 'Safety', blocks: strategy.safety },
                  { key: 'trigger', title: 'Triggers', blocks: strategy.triggers },
                  { key: 'condition', title: 'Conditions', blocks: strategy.conditions },
                  { key: 'action', title: 'Actions', blocks: strategy.actions },
                ] as const
              )
                .filter(({ blocks }) => blocks.length > 0)
                .map(({ key, title, blocks }) => (
                  <div key={key}>
                    <h4 className="text-xs font-medium text-pf-text-secondary uppercase tracking-wider mb-2">
                      {title}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {blocks.map((b, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pf-sm border text-xs font-medium ${SECTION_STYLES[key]}`}
                        >
                          {SECTION_ICONS[key]}
                          {blockLabel(b.type)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

              {totalBlocks === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <p className="text-sm text-pf-text-muted mb-3">No blocks configured.</p>
                  <Link
                    to={`/strategies/${strategy.id}/edit`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                  >
                    <Pencil className="size-3" /> Edit Strategy
                  </Link>
                </div>
              )}
            </div>

            {/* Live events */}
            <div className="lg:col-span-2 bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
                <span className="text-sm font-medium text-pf-text">Live Events</span>
                {isActive(status) && (
                  <span className="flex items-center gap-1.5 text-xs text-pf-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-pf-cyan-400 animate-pulse-dot" />
                    Live
                  </span>
                )}
              </div>

              <div className="p-4 max-h-80 overflow-y-auto">
                {liveLog.length === 0 ? (
                  <div className="py-8 text-center text-sm text-pf-text-muted">
                    {isActive(status) ? 'Waiting for events\u2026' : 'Start the strategy to see live events.'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {liveLog.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-pf-text-muted shrink-0 w-16">
                          {formatTime(entry.time)}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${LOG_DOT_COLORS[entry.severity]}`} />
                        <span className={LOG_COLORS[entry.severity]}>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
