import { useState, useEffect, useCallback } from 'react';
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
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Star,
  Copy,
  Check,
  FileJson,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Trash2,
  History,
  Clock,
  RotateCcw,
  Plus,
  Minus,
  Edit2,
} from 'lucide-react';
import { wsManager } from '@/lib/websocket';
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

interface StratExecution {
  id: string;
  side: string;
  outcome: string;
  size: string;
  price: string;
  fillSize?: string;
  fillPrice?: string;
  status: string;
  createdAt: string;
  marketQuestion?: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  author: { username: string; displayName: string | null; avatarUrl?: string };
}

interface ReviewsState {
  data: Review[];
  total: number;
  totalPages: number;
  page: number;
  loading: boolean;
  submitRating: number;
  submitComment: string;
  submitting: boolean;
}

interface StrategyVersion {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  changeNote?: string;
  blockCount: number;
  author: string;
  changes?: {
    added: number;
    removed: number;
    modified: number;
  };
}

type LiveEventType = 'ORDER_PLACED' | 'ORDER_FILLED' | 'ORDER_REJECTED' | 'STRATEGY_ERROR';

interface LiveEvent {
  id: string;
  type: LiveEventType;
  timestamp: string;
  data: {
    marketQuestion?: string;
    side?: string;
    outcome?: string;
    size?: string | number;
    price?: string | number;
    fillPrice?: string | number;
    errorMessage?: string;
    [key: string]: unknown;
  };
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
  const [detailTab, setDetailTab] = useState<'overview' | 'log' | 'versions' | 'executions' | 'live'>('overview');
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [executions, setExecutions] = useState<StratExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [executionsPage, setExecutionsPage] = useState(1);
  const [executionsTotalPages, setExecutionsTotalPages] = useState(1);
  const [executionsFetched, setExecutionsFetched] = useState(false);
  const [execLog, setExecLog] = useState<Array<{id: string; eventType: string; payload: any; createdAt: string}>>([]);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<StrategyVersion | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [stratPnl, setStratPnl] = useState<{ totalPnl: string; winRate: string } | null>(null);

  const [copyJsonDone, setCopyJsonDone] = useState(false);

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
        .then(r => r.ok ? r.json() : { data: [] })
        .then(d => {
          const list: StrategyVersion[] = Array.isArray(d) ? d : (d.data ?? []);
          setVersions(list);
        })
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

