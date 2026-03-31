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
  GitBranch,
  Store,
  X,
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
  parentStrategyId: string | null;
  forkedFromId: string | null;
  forkCount: number;
  likeCount: number;
  childCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  totalPnl?: number;
}

interface ChildStrategy {
  id: string;
  name: string;
  status: StrategyStatus;
}

interface ParentStrategy {
  id: string;
  name: string;
}

interface LiveLogEntry {
  time: Date;
  type: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<StrategyStatus, { dot: string; bg: string; text: string }> = {
  RUNNING:  { dot: 'bg-pf-success', bg: 'bg-pf-success/10', text: 'text-pf-success' },
  PAPER:    { dot: 'bg-pf-cyan-400',    bg: 'bg-pf-cyan-500/10',    text: 'text-pf-cyan-400' },
  PAUSED:   { dot: 'bg-pf-warning',   bg: 'bg-pf-warning/10',   text: 'text-pf-warning' },
  IDLE:     { dot: 'bg-pf-text-muted',    bg: 'bg-pf-overlay',    text: 'text-pf-text-muted' },
  ERROR:    { dot: 'bg-pf-danger',     bg: 'bg-pf-danger/10',     text: 'text-pf-danger' },
  ARCHIVED: { dot: 'bg-pf-text-muted',    bg: 'bg-pf-overlay',    text: 'text-pf-text-muted' },
};

const LOG_COLORS: Record<LiveLogEntry['severity'], string> = {
  success: 'text-pf-success',
  info: 'text-pf-cyan-400',
  warning: 'text-pf-warning',
  error: 'text-pf-danger',
};

const LOG_DOT_COLORS: Record<LiveLogEntry['severity'], string> = {
  success: 'bg-pf-success',
  info: 'bg-pf-cyan-400',
  warning: 'bg-pf-warning',
  error: 'bg-pf-danger',
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
  return new Date(dateStr).toLocaleDateString('en-US', {
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
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  safety: 'bg-pf-warning/10 text-pf-warning border-pf-warning/20',
  trigger: 'bg-pf-cyan-500/10 text-pf-cyan-400 border-pf-cyan-500/20',
  condition: 'bg-pf-purple-500/10 text-pf-purple-500 border-pf-purple-500/20',
  action: 'bg-pf-success/10 text-pf-success border-pf-success/20',
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
  const [childStrategies, setChildStrategies] = useState<ChildStrategy[]>([]);
  const [parentStrategy, setParentStrategy] = useState<ParentStrategy | null>(null);
  const [recentOrderCount, setRecentOrderCount] = useState<number | null>(null);
  const [lastOrderAt, setLastOrderAt] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'log' | 'versions'>('overview');
  const [execLog, setExecLog] = useState<Array<{id: string; eventType: string; payload: any; createdAt: string}>>([]);
  const [versions, setVersions] = useState<Array<{id: string; version: number; changedBy: string; createdAt: string; triggers: any; conditions: any; actions: any}>>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [stratPnl, setStratPnl] = useState<{ totalPnl: string; winRate: string } | null>(null);

  // Marketplace listing state
  const [showListing, setShowListing] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [listPrice, setListPrice] = useState('0');
  const [listTags, setListTags] = useState('');
  const [listSubmitting, setListSubmitting] = useState(false);

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
        if (s) {
          setStrategy(s);
          setLoading(false);

          // Fetch recent orders count for health metrics
          fetch(`/api/v1/orders?strategyId=${s.id}&limit=5`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(res => {
              if (res) {
                setRecentOrderCount(res.total ?? res.data?.length ?? 0);
                const latest = res.data?.[0];
                if (latest?.createdAt) setLastOrderAt(latest.createdAt);
              }
            })
            .catch(() => {});

          // Fetch children if any
          if (s.childCount > 0) {
            fetch(`/api/v1/strategies/${s.id}/children`, { credentials: 'include' })
              .then((r) => r.ok ? r.json() : { children: [] })
              .then((res) => setChildStrategies(res.children ?? []))
              .catch(() => setChildStrategies([]));
          }

          // Fetch parent if has one
          if (s.parentStrategyId) {
            fetch(`/api/v1/strategies/${s.parentStrategyId}`, { credentials: 'include' })
              .then((r) => r.ok ? r.json() : null)
              .then((parent) => {
                if (parent) setParentStrategy({ id: parent.id, name: parent.name });
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => { setLoadError('Failed to load strategy. Please try again.'); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!strategy?.id) return;
    if (detailTab === 'log') {
      setLoadingLog(true);
      fetch(`/api/v1/strategies/${strategy.id}/event-log?limit=50`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(d => setExecLog(Array.isArray(d) ? d : (d.data ?? [])))
        .catch(() => {})
        .finally(() => setLoadingLog(false));
    }
    if (detailTab === 'versions') {
      setLoadingVersions(true);
      fetch(`/api/v1/strategies/${strategy.id}/versions`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(d => setVersions(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setLoadingVersions(false));
    }
  }, [detailTab, strategy?.id]);

  useEffect(() => {
    if (!strategy) return;
    fetch(`/api/v1/portfolio/pnl?strategyId=${strategy.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStratPnl({ totalPnl: data.totalPnl, winRate: data.winRate }); })
      .catch(() => {});
  }, [strategy?.id]);

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
        toast.success(`Strategy ${action}${action.endsWith('e') ? 'd' : 'ed'}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? `Failed to ${action} strategy`);
      }
    } catch {
      toast.error(`Failed to ${action} strategy`);
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
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Link copied to clipboard');
      }).catch(() => {
        prompt('Copy this link:', url);
      });
    } else {
      prompt('Copy this link:', url);
    }
  }

  async function submitListing() {
    if (!strategy || !listTitle) return;
    setListSubmitting(true);
    try {
      const tags = listTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch('/api/v1/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategyId: strategy.id,
          title: listTitle,
          description: listDesc || undefined,
          priceUsdc: parseFloat(listPrice) || 0,
          tags,
        }),
      });
      if (res.ok) {
        toast.success('Strategy listed on Marketplace!');
        setShowListing(false);
        setListTitle('');
        setListDesc('');
        setListPrice('0');
        setListTags('');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error((data as any).message ?? 'Failed to list strategy');
      }
    } catch {
      toast.error('Failed to list strategy');
    }
    setListSubmitting(false);
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
        className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Strategies
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
            type="button"
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
            type="button"
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
                <h1 className="text-2xl font-semibold text-pf-text">{strategy.name}</h1>
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
                    type="button"
                    onClick={() => doAction('start', { mode: 'live' })}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors"
                  >
                    <Zap className="size-3.5" /> Start Live
                  </button>
                  <button
                    type="button"
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
                    type="button"
                    onClick={() => doAction('pause')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors"
                  >
                    <Pause className="size-3.5" /> Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => doAction('stop')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors text-sm"
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                </>
              )}
              {isPaused(status) && (
                <>
                  <button
                    type="button"
                    onClick={() => doAction('resume')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors"
                  >
                    <Play className="size-3.5" /> Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => doAction('stop')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-pf text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors text-sm"
                  >
                    <Square className="size-3.5" /> Stop
                  </button>
                </>
              )}
              <Link
                to={`/strategies/${strategy.id}/edit`}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                aria-label="Edit strategy"
                title="Edit strategy"
              >
                <Pencil className="size-4" />
              </Link>
              <button
                type="button"
                onClick={handleExport}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                aria-label="Export strategy"
                title="Export strategy"
              >
                <Download className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                aria-label="Share strategy"
                title="Share"
              >
                <Share2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => { setListTitle(strategy.name); setShowListing((v) => !v); }}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-cyan-400 transition-colors"
                aria-label="List on Marketplace"
                title="List on Marketplace"
              >
                <Store className="size-4" />
              </button>
            </div>
          </div>

          {/* Marketplace listing form */}
          {showListing && (
            <div className="bg-pf-elevated border border-pf-cyan-500/30 rounded-pf-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-pf-text flex items-center gap-2">
                  <Store className="size-4 text-pf-cyan-400" />
                  List on Marketplace
                </span>
                <button type="button" onClick={() => setShowListing(false)} className="text-pf-text-muted hover:text-pf-text transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-pf-text-secondary mb-1">Listing Title *</label>
                  <input
                    type="text"
                    value={listTitle}
                    onChange={(e) => setListTitle(e.target.value)}
                    placeholder="Strategy name for the marketplace"
                    className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-pf-text-secondary mb-1">Description</label>
                  <textarea
                    value={listDesc}
                    onChange={(e) => setListDesc(e.target.value)}
                    rows={2}
                    placeholder="Describe your strategy's edge..."
                    className="w-full px-3 py-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-pf-text-secondary mb-1">Price (USDC)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      placeholder="0"
                      className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm font-mono text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
                    />
                    <p className="text-[10px] text-pf-text-muted mt-0.5">0 = Free</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-pf-text-secondary mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={listTags}
                      onChange={(e) => setListTags(e.target.value)}
                      placeholder="momentum, political"
                      className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={submitListing}
                disabled={listSubmitting || !listTitle}
                className="w-full py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-semibold hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors"
              >
                {listSubmitting ? 'Publishing...' : 'Publish to Marketplace'}
              </button>
            </div>
          )}

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              strategy.execMode === 'TICK' || strategy.execMode === 'HYBRID'
                ? 'bg-pf-purple-500/10 text-pf-purple-500'
                : 'bg-pf-cyan-500/10 text-pf-cyan-400'
            }`}>
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
              <span key={tag} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                tag.toLowerCase() === 'momentum'
                  ? 'bg-pf-gold-500/10 text-pf-gold-500'
                  : tag.toLowerCase() === 'defensive'
                    ? 'bg-pf-info/10 text-pf-info'
                    : 'bg-pf-cyan-500/10 text-pf-cyan-400'
              }`}>
                {tag}
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-full text-pf-text-muted text-xs ml-auto">
              Updated {formatDate(strategy.updatedAt)}
            </span>
          </div>

          {/* Strategy P&L summary */}
          {stratPnl && parseFloat(stratPnl.totalPnl) !== 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border">
                <span className="text-xs text-pf-text-muted">Strategy P&L</span>
                <span className={`text-sm font-mono font-semibold ${parseFloat(stratPnl.totalPnl) >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                  {parseFloat(stratPnl.totalPnl) >= 0 ? '+' : ''}${parseFloat(stratPnl.totalPnl).toFixed(2)}
                </span>
              </div>
              {parseFloat(stratPnl.winRate) > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border">
                  <span className="text-xs text-pf-text-muted">Win Rate</span>
                  <span className="text-sm font-mono font-semibold text-pf-cyan-400">
                    {(parseFloat(stratPnl.winRate) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Parent strategy link */}
          {parentStrategy && (
            <div className="flex items-center gap-2 px-3 py-2 bg-pf-elevated border border-pf-border rounded-pf-lg">
              <GitBranch className="size-3.5 text-pf-text-muted" />
              <span className="text-xs text-pf-text-muted">Part of:</span>
              <Link
                to={`/strategies/${parentStrategy.id}`}
                className="text-xs text-pf-cyan-400 hover:underline font-medium"
              >
                {parentStrategy.name}
              </Link>
            </div>
          )}

          {/* Sub-Strategies */}
          {childStrategies.length > 0 && (
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <h2 className="text-sm font-medium text-pf-text mb-3 flex items-center gap-2">
                <GitBranch className="size-4" />
                Sub-Strategies
                <span className="text-xs text-pf-text-muted">({childStrategies.length})</span>
              </h2>
              <div className="space-y-2">
                {childStrategies.map((child) => {
                  const childStyle = STATUS_STYLES[child.status] ?? STATUS_STYLES.IDLE;
                  return (
                    <Link
                      key={child.id}
                      to={`/strategies/${child.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-pf-sm border border-pf-border-subtle hover:border-pf-border-strong transition-colors"
                    >
                      <span className="text-xs text-pf-text font-medium">{child.name}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${childStyle.bg} ${childStyle.text}`}
                      >
                        <span className={`w-1 h-1 rounded-full ${childStyle.dot}`} />
                        {child.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Health stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pnl !== null && (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <span className="text-xs text-pf-text-muted block mb-1">Total P&L</span>
                <span className={`font-mono text-xl font-semibold ${pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                  {formatPnl(pnl)}
                </span>
              </div>
            )}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <span className="text-xs text-pf-text-muted block mb-1">Blocks</span>
              <span className="font-mono text-xl font-semibold text-pf-text">{totalBlocks}</span>
            </div>
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <span className="text-xs text-pf-text-muted block mb-1">Recent Orders</span>
              <span className="font-mono text-xl font-semibold text-pf-text">
                {recentOrderCount !== null ? recentOrderCount : '—'}
              </span>
            </div>
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <span className="text-xs text-pf-text-muted block mb-1">Last Order</span>
              <span className="font-mono text-sm font-semibold text-pf-text">
                {lastOrderAt ? new Date(lastOrderAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </span>
            </div>
          </div>

          {/* Detail tab bar */}
          <div className="flex items-center gap-1 border-b border-pf-border-subtle pb-1">
            <button
              type="button"
              onClick={() => setDetailTab('overview')}
              className={`px-3 py-1.5 text-sm rounded-pf transition-colors ${detailTab === 'overview' ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('log')}
              className={`px-3 py-1.5 text-sm rounded-pf transition-colors ${detailTab === 'log' ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`}
            >
              Execution Log
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('versions')}
              className={`px-3 py-1.5 text-sm rounded-pf transition-colors ${detailTab === 'versions' ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`}
            >
              Version History
            </button>
          </div>

          {/* Body grid */}
          {detailTab === 'overview' && <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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
                    <h3 className="text-xs font-medium text-pf-text-secondary uppercase tracking-wider mb-2">
                      {title}
                    </h3>
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
                  <div className="py-8 text-center text-sm text-pf-text-muted space-y-2">
                    <p>{isActive(status) ? 'Strategy is running.' : 'Start the strategy to generate events.'}</p>
                    <p className="text-xs">Check the <a href={`/orders?strategy=${strategy?.id}`} className="text-pf-cyan-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm">Orders</a> page for trade activity.</p>
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
          </div>}

          {detailTab === 'log' && (
            <div className="mt-4">
              {loadingLog ? (
                <p className="text-sm text-pf-text-muted">Loading log...</p>
              ) : execLog.length === 0 ? (
                <div className="text-center py-8 text-pf-text-muted text-sm">
                  <p>No execution events yet.</p>
                  <p className="text-xs mt-1">Events appear when the strategy runs.</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {execLog.map(ev => (
                    <li key={ev.id} className="flex items-start gap-3 rounded-pf bg-pf-surface px-3 py-2 border border-pf-border-subtle">
                      <span className={`mt-0.5 flex-shrink-0 h-2 w-2 rounded-full ${
                        ev.eventType === 'ERROR' ? 'bg-pf-danger' :
                        ev.eventType === 'ORDER_PLACED' ? 'bg-pf-success' :
                        ev.eventType === 'TRIGGERED' ? 'bg-pf-cyan-400' : 'bg-pf-text-muted'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-pf-text">{ev.eventType}</span>
                          <span className="text-[10px] text-pf-text-muted flex-shrink-0">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {ev.payload && Object.keys(ev.payload).length > 0 && (
                          <p className="text-[11px] text-pf-text-secondary mt-0.5 font-mono truncate">
                            {JSON.stringify(ev.payload).slice(0, 120)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {detailTab === 'versions' && (
            <div className="mt-4">
              {loadingVersions ? (
                <p className="text-sm text-pf-text-muted">Loading versions...</p>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-pf-text-muted text-sm">
                  <p>No saved versions yet.</p>
                  <p className="text-xs mt-1">Versions are saved when you edit a strategy.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {versions.map(v => (
                    <li key={v.id} className="rounded-pf border border-pf-border bg-pf-surface p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-pf-text">v{v.version}</span>
                          <span className="text-[10px] text-pf-text-muted ml-2">
                            {new Date(v.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!!rollingBack}
                          onClick={async () => {
                            if (!confirm(`Roll back to version ${v.version}? This will replace the current strategy logic.`)) return;
                            setRollingBack(v.id);
                            try {
                              const r = await fetch(
                                `/api/v1/strategies/${strategy?.id}/versions/${v.id}/rollback`,
                                { method: 'POST', credentials: 'include' }
                              );
                              if (r.ok) {
                                alert(`Rolled back to v${v.version}`);
                                window.location.reload();
                              }
                            } finally { setRollingBack(null); }
                          }}
                          className="text-xs px-2.5 py-1 rounded-pf border border-pf-border text-pf-text-secondary hover:text-pf-text hover:border-pf-border-hover transition-colors disabled:opacity-40"
                        >
                          {rollingBack === v.id ? 'Rolling back...' : 'Rollback'}
                        </button>
                      </div>
                      <p className="text-[11px] text-pf-text-muted mt-1">
                        {Array.isArray(v.triggers) ? v.triggers.length : 0} triggers &middot;{' '}
                        {Array.isArray(v.conditions) ? v.conditions.length : 0} conditions &middot;{' '}
                        {Array.isArray(v.actions) ? v.actions.length : 0} actions
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
