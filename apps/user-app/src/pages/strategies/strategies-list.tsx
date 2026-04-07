import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@polyforge/ui';
import { chartTooltipContentStyle, chartAxisTick } from '@polyforge/ui/lib/chart-styles';
import {
  Plus,
  Play,
  Pause,
  Square,
  Pencil,
  Zap,
  FileText,
  Code2,
  Download,
  Upload,
  GitCompare,
  X,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

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

interface StrategyPerfData {
  strategyId: string;
  name: string;
  color: string;
  pnlHistory: Array<{ date: string; pnl: number }>;
  stats: {
    totalPnl: string;
    winRate: number;
    maxDrawdown: string;
    tradeCount: number;
    sharpeRatio?: number;
  };
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const COMPARE_COLORS = ['var(--color-pf-cyan-500)', 'var(--color-pf-purple-500)', 'var(--color-pf-gold-500)', 'var(--color-pf-success)'];

/* ─── Helpers ────────────────────────────────────────────────────────── */

function statusGradient(status: StrategyStatus): string {
  switch (status) {
    case 'RUNNING':  return 'var(--color-pf-cyan-500)';
    case 'PAPER':    return 'var(--color-pf-purple-500)';
    case 'PAUSED':   return 'var(--color-pf-warning)';
    case 'ERROR':    return 'var(--color-pf-danger)';
    case 'IDLE':
    default:         return 'var(--color-pf-border)';
  }
}

const STATUS_STYLES: Record<StrategyStatus, { dot: string; bg: string; text: string }> = {
  RUNNING:  { dot: 'bg-pf-cyan-500',   bg: 'bg-pf-cyan-500/10',   text: 'text-pf-cyan-500' },
  PAPER:    { dot: 'bg-pf-purple-500', bg: 'bg-pf-purple-500/10', text: 'text-pf-purple-500' },
  PAUSED:   { dot: 'bg-pf-warning',   bg: 'bg-pf-warning/10',   text: 'text-pf-warning' },
  IDLE:     { dot: 'bg-pf-text-muted',    bg: 'bg-pf-overlay',    text: 'text-pf-text-muted' },
  ERROR:    { dot: 'bg-pf-danger',     bg: 'bg-pf-danger/10',     text: 'text-pf-danger' },
  ARCHIVED: { dot: 'bg-pf-text-muted',    bg: 'bg-pf-overlay',    text: 'text-pf-text-muted' },
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
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-3 animate-shimmer">
      <div className="h-5 bg-pf-overlay rounded w-[60%]" />
      <div className="h-3 bg-pf-overlay rounded w-[40%]" />
      <div className="h-3 bg-pf-overlay rounded w-[80%]" />
    </div>
  );
}

/* ─── Comparison Panel ───────────────────────────────────────────────── */

interface ComparisonPanelProps {
  perfData: StrategyPerfData[];
  loading: boolean;
  onBack: () => void;
}

function ComparisonPanel({ perfData, loading, onBack }: ComparisonPanelProps) {
  /* Merge all pnlHistory entries into a unified date-keyed dataset for recharts */
  const chartData = (() => {
    if (!perfData.length) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const s of perfData) {
      for (const point of s.pnlHistory) {
        if (!dateMap.has(point.date)) dateMap.set(point.date, {});
        dateMap.get(point.date)![s.strategyId] = point.pnl;
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  })();

  /* Determine best/worst per metric row */
  function bestWorstClass(values: (number | undefined)[], idx: number, higherIsBetter: boolean) {
    const defined = values.filter((v): v is number => v !== undefined);
    if (defined.length < 2) return '';
    const best = higherIsBetter ? Math.max(...defined) : Math.min(...defined);
    const worst = higherIsBetter ? Math.min(...defined) : Math.max(...defined);
    const v = values[idx];
    if (v === undefined) return '';
    if (v === best) return 'bg-pf-success/10 text-pf-success font-medium';
    if (v === worst) return 'bg-pf-danger/10 text-pf-danger font-medium';
    return '';
  }

  /* Parse totalPnl string like "+$1,200" or "-$200" into a number for comparison */
  function parsePnlNum(s: string): number {
    return parseFloat(s.replace(/[^0-9.-]/g, '')) * (s.startsWith('-') ? -1 : 1);
  }

  /* Parse drawdown string like "-15%" into a number */
  function parseDrawdownNum(s: string): number {
    return parseFloat(s.replace(/[^0-9.-]/g, '')) * (s.includes('-') ? -1 : 1);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Back button skeleton */}
        <div className="h-8 w-32 bg-pf-overlay rounded animate-shimmer" />
        {/* Chart skeleton */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
          <div className="h-4 w-40 bg-pf-overlay rounded mb-4 animate-shimmer" />
          <div className="h-56 bg-pf-overlay rounded animate-shimmer" />
        </div>
        {/* Table skeleton */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-3">
          <div className="h-4 w-32 bg-pf-overlay rounded animate-shimmer" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-pf-overlay rounded animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const totalPnlNums = perfData.map((s) => parsePnlNum(s.stats.totalPnl));
  const winRates = perfData.map((s) => s.stats.winRate);
  const drawdowns = perfData.map((s) => parseDrawdownNum(s.stats.maxDrawdown));
  const tradeCounts = perfData.map((s) => s.stats.tradeCount);
  const sharpes = perfData.map((s) => s.stats.sharpeRatio);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to Strategies
      </Button>

      {/* P&L Line Chart */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
        <h2 className="text-sm font-semibold text-pf-text mb-4">P&L Performance</h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-56 text-pf-text-muted text-sm">
            No P&L history available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pf-border)" />
              <XAxis
                dataKey="date"
                tick={chartAxisTick}
                axisLine={{ stroke: 'var(--color-pf-border)' }}
                tickLine={false}
              />
              <YAxis
                tick={chartAxisTick}
                axisLine={{ stroke: 'var(--color-pf-border)' }}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(value: number, name: string) => {
                  const strategy = perfData.find((s) => s.strategyId === name);
                  return [`$${value.toFixed(2)}`, strategy?.name ?? name];
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const strategy = perfData.find((s) => s.strategyId === value);
                  return <span className="text-pf-text-secondary text-xs">{strategy?.name ?? value}</span>;
                }}
              />
              {perfData.map((s) => (
                <Line
                  key={s.strategyId}
                  type="monotone"
                  dataKey={s.strategyId}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats Table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold text-pf-text">Performance Metrics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Strategy performance metrics">
            <thead>
              <tr className="border-t border-pf-border">
                <th className="text-left px-5 py-3 text-pf-text-muted font-medium text-xs w-36">Metric</th>
                {perfData.map((s) => (
                  <th key={s.strategyId} className="text-left px-5 py-3 font-medium text-xs">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-pf-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
                      <span className="text-pf-text truncate max-w-[120px]">{s.name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border">
              {/* Total P&L */}
              <tr>
                <td className="px-5 py-3 text-pf-text-muted text-xs">Total P&L</td>
                {perfData.map((s, i) => (
                  <td key={s.strategyId} className={`px-5 py-3 font-mono text-xs rounded-sm ${bestWorstClass(totalPnlNums, i, true)}`}>
                    {s.stats.totalPnl}
                  </td>
                ))}
              </tr>
              {/* Win Rate */}
              <tr>
                <td className="px-5 py-3 text-pf-text-muted text-xs">Win Rate</td>
                {perfData.map((s, i) => (
                  <td key={s.strategyId} className={`px-5 py-3 font-mono text-xs ${bestWorstClass(winRates, i, true)}`}>
                    {s.stats.winRate}%
                  </td>
                ))}
              </tr>
              {/* Max Drawdown */}
              <tr>
                <td className="px-5 py-3 text-pf-text-muted text-xs">Max Drawdown</td>
                {perfData.map((s, i) => (
                  <td key={s.strategyId} className={`px-5 py-3 font-mono text-xs ${bestWorstClass(drawdowns, i, true)}`}>
                    {s.stats.maxDrawdown}
                  </td>
                ))}
              </tr>
              {/* Trade Count */}
              <tr>
                <td className="px-5 py-3 text-pf-text-muted text-xs">Trade Count</td>
                {perfData.map((s, i) => (
                  <td key={s.strategyId} className={`px-5 py-3 font-mono text-xs ${bestWorstClass(tradeCounts, i, true)}`}>
                    {s.stats.tradeCount}
                  </td>
                ))}
              </tr>
              {/* Sharpe Ratio */}
              <tr>
                <td className="px-5 py-3 text-pf-text-muted text-xs">Sharpe Ratio</td>
                {perfData.map((s, i) => (
                  <td key={s.strategyId} className={`px-5 py-3 font-mono text-xs ${bestWorstClass(sharpes, i, true)}`}>
                    {s.stats.sharpeRatio !== undefined ? s.stats.sharpeRatio.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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

  /* ─── Compare state ─────────────────────────────────────────────── */
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perfData, setPerfData] = useState<StrategyPerfData[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

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

  async function handleExport(e: React.MouseEvent, strategyId: string) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/strategies/${strategyId}/export`, {
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Failed to export strategy');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? 'strategy.polyforge';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export strategy');
    }
  }

  function validateImport(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    if (!d.strategy || typeof d.strategy !== 'object') return false;
    const s = d.strategy as Record<string, unknown>;
    return typeof s.name === 'string' && (Array.isArray(s.blocks) || (typeof s.blocks === 'object' && s.blocks !== null));
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!validateImport(data)) {
          toast.error('Invalid strategy file');
          return;
        }
        const imported = (data as Record<string, unknown>).strategy as Record<string, unknown>;
        const blocks = imported.blocks as Record<string, unknown> | unknown[] | undefined;
        const body = {
          name: `${imported.name as string} (imported)`,
          description: (imported.description as string | undefined) ?? '',
          blocks: Array.isArray(blocks)
            ? blocks
            : (blocks ?? {}),
          settings: (imported.settings as Record<string, unknown> | undefined) ?? {},
        };
        const res = await fetch('/api/v1/strategies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error((err as Record<string, unknown>).message as string ?? 'Failed to import strategy');
          return;
        }
        const created = await res.json();
        toast.success('Strategy imported');
        navigate(`/strategies/${(created as Record<string, unknown>).id}`);
      } catch {
        toast.error('Invalid strategy file');
      }
    };
    input.click();
  }

  function isActive(s: Strategy) { return s.status === 'RUNNING' || s.status === 'PAPER'; }
  function isPaused(s: Strategy) { return s.status === 'PAUSED'; }
  function isIdle(s: Strategy) { return s.status === 'IDLE' || s.status === 'ERROR'; }

  /* ─── Compare handlers ──────────────────────────────────────────── */

  function enterCompareMode() {
    setCompareMode(true);
    setSelectedIds([]);
    setShowComparison(false);
    setPerfData([]);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([]);
    setShowComparison(false);
    setPerfData([]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  async function openComparison() {
    if (selectedIds.length < 2) return;
    setLoadingPerf(true);
    setShowComparison(true);
    try {
      const res = await fetch('/api/v1/strategies/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) {
        toast.error('Failed to load comparison data');
        setShowComparison(false);
        setLoadingPerf(false);
        return;
      }
      const json = await res.json() as { data: StrategyPerfData[] };
      /* Assign deterministic colors in selection order */
      const colored = json.data.map((item, i) => ({
        ...item,
        color: COMPARE_COLORS[i % COMPARE_COLORS.length],
      }));
      setPerfData(colored);
    } catch {
      toast.error('Failed to load comparison data');
      setShowComparison(false);
    } finally {
      setLoadingPerf(false);
    }
  }

  function handleBackFromComparison() {
    setShowComparison(false);
    setPerfData([]);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">My Strategies</h1>
        <div className="flex items-center gap-2">
          {/* Compare toggle */}
          {!compareMode ? (
            <Button
              type="button"
              variant="secondary"
              onClick={enterCompareMode}
              className="flex items-center gap-2 px-4 py-3 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary font-medium hover:border-pf-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
            >
              <GitCompare className="size-4" aria-hidden="true" /> Compare
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={exitCompareMode}
              className="flex items-center gap-2 px-4 py-3 rounded-pf bg-pf-cyan-500/10 border border-pf-cyan-500/30 text-sm text-pf-cyan-400 font-medium hover:bg-pf-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
            >
              <X className="size-4" aria-hidden="true" /> Exit Compare
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-3 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary font-medium hover:border-pf-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
          >
            <Upload className="size-4" aria-hidden="true" /> Import Strategy
          </Button>
          <Link
            to="/strategies/new"
            className="flex items-center gap-2 px-4 py-3 rounded-pf bg-pf-cyan-500 text-pf-text-contrast text-sm font-medium hover:bg-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
          >
            <Plus className="size-4" aria-hidden="true" /> New Strategy
          </Link>
        </div>
      </div>

      {/* Filter tabs — hidden when showing comparison panel */}
      {!showComparison && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <Button
              type="button"
              variant="ghost"
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-3 py-2 text-sm rounded-pf-full border transition-colors ${
                filter === f.value
                  ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                  : 'border-pf-border text-pf-text-secondary hover:text-pf-text'
              }`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      )}

      {/* Comparison Panel */}
      {showComparison && (
        <ComparisonPanel
          perfData={perfData}
          loading={loadingPerf}
          onBack={handleBackFromComparison}
        />
      )}

      {/* Loading skeletons */}
      {!showComparison && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!showComparison && !loading && strategies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
          <Code2 className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">No strategies yet</p>
          <p className="text-sm text-pf-text-muted mt-1">Create your first strategy to start trading.</p>
          <Link
            to="/strategies/new"
            className="mt-4 flex items-center gap-2 px-4 py-3 rounded-pf bg-pf-cyan-500 text-pf-text-contrast text-sm font-medium hover:bg-pf-cyan-400 transition-colors"
          >
            <Plus className="size-4" aria-hidden="true" /> New Strategy
          </Link>
        </div>
      )}

      {/* Strategy grid */}
      {!showComparison && !loading && strategies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {strategies.map((strategy) => {
            const statusStyle = STATUS_STYLES[strategy.status] ?? STATUS_STYLES.IDLE;
            const pnl = strategy.totalPnl ?? null;
            const busy = !!actionLoading[strategy.id];

            /* Compare mode card state */
            const isSelected = selectedIds.includes(strategy.id);
            const isMaxed = selectedIds.length >= 4 && !isSelected;
            const selectedIndex = selectedIds.indexOf(strategy.id);
            const chipColor = isSelected ? COMPARE_COLORS[selectedIndex % COMPARE_COLORS.length] : undefined;

            return (
              <div
                key={strategy.id}
                data-testid="strategy-card"
                tabIndex={0}
                aria-label={`Strategy: ${strategy.name}, status: ${strategy.status}${compareMode ? `, ${isSelected ? 'selected for comparison' : 'click to select for comparison'}` : ''}`}
                onClick={() => {
                  if (compareMode) {
                    if (!isMaxed) toggleSelect(strategy.id);
                  } else {
                    navigate(`/strategies/${strategy.id}`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (compareMode) {
                      if (!isMaxed) toggleSelect(strategy.id);
                    } else {
                      navigate(`/strategies/${strategy.id}`);
                    }
                  }
                }}
                role={compareMode ? 'checkbox' : 'link'}
                aria-checked={compareMode ? isSelected : undefined}
                className={[
                  'group bg-pf-elevated border rounded-pf-lg p-5 cursor-pointer transition-all duration-pf-normal overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40',
                  compareMode && isSelected
                    ? 'border-pf-cyan-500/50 shadow-pf-ring-cyan'
                    : 'border-pf-border hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-1',
                  compareMode && isMaxed
                    ? 'opacity-50 pointer-events-none'
                    : '',
                ].filter(Boolean).join(' ')}
              >
                {/* Gradient status bar */}
                <div
                  className="h-1 -mx-5 -mt-5 mb-4 rounded-t-pf-lg"
                  style={{ background: statusGradient(strategy.status) }}
                  aria-hidden="true"
                />

                {/* Compare mode checkbox overlay */}
                {compareMode && (
                  <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={isSelected ? `Deselect ${strategy.name}` : `Select ${strategy.name} for comparison`}
                      disabled={isMaxed}
                      onClick={() => { if (!isMaxed) toggleSelect(strategy.id); }}
                      className={[
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        isSelected
                          ? 'border-transparent'
                          : 'border-pf-border bg-pf-overlay hover:border-pf-cyan-500/60',
                      ].join(' ')}
                      style={isSelected ? { background: chipColor, borderColor: chipColor } : {}}
                    >
                      {isSelected && <Check className="size-3 text-pf-text" aria-hidden="true" />}
                    </Button>
                  </div>
                )}

                {/* Name + status */}
                <div className={`flex items-start justify-between gap-3 mb-2 ${compareMode ? 'pl-7' : ''}`}>
                  <h3 className="text-sm font-medium text-pf-text leading-snug line-clamp-1 group-hover:text-pf-cyan-400 transition-colors">
                    {strategy.name}
                  </h3>
                  <span data-testid="status-badge" className={`inline-flex items-center gap-2 px-2 py-1 rounded-pf-full text-pf-label font-medium shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
                    <span className={`w-3 h-3 rounded-pf-full ${statusStyle.dot} ${strategy.status === 'RUNNING' ? 'animate-pulse-dot' : ''}`} />
                    {strategy.status}
                  </span>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-pf-full text-pf-label font-medium ${
                    strategy.execMode === 'TICK'
                      ? 'bg-pf-purple-500/10 text-pf-purple-500'
                      : strategy.execMode === 'HYBRID'
                        ? 'bg-pf-purple-500/10 text-pf-purple-500'
                        : 'bg-pf-cyan-500/10 text-pf-cyan-400'
                  }`}>
                    {execLabel(strategy)}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-pf-full bg-pf-overlay text-pf-text-muted text-pf-label font-medium">
                    {blocksCount(strategy)} blocks
                  </span>
                  {strategy.tags.length > 0 && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-pf-full text-pf-label font-medium ${
                      strategy.tags[0].toLowerCase() === 'momentum'
                        ? 'bg-pf-gold-500/10 text-pf-gold-500'
                        : strategy.tags[0].toLowerCase() === 'defensive'
                          ? 'bg-pf-info/10 text-pf-info'
                          : 'bg-pf-overlay text-pf-text-muted'
                    }`}>
                      {strategy.tags[0]}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-1 rounded-pf-full bg-pf-purple-500/10 text-pf-purple-500 text-pf-label font-medium ml-auto">
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
                {pnl !== null && (
                  <div className="mb-3">
                    <span className={`font-mono text-sm font-medium ${pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                      {formatPnl(pnl)}
                    </span>
                  </div>
                )}

                {/* Footer: date + actions (hidden in compare mode to reduce noise) */}
                {!compareMode && (
                  <div
                    className="flex items-center justify-between pt-3 border-t border-pf-border-subtle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-mono text-pf-label text-pf-text-muted">
                      {formatDate(strategy.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      {isIdle(strategy) && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'start', { mode: 'live' }); }}
                            disabled={busy}
                            className="flex items-center gap-1 px-2 py-1 rounded-pf-sm bg-pf-cyan-500/10 text-pf-cyan-400 text-pf-label font-medium hover:bg-pf-cyan-500/20 disabled:opacity-40 transition-colors"
                            title="Start strategy (Live)"
                            aria-label="Start strategy in live mode"
                          >
                            <Zap className="size-3" aria-hidden="true" /> Live
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'start', { mode: 'paper' }); }}
                            disabled={busy}
                            className="flex items-center gap-1 px-2 py-1 rounded-pf-sm bg-pf-overlay text-pf-text-secondary text-pf-label font-medium hover:bg-pf-border-subtle disabled:opacity-40 transition-colors"
                            title="Start strategy (Paper)"
                            aria-label="Start strategy in paper mode"
                          >
                            <FileText className="size-3" aria-hidden="true" /> Paper
                          </Button>
                        </>
                      )}

                      {isActive(strategy) && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'pause'); }}
                            disabled={busy}
                            aria-label="Pause strategy"
                            title="Pause strategy"
                          >
                            <Pause className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'stop'); }}
                            disabled={busy}
                            aria-label="Stop strategy"
                            title="Stop strategy"
                          >
                            <Square className="size-4" />
                          </Button>
                        </>
                      )}

                      {isPaused(strategy) && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'resume'); }}
                            disabled={busy}
                            aria-label="Resume strategy"
                            title="Resume strategy"
                          >
                            <Play className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); doAction(strategy.id, 'stop'); }}
                            disabled={busy}
                            aria-label="Stop strategy"
                            title="Stop strategy"
                          >
                            <Square className="size-4" />
                          </Button>
                        </>
                      )}

                      {/* Export */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => handleExport(e, strategy.id)}
                        aria-label="Export strategy"
                        title="Export strategy"
                      >
                        <Download className="size-4" />
                      </Button>

                      {/* Edit */}
                      <Link
                        to={`/strategies/${strategy.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-pf-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-overlay transition-colors"
                        aria-label="Edit strategy"
                        title="Edit strategy"
                      >
                        <Pencil className="size-4" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Compare mode footer — show date only */}
                {compareMode && (
                  <div className="pt-3 border-t border-pf-border-subtle">
                    <span className="font-mono text-pf-label text-pf-text-muted">
                      {formatDate(strategy.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky bottom compare bar */}
      {compareMode && !showComparison && selectedIds.length >= 2 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-pf-border bg-pf-surface/95 backdrop-blur-sm px-4 py-3"
          role="region"
          aria-label="Compare selection bar"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-pf-text shrink-0">
              Comparing {selectedIds.length} {selectedIds.length === 1 ? 'strategy' : 'strategies'}
            </span>

            {/* Strategy chips */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {selectedIds.map((id, i) => {
                const s = strategies.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-pf-full text-pf-label font-medium text-pf-text bg-pf-overlay border border-pf-border"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-pf-full shrink-0"
                      style={{ background: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[120px]">{s.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove ${s.name} from comparison`}
                      onClick={() => toggleSelect(id)}
                      className="ml-1 text-pf-text-muted hover:text-pf-text transition-colors"
                    >
                      <X className="size-3" />
                    </Button>
                  </span>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedIds([])}
                className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors px-3 py-2 rounded-pf border border-pf-border hover:border-pf-border-strong"
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={openComparison}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-pf bg-pf-cyan-500 text-pf-text-contrast hover:bg-pf-cyan-400 transition-colors"
              >
                <GitCompare className="size-4" aria-hidden="true" />
                View Comparison
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer so sticky bar does not cover last card row */}
      {compareMode && !showComparison && selectedIds.length >= 2 && (
        <div className="h-20" aria-hidden="true" />
      )}
    </div>
  );
}