  const fetchExecutions = useCallback((page: number) => {
    if (!strategy?.id) return;
    setExecutionsLoading(true);
    fetch(`/api/v1/orders?strategyId=${strategy.id}&limit=25&page=${page}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res) {
          setExecutions(res.data ?? []);
          setExecutionsTotalPages(res.totalPages ?? 1);
          setExecutionsFetched(true);
        }
      })
      .catch(() => {})
      .finally(() => setExecutionsLoading(false));
  }, [strategy?.id]);

  useEffect(() => {
    if (detailTab === 'executions' && !executionsFetched) {
      fetchExecutions(1);
    }
  }, [detailTab, executionsFetched, fetchExecutions]);

  // Live feed: initial load + WebSocket subscription
  useEffect(() => {
    if (detailTab !== 'live' || !strategy?.id) return;
    if (strategy.status !== 'RUNNING' && strategy.status !== 'PAPER') return;

    // Initial load of recent orders
    fetch(`/api/v1/orders?strategyId=${strategy.id}&limit=20&sort=createdAt:desc`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res?.data) {
          const initial: LiveEvent[] = (res.data as StratExecution[]).map(ex => ({
            id: ex.id,
            type: (ex.status === 'CONFIRMED' ? 'ORDER_FILLED' : ex.status === 'FAILED' ? 'ORDER_REJECTED' : 'ORDER_PLACED') as LiveEventType,
            timestamp: ex.createdAt,
            data: {
              marketQuestion: ex.marketQuestion,
              side: ex.side,
              outcome: ex.outcome,
              size: ex.size,
              price: ex.price,
              fillPrice: ex.fillPrice,
            },
          }));
          setLiveEvents(initial);
        }
      })
      .catch(() => {});

    // WebSocket: use wsManager listener pattern (same as market-detail.tsx)
    const handleWsMessage = (msg: { type: string; [key: string]: unknown }) => {
      const relevantTypes = new Set(['ORDER_PLACED', 'ORDER_FILLED', 'ORDER_REJECTED', 'STRATEGY_ERROR', 'AUTH_OK']);
      if (!relevantTypes.has(msg.type)) return;
      if (msg.type === 'AUTH_OK') {
        setWsConnected(true);
        wsManager.subscribeStrategy(strategy.id);
        return;
      }
      const stratId = (msg.strategyId as string | undefined) ?? (msg.data as Record<string, unknown> | undefined)?.strategyId as string | undefined;
      if (stratId && stratId !== strategy.id) return;

      const newEvent: LiveEvent = {
        id: `${msg.type}-${Date.now()}-${Math.random()}`,
        type: msg.type as LiveEventType,
        timestamp: (msg.timestamp as string | undefined) ?? new Date().toISOString(),
        data: (msg.data as LiveEvent['data'] | undefined) ?? {},
      };
      setLiveEvents(prev => [newEvent, ...prev].slice(0, 50));
    };

    wsManager.addListener(handleWsMessage);
    wsManager.connect();
    wsManager.subscribeStrategy(strategy.id);
    setWsConnected(true);

    return () => {
      wsManager.removeListener(handleWsMessage);
      wsManager.unsubscribeStrategy(strategy.id);
      setWsConnected(false);
    };
  }, [detailTab, strategy?.id, strategy?.status]);

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

  function exportStrategyJson(s: Strategy) {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      strategy: {
        name: s.name,
        description: s.description,
        blocks: {
          triggers: s.triggers,
          conditions: s.conditions,
          actions: s.actions,
          safety: s.safety,
        },
        settings: {
          execMode: s.execMode,
          tickMs: s.tickMs,
          visibility: s.visibility,
          tags: s.tags,
        },
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.name.replace(/\s+/g, '-').toLowerCase()}-strategy.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Strategy exported');
  }

  async function copyStrategyJson(s: Strategy) {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      strategy: {
        name: s.name,
        description: s.description,
        blocks: {
          triggers: s.triggers,
          conditions: s.conditions,
          actions: s.actions,
          safety: s.safety,
        },
        settings: {
          execMode: s.execMode,
          tickMs: s.tickMs,
          visibility: s.visibility,
          tags: s.tags,
        },
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopyJsonDone(true);
      toast.success('JSON copied to clipboard');
      setTimeout(() => setCopyJsonDone(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
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
                onClick={() => exportStrategyJson(strategy)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                aria-label="Export strategy as JSON"
                title="Export JSON"
              >
                <FileJson className="size-4" aria-hidden="true" /> Export JSON
              </button>
              <button
                type="button"
                onClick={() => copyStrategyJson(strategy)}
                className="p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                aria-label="Copy strategy JSON to clipboard"
                title="Copy JSON"
              >
                {copyJsonDone ? <Check className="size-4 text-pf-success" /> : <Copy className="size-4" />}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf transition-colors ${detailTab === 'versions' ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`}
            >
              <History className="size-3.5" aria-hidden="true" />
              History
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('executions')}
              className={`px-3 py-1.5 text-sm rounded-pf transition-colors ${detailTab === 'executions' ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`}
            >
              Executions
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf transition-colors ${detailTab === 'live' ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`}
            >
              {detailTab === 'live' && wsConnected
                ? <span className="w-1.5 h-1.5 rounded-full bg-pf-success animate-pulse" />
                : <Wifi className="size-3" />}
              Live
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

          {detailTab === 'executions' && (
            <div className="mt-4">
              {executionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-pf bg-pf-surface border border-pf-border-subtle">
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-24" />
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-12" />
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-10" />
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-16" />
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-16" />
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-16" />
                      <div className="h-3 bg-pf-overlay rounded animate-pulse w-20 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-pf-text-muted gap-3">
                  <ClipboardList className="size-8 opacity-40" aria-hidden="true" />
                  <p className="text-sm font-medium text-pf-text">No executions yet</p>
                  <p className="text-xs text-pf-text-muted">Orders placed by this strategy will appear here</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-pf border border-pf-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-pf-border bg-pf-surface">
                          <th className="px-3 py-2.5 text-left font-medium text-pf-text-muted">Date</th>
                          <th className="px-3 py-2.5 text-left font-medium text-pf-text-muted">Side</th>
                          <th className="px-3 py-2.5 text-left font-medium text-pf-text-muted">Outcome</th>
                          <th className="px-3 py-2.5 text-right font-medium text-pf-text-muted">Size</th>
                          <th className="px-3 py-2.5 text-right font-medium text-pf-text-muted">Price</th>
                          <th className="px-3 py-2.5 text-right font-medium text-pf-text-muted">Fill</th>
                          <th className="px-3 py-2.5 text-left font-medium text-pf-text-muted">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pf-border-subtle">
                        {executions.map((ex) => {
                          const statusBadge =
                            ex.status === 'PENDING'   ? 'bg-pf-warning/10 text-pf-warning' :
                            ex.status === 'CONFIRMED' ? 'bg-pf-success/10 text-pf-success' :
                            ex.status === 'CANCELLED' ? 'bg-pf-overlay text-pf-text-muted' :
                            ex.status === 'FAILED'    ? 'bg-pf-danger/10 text-pf-danger' :
                            'bg-pf-overlay text-pf-text-muted';
                          return (
                            <tr key={ex.id} className="hover:bg-pf-surface/50 transition-colors">
                              <td className="px-3 py-2.5 font-mono text-pf-text-secondary whitespace-nowrap">
                                {new Date(ex.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`font-semibold ${ex.side === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`}>
                                  {ex.side}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-pf-text font-mono">{ex.outcome}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-pf-text">{ex.size}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-pf-text">{ex.price}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-pf-text-secondary">
                                {ex.fillSize ?? '—'}
                                {ex.fillPrice ? ` @ ${ex.fillPrice}` : ''}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge}`}>
                                  {ex.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {executionsTotalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button
                        type="button"
                        disabled={executionsPage === 1}
                        onClick={() => { const p = executionsPage - 1; setExecutionsPage(p); fetchExecutions(p); }}
                        className="p-1.5 rounded-pf border border-pf-border text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <span className="text-xs text-pf-text-muted">
                        {executionsPage} / {executionsTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={executionsPage === executionsTotalPages}
                        onClick={() => { const p = executionsPage + 1; setExecutionsPage(p); fetchExecutions(p); }}
                        className="p-1.5 rounded-pf border border-pf-border text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors"
                        aria-label="Next page"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {detailTab === 'versions' && (
            <div className="mt-4">
              {/* Panel header */}
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="size-4 text-pf-text-muted" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-pf-text">Version History</h2>
                {versions.length > 0 && (
                  <span className="ml-auto text-xs text-pf-text-muted">
                    {versions.length} snapshot{versions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Loading skeleton */}
              {loadingVersions && (
                <div className="space-y-0 rounded-pf border border-pf-border overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-pf-border-subtle last:border-0 bg-pf-elevated animate-pulse">
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <div className="size-3 rounded-full bg-pf-overlay" />
                        {i < 3 && <div className="w-px h-10 bg-pf-overlay" />}
                      </div>
                      <div className="flex-1 space-y-2 pb-1">
                        <div className="flex items-center gap-3">
                          <div className="h-5 w-10 bg-pf-overlay rounded-pf-sm" />
                          <div className="h-3 w-24 bg-pf-overlay rounded" />
                          <div className="h-3 w-16 bg-pf-overlay rounded ml-auto" />
                        </div>
                        <div className="h-3 w-40 bg-pf-overlay rounded" />
                        <div className="flex gap-2">
                          <div className="h-4 w-14 bg-pf-overlay rounded-full" />
                          <div className="h-4 w-14 bg-pf-overlay rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loadingVersions && versions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Clock className="size-8 text-pf-text-muted opacity-40" aria-hidden="true" />
                  <p className="text-sm font-medium text-pf-text">No version history yet</p>
                  <p className="text-xs text-pf-text-muted">Save the strategy to create a snapshot</p>
                </div>
              )}

              {/* Timeline list */}
              {!loadingVersions && versions.length > 0 && (
                <div className="rounded-pf border border-pf-border overflow-hidden bg-pf-elevated">
                  {versions.map((v, idx) => {
                    const isCurrent = idx === 0;
                    const isRestoring = rollingBack === v.id;
                    const isSelected = selectedVersion?.id === v.id;
                    return (
                      <div
                        key={v.id}
                        className={`relative flex items-start gap-4 px-5 py-4 border-b border-pf-border-subtle last:border-0 transition-colors ${isSelected ? 'bg-pf-cyan-500/5' : 'hover:bg-pf-surface/40'}`}
                        onClick={() => setSelectedVersion(isSelected ? null : v)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVersion(isSelected ? null : v); }}
                        aria-pressed={isSelected}
                        aria-label={`Version ${v.label}`}
                      >
                        {/* Timeline spine */}
                        <div className="flex flex-col items-center shrink-0 pt-0.5" aria-hidden="true">
                          <span className={`size-3 rounded-full border-2 ${isCurrent ? 'border-pf-cyan-400 bg-pf-cyan-400' : 'border-pf-border-strong bg-pf-surface'}`} />
                          {idx < versions.length - 1 && (
                            <span className="w-px flex-1 min-h-[2rem] bg-pf-border-subtle mt-1" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Top row: badge + date + current pill */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pf-sm text-xs font-bold tabular-nums ${isCurrent ? 'bg-pf-cyan-500/15 text-pf-cyan-400' : 'bg-pf-overlay text-pf-text-muted'}`}>
                              {v.label}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pf-success/10 text-pf-success text-[10px] font-semibold uppercase tracking-wide">
                                current
                              </span>
                            )}
                            <span className="text-xs text-pf-text-muted">{formatDate(v.createdAt)}</span>
                            <span className="text-[10px] text-pf-text-muted ml-auto">by {v.author}</span>
                          </div>

                          {/* Change note */}
                          {v.changeNote && (
                            <p className="text-xs italic text-pf-text-secondary leading-relaxed">
                              "{v.changeNote}"
                            </p>
                          )}

                          {/* Block count + change chips */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-pf-text-muted">
                              {v.blockCount} block{v.blockCount !== 1 ? 's' : ''}
                            </span>
                            {v.changes && (
                              <>
                                {v.changes.added > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pf-success/15 text-pf-success text-[10px] font-semibold">
                                    <Plus className="size-2.5" aria-hidden="true" />
                                    {v.changes.added} added
                                  </span>
                                )}
                                {v.changes.removed > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pf-danger/15 text-pf-danger text-[10px] font-semibold">
                                    <Minus className="size-2.5" aria-hidden="true" />
                                    {v.changes.removed} removed
                                  </span>
                                )}
                                {v.changes.modified > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pf-warning/15 text-pf-warning text-[10px] font-semibold">
                                    <Edit2 className="size-2.5" aria-hidden="true" />
                                    {v.changes.modified} modified
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Restore button for non-current versions */}
                          {!isCurrent && (
                            <div className="pt-1">
                              <button
                                type="button"
                                disabled={!!rollingBack}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setRollingBack(v.id);
                                  try {
                                    const r = await fetch(
                                      `/api/v1/strategies/${strategy?.id}/restore`,
                                      {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ versionId: v.id }),
                                      }
                                    );
                                    if (r.ok) {
                                      toast.success(`Version restored! The strategy will use ${v.label} blocks.`);
                                      setSelectedVersion(null);
                                      // Re-fetch versions to reflect new current
                                      setLoadingVersions(true);
                                      fetch(`/api/v1/strategies/${strategy?.id}/versions`, { credentials: 'include' })
                                        .then(res => res.ok ? res.json() : { data: [] })
                                        .then(d => {
                                          const list: StrategyVersion[] = Array.isArray(d) ? d : (d.data ?? []);
                                          setVersions(list);
                                        })
                                        .catch(() => {})
                                        .finally(() => setLoadingVersions(false));
                                    } else {
                                      const err = await r.json().catch(() => ({}));
                                      toast.error((err as any).message ?? 'Failed to restore version');
                                    }
                                  } catch {
                                    toast.error('Failed to restore version');
                                  } finally {
                                    setRollingBack(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pf border border-pf-border text-xs text-pf-text-secondary hover:border-pf-cyan-500/50 hover:text-pf-cyan-400 disabled:opacity-40 transition-colors"
                              >
                                <RotateCcw className="size-3" aria-hidden="true" />
                                {isRestoring ? 'Restoring...' : `Restore this version`}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Live Execution Feed */}
          {detailTab === 'live' && (
            <div className="mt-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-pf-text">Live Execution Feed</span>
                  {wsConnected ? (
                    <span className="flex items-center gap-1.5 text-xs text-pf-success font-medium">
                      <span className="animate-pulse bg-pf-success rounded-full w-2 h-2" />
                      LIVE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-pf-text-muted">
                      <WifiOff className="size-3" />
                      Disconnected
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLiveEvents([])}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-pf border border-pf-border text-xs text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong transition-colors"
                >
                  <Trash2 className="size-3" />
                  Clear
                </button>
              </div>

              {/* Not running banner */}
              {strategy.status !== 'RUNNING' && strategy.status !== 'PAPER' && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-pf bg-pf-warning/10 border border-pf-warning/20 text-pf-warning text-xs">
                  <AlertTriangle className="size-4 flex-shrink-0" />
                  Strategy is not running — no live events
                </div>
              )}

              {/* Events list */}
              {liveEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-pf-text-muted gap-3">
                  <Wifi className="size-8 opacity-30" />
                  <p className="text-sm font-medium text-pf-text">Waiting for executions...</p>
                  <p className="text-xs text-pf-text-muted">The feed will populate as your strategy trades.</p>
                </div>
              ) : (
                <div className="rounded-pf border border-pf-border bg-pf-elevated divide-y divide-pf-border-subtle">
                  {liveEvents.map((ev) => {
                    const iconProps =
                      ev.type === 'ORDER_PLACED'   ? { Icon: ArrowUpRight,  color: 'text-pf-cyan-400' } :
                      ev.type === 'ORDER_FILLED'   ? { Icon: CheckCircle2,  color: 'text-pf-success'  } :
                      ev.type === 'ORDER_REJECTED' ? { Icon: XCircle,       color: 'text-pf-danger'   } :
                                                     { Icon: AlertTriangle, color: 'text-pf-warning'  };
                    const { Icon, color } = iconProps;
                    return (
                      <div key={ev.id} className="flex items-start gap-3 py-2.5 px-4 animate-fade-in last:border-0">
                        <Icon className={`size-4 flex-shrink-0 mt-0.5 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-xs font-bold ${color}`}>{ev.type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-pf-text-muted flex-shrink-0">{relativeDate(ev.timestamp)}</span>
                          </div>
                          {ev.type === 'STRATEGY_ERROR' ? (
                            <p className="text-xs text-pf-danger truncate">{ev.data.errorMessage ?? 'Unknown error'}</p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-pf-text-secondary">
                              {ev.data.marketQuestion && (
                                <span className="truncate max-w-[200px] text-pf-text-muted" title={ev.data.marketQuestion}>
                                  {ev.data.marketQuestion}
                                </span>
                              )}
                              {ev.data.side && (
                                <span className={`font-semibold ${ev.data.side === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`}>
                                  {ev.data.side}
                                </span>
                              )}
                              {ev.data.outcome && (
                                <span className="font-mono text-pf-text">{ev.data.outcome}</span>
                              )}
                              {ev.data.size !== undefined && (
                                <span className="font-mono">sz {ev.data.size}</span>
                              )}
                              {ev.data.fillPrice !== undefined ? (
                                <span className="font-mono">fill @ {ev.data.fillPrice}</span>
                              ) : ev.data.price !== undefined ? (
                                <span className="font-mono">@ {ev.data.price}</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Reviews & Ratings */}
          <ReviewsSection listingId={strategy.id} />
        </>
      )}
    </div>
  );
}

/* ─── Reviews & Ratings Section ─────────────────────────────────────────── */

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StarRow({
  rating,
  interactive,
  hovered,
  onHover,
  onClick,
}: {
  rating: number;
  interactive?: boolean;
  hovered?: number;
  onHover?: (n: number) => void;
  onClick?: (n: number) => void;
}) {
  const display = hovered ?? rating;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
            onMouseEnter={() => onHover?.(n)}
            onMouseLeave={() => onHover?.(0)}
            onClick={() => onClick?.(n)}
            className={interactive ? 'cursor-pointer focus:outline-none' : 'cursor-default pointer-events-none'}
          >
            <Star
              className={`size-4 transition-colors ${
                filled
                  ? 'text-pf-warning fill-pf-warning'
                  : 'text-pf-text-muted fill-none'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewsSection({ listingId }: { listingId: string }) {
  const [state, setState] = useState<ReviewsState>({
    data: [],
    total: 0,
    totalPages: 1,
    page: 1,
    loading: true,
    submitRating: 0,
    submitComment: '',
    submitting: false,
  });
  const [hovered, setHovered] = useState(0);

  const fetchReviews = useCallback(async (page: number) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(
        `/api/v1/marketplace/listings/${listingId}/reviews?page=${page}&limit=10`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const json = await res.json();
        setState(prev => ({
          ...prev,
          data: json.data ?? [],
          total: json.total ?? 0,
          totalPages: json.totalPages ?? 1,
          page,
          loading: false,
        }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [listingId]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  async function submitReview() {
    const { submitRating, submitComment } = state;
    if (submitRating === 0) { toast.error('Please select a star rating'); return; }
    if (submitComment.trim().length < 10) { toast.error('Comment must be at least 10 characters'); return; }
    if (submitComment.trim().length > 500) { toast.error('Comment must be 500 characters or fewer'); return; }

    setState(prev => ({ ...prev, submitting: true }));
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: submitRating, comment: submitComment.trim() }),
      });
      if (res.ok) {
        toast.success('Review submitted!');
        setState(prev => ({ ...prev, submitRating: 0, submitComment: '', submitting: false }));
        setHovered(0);
        fetchReviews(1);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).message ?? 'Failed to submit review');
        setState(prev => ({ ...prev, submitting: false }));
      }
    } catch {
      toast.error('Failed to submit review');
      setState(prev => ({ ...prev, submitting: false }));
    }
  }

  // Compute star breakdown from loaded reviews
  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: state.data.filter((r) => r.rating === star).length,
  }));
  const avgRating =
    state.data.length > 0
      ? state.data.reduce((sum, r) => sum + r.rating, 0) / state.data.length
      : 0;
  const maxStarCount = Math.max(...starCounts.map((s) => s.count), 1);

  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-6">
      <h2 className="text-base font-semibold text-pf-text flex items-center gap-2">
        <Star className="size-4 text-pf-warning fill-pf-warning" />
        Reviews &amp; Ratings
      </h2>

      {/* Rating Summary */}
      {state.total > 0 && (
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Average */}
          <div className="flex flex-col items-center justify-center min-w-[100px]">
            <span className="text-4xl font-bold text-pf-text font-mono">
              {avgRating.toFixed(1)}
            </span>
            <StarRow rating={Math.round(avgRating)} />
            <span className="text-xs text-pf-text-muted mt-1">
              {state.total} review{state.total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bar breakdown */}
          <div className="flex-1 space-y-1.5">
            {starCounts.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-pf-text-muted w-4 text-right shrink-0">{star}</span>
                <Star className="size-3 text-pf-warning fill-pf-warning shrink-0" />
                <div className="flex-1 h-2 bg-pf-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pf-warning rounded-full transition-all duration-300"
                    style={{ width: `${(count / maxStarCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-pf-text-muted w-6 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write a Review */}
      <div className="border border-pf-border rounded-pf-lg p-4 space-y-3 bg-pf-surface">
        <p className="text-sm font-medium text-pf-text">Write a Review</p>

        {/* Star selector */}
        <div className="flex items-center gap-2">
          <StarRow
            rating={state.submitRating}
            interactive
            hovered={hovered}
            onHover={(n) => setHovered(n)}
            onClick={(n) =>
              setState(prev => ({ ...prev, submitRating: n }))
            }
          />
          {state.submitRating > 0 && (
            <span className="text-xs text-pf-text-muted">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][state.submitRating]}
            </span>
          )}
        </div>

        {/* Comment */}
        <textarea
          value={state.submitComment}
          onChange={(e) =>
            setState(prev => ({ ...prev, submitComment: e.target.value }))
          }
          placeholder="Share your experience..."
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-pf-text-muted">
            {state.submitComment.length}/500
          </span>
          <button
            type="button"
            onClick={submitReview}
            disabled={state.submitting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors"
          >
            {state.submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* Review List */}
      {state.loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="size-8 rounded-full bg-pf-overlay shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-pf-overlay rounded w-[30%]" />
                <div className="h-3 bg-pf-overlay rounded w-[80%]" />
                <div className="h-3 bg-pf-overlay rounded w-[60%]" />
              </div>
            </div>
          ))}
        </div>
      ) : state.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Star className="size-8 text-pf-text-muted mb-2 opacity-40" />
          <p className="text-sm text-pf-text-secondary">Be the first to review this strategy</p>
        </div>
      ) : (
        <div className="space-y-4">
          {state.data.map((review) => {
            const initials = (review.author.displayName ?? review.author.username)
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                key={review.id}
                className="flex gap-3 pb-4 border-b border-pf-border last:border-b-0 last:pb-0"
              >
                {/* Avatar */}
                {review.author.avatarUrl ? (
                  <img
                    src={review.author.avatarUrl}
                    alt={`${review.author.displayName ?? review.author.username} avatar`}
                    className="size-8 rounded-full object-cover shrink-0"
                    width={32}
                    height={32}
                    loading="lazy"
                  />
                ) : (
                  <div className="size-8 rounded-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center text-[10px] font-bold text-pf-cyan-400 shrink-0">
                    {initials}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-pf-text">
                      {review.author.displayName ?? review.author.username}
                    </span>
                    <span className="text-xs text-pf-text-muted">
                      @{review.author.username}
                    </span>
                    <span className="text-xs text-pf-text-muted ml-auto shrink-0">
                      {relativeDate(review.createdAt)}
                    </span>
                  </div>
                  <StarRow rating={review.rating} />
                  <p className="text-sm text-pf-text-secondary mt-1.5 leading-relaxed">
                    {review.comment}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {state.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => fetchReviews(state.page - 1)}
            disabled={state.page === 1 || state.loading}
            aria-label="Previous reviews page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary">
            Page {state.page} of {state.totalPages}
          </span>
          <button
            type="button"
            onClick={() => fetchReviews(state.page + 1)}
            disabled={state.page === state.totalPages || state.loading}
            aria-label="Next reviews page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
