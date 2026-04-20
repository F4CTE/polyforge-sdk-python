import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Button, Input } from '@polyforge/ui';
import { resolveChartTheme } from '@polyforge/ui/lib/chart-colors';
import { chartTooltipContentStyle, chartTooltipLabelStyle, chartAxisTick } from '@polyforge/ui/lib/chart-styles';
import {
  LineChart as LineChartIcon,
  Bot,
  Sparkles,
  RefreshCw,
  Send,
  AlertTriangle,
  TrendingUp,
  Shield,
  Loader2,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Period = '7d' | '30d' | '90d' | 'allTime';

interface PnlSnapshot {
  time: string;
  pnl: string;
}

interface PnlData {
  totalPnl: string;
  winRate: string;
  snapshots: PnlSnapshot[];
}

interface CategoryStat {
  count: number;
  brierScore: number;
}

interface AccuracyData {
  brierScore: number | null;
  totalPredictions: number;
  correctPredictions: number;
  winRate: string;
  calibration: { bucketMid: number; frequency: number; count: number }[];
  byCategory: Record<string, CategoryStat>;
}

interface ScoreData {
  score: number;
  winRate: string;
  sharpeRatio: string;
  totalTrades: number;
  profitFactor: string;
  consistency: string;
}

interface AiReviewData {
  review: string;
  keyInsights: string[];
  riskFactors: string[];
  opportunities: string[];
  generatedAt: string;
}

interface AiQueryResult {
  response: string;
  model: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const PERIODS: { label: string; value: Period }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All Time', value: 'allTime' },
];

function formatPnl(val: string): string {
  const n = parseFloat(val);
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
}

function pnlTextColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'text-gain';
  if (n < 0) return 'text-loss';
  return 'text-tertiary';
}

function brierColor(score: number): string {
  if (score < 0.2) return 'text-gain';
  if (score < 0.3) return 'text-warning';
  return 'text-loss';
}

function minutesAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 minute ago';
  return `${diff} minutes ago`;
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-overlay rounded animate-pulse ${className ?? ''}`} />;
}

function PageSkeleton() {
  return (
    <div className="animate-fade-in p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-elevated border border-default rounded-pf p-5">
      <span className="text-label font-medium uppercase tracking-wider text-secondary block mb-2">
        {label}
      </span>
      <span className={`text-3xl font-mono font-semibold ${valueClass ?? 'text-primary'}`}>
        {value}
      </span>
      {sub && <p className="text-label text-tertiary mt-1">{sub}</p>}
    </div>
  );
}

/* ─── Score Row ──────────────────────────────────────────────────────── */

function ScoreRow({ label, value, max }: { label: string; value: string; max: number }) {
  const numeric = parseFloat(value);
  const pct = Number.isFinite(numeric) ? Math.min(Math.max((numeric / max) * 100, 0), 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-body-sm">
        <span className="text-secondary">{label}</span>
        <span className="font-mono text-primary">{value}</span>
      </div>
      <div className="h-2 bg-overlay rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-text rounded-full transition-all duration-slow"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [period, setPeriod] = useState<Period>('30d');

  const [pnlData, setPnlData] = useState<PnlData | null>(null);
  const [accuracyData, setAccuracyData] = useState<AccuracyData | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);

  const [loadingPnl, setLoadingPnl] = useState(true);
  const [loadingAccuracy, setLoadingAccuracy] = useState(true);
  const [loadingScore, setLoadingScore] = useState(true);

  // AI Portfolio Review state
  const [aiReview, setAiReview] = useState<AiReviewData | null>(null);
  const [loadingAiReview, setLoadingAiReview] = useState(true);
  const [aiReviewError, setAiReviewError] = useState(false);

  // Ask AI state
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<AiQueryResult | null>(null);
  const [loadingAiQuery, setLoadingAiQuery] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // CSV export state
  const [exportingCsv, setExportingCsv] = useState(false);

  const themeColors = useMemo(() => resolveChartTheme(), []);
  const { textMuted, bgElevated, borderColor, textSecondary, success, danger } = themeColors;

  const loadPnl = useCallback(async (p: Period) => {
    setLoadingPnl(true);
    try {
      const res = await fetch(`/api/v1/portfolio/pnl?period=${p}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load P&L data');
      setPnlData(await res.json());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load P&L data';
      toast.error(msg);
      setPnlData(null);
    } finally {
      setLoadingPnl(false);
    }
  }, []);

  const loadAccuracy = useCallback(async () => {
    setLoadingAccuracy(true);
    try {
      const res = await fetch('/api/v1/accuracy', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load accuracy data');
      setAccuracyData(await res.json());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load accuracy data';
      toast.error(msg);
      setAccuracyData(null);
    } finally {
      setLoadingAccuracy(false);
    }
  }, []);

  const loadScore = useCallback(async () => {
    setLoadingScore(true);
    try {
      const res = await fetch('/api/v1/scores/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load score data');
      const json = await res.json();
      setScoreData(json.score ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load score data';
      toast.error(msg);
      setScoreData(null);
    } finally {
      setLoadingScore(false);
    }
  }, []);

  const loadAiReview = useCallback(async () => {
    setLoadingAiReview(true);
    setAiReviewError(false);
    try {
      const res = await fetch('/api/v1/ai/portfolio-review', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load AI review');
      setAiReview(await res.json());
    } catch (e) {
      setAiReviewError(true);
      const msg = e instanceof Error ? e.message : 'Failed to load AI review';
      toast.error(msg);
    } finally {
      setLoadingAiReview(false);
    }
  }, []);

  const submitAiQuery = useCallback(async () => {
    const query = aiQuery.trim();
    if (!query) return;
    setLoadingAiQuery(true);
    try {
      const res = await fetch('/api/v1/ai/query', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error('Failed to get AI response');
      setAiAnswer(await res.json());
      setAiQuery('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to get AI response';
      toast.error(msg);
    } finally {
      setLoadingAiQuery(false);
    }
  }, [aiQuery]);

  const exportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      const res = await fetch('/api/v1/orders?limit=1000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch orders for export');
      const data = await res.json() as { data: Array<Record<string, unknown>> };
      const rows = data.data;
      const headers = ['Date', 'Market', 'Side', 'Outcome', 'Size', 'Price', 'Fill Price', 'Status', 'P&L', 'Strategy'];
      const lines = rows.map(o => [
        o.createdAt ? new Date(o.createdAt as string).toISOString() : '',
        (o.marketQuestion as string) ?? (o.marketId as string) ?? '',
        o.side ?? '',
        o.outcome ?? '',
        o.size ?? '',
        o.price ?? '',
        o.fillPrice ?? '',
        o.status ?? '',
        '',
        '',
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [headers.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `polyforge-analytics-${date}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${rows.length} trades`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      toast.error(msg);
    } finally {
      setExportingCsv(false);
    }
  }, []);

  useEffect(() => {
    loadAccuracy();
    loadScore();
  }, [loadAccuracy, loadScore]);

  useEffect(() => {
    loadPnl(period);
  }, [loadPnl, period]);

  useEffect(() => {
    loadAiReview();
  }, [loadAiReview]);

  const isLoading = loadingPnl || loadingAccuracy || loadingScore;

  /* ─── Derived values (must be before any early return to satisfy Rules of Hooks) */

  const totalPnlVal = pnlData?.totalPnl ?? '0';
  const winRate = pnlData?.winRate ?? scoreData?.winRate ?? '0';
  const totalTrades = scoreData?.totalTrades ?? 0;
  const edgeScore = scoreData?.score ?? null;

  const chartData = useMemo(() => {
    const snaps = pnlData?.snapshots ?? [];
    return snaps.map((s) => ({ time: s.time, pnl: parseFloat(s.pnl) }));
  }, [pnlData?.snapshots]);

  const isProfitable = parseFloat(totalPnlVal) >= 0;
  const chartColor = isProfitable ? success : danger;

  const categories = Object.entries(accuracyData?.byCategory ?? {});

  const winRatePct = (val: string) => {
    const n = parseFloat(val);
    return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : `${val}%`;
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <LineChartIcon className="size-5 text-tertiary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-primary">Analytics</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV */}
          <Button
            type="button"
            onClick={exportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-3 py-2 rounded-pf bg-surface border border-default text-label text-secondary hover:text-primary hover:border-default transition-colors disabled:opacity-50"
            aria-label="Export analytics as CSV"
          >
            {exportingCsv
              ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              : <Download className="size-3" aria-hidden="true" />}
            Export CSV
          </Button>

          {/* Period selector */}
          <div
            className="flex items-center gap-1 bg-elevated border border-default rounded-sm p-1"
            role="group"
            aria-label="Select period"
          >
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                type="button"
                variant="ghost"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-2 rounded text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text/40 ${
                  period === p.value
                    ? 'bg-accent-text/15 text-accent-text'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Edge Score"
          value={edgeScore !== null ? edgeScore.toFixed(1) : '--'}
          sub="Composite rating"
        />
        <StatCard
          label="Total P&L"
          value={pnlData ? formatPnl(totalPnlVal) : '--'}
          valueClass={pnlData ? pnlTextColor(totalPnlVal) : 'text-tertiary'}
          sub={`${PERIODS.find((p) => p.value === period)?.label ?? ''} period`}
        />
        <StatCard
          label="Win Rate"
          value={pnlData ? winRatePct(winRate) : '--'}
          sub="Resolved trades"
        />
        <StatCard
          label="Total Trades"
          value={totalTrades > 0 ? totalTrades.toLocaleString() : '--'}
          sub="All time"
        />
      </div>

      {/* Row 2: P&L equity curve */}
      <div className="bg-elevated border border-default rounded-pf p-6">
        <h2 className="text-body-md font-medium text-primary mb-1">P&L Equity Curve</h2>
        <p className="text-label text-tertiary mb-4">Cumulative profit and loss over the selected period.</p>
        {loadingPnl ? (
          <div className="h-64 animate-pulse bg-overlay rounded" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-2">
            <LineChartIcon className="size-10 text-tertiary opacity-40" aria-hidden="true" />
            <p className="text-body-sm text-tertiary">No P&L data for this period yet.</p>
            <p className="text-label text-tertiary">Place and resolve trades to see your equity curve.</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={chartTooltipContentStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={{ color: chartColor }}
                  formatter={(value: number) => [
                    `${value >= 0 ? '+' : ''}$${value.toFixed(2)}`,
                    'P&L',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill="url(#analyticsGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Row 3: Category table + Score breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Performance */}
        <div className="bg-elevated border border-default rounded-pf overflow-hidden">
          <div className="px-6 py-4 border-b border-default">
            <h2 className="text-body-md font-medium text-primary">Category Performance</h2>
            <p className="text-label text-tertiary mt-1">Brier score by category — lower is better.</p>
          </div>
          {loadingAccuracy ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-overlay rounded animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
              <p className="text-body-sm text-tertiary">No category data available yet.</p>
              <p className="text-label text-tertiary">
                Resolve predictions across categories to see breakdown here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm" aria-label="Category performance">
                <thead>
                  <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-6 py-3 font-medium">Category</th>
                    <th scope="col" className="px-6 py-3 font-medium text-right">Trades</th>
                    <th scope="col" className="px-6 py-3 font-medium text-right">Brier Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {categories.map(([cat, stat]) => (
                    <tr key={cat} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-3 text-primary font-medium capitalize">{cat}</td>
                      <td className="px-6 py-3 text-right font-mono text-secondary">
                        {stat.count.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-mono">
                        <span className={brierColor(stat.brierScore)}>
                          {stat.brierScore.toFixed(3)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="bg-elevated border border-default rounded-pf p-6">
          <h2 className="text-body-md font-medium text-primary mb-1">Score Breakdown</h2>
          <p className="text-label text-tertiary mb-6">Key trading performance metrics.</p>
          {loadingScore ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : scoreData === null ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <p className="text-body-sm text-tertiary">No score data available yet.</p>
              <p className="text-label text-tertiary">
                Complete more trades to generate your score breakdown.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <ScoreRow
                label="Sharpe Ratio"
                value={scoreData.sharpeRatio}
                max={3}
              />
              <ScoreRow
                label="Profit Factor"
                value={scoreData.profitFactor}
                max={5}
              />
              <ScoreRow
                label="Consistency"
                value={scoreData.consistency}
                max={100}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── AI Portfolio Review ────────────────────────────────────────── */}
      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-default flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent-text" aria-hidden="true" />
            <Bot className="size-4 text-accent-text" aria-hidden="true" />
            <h2 className="text-body-md font-medium text-primary">AI Portfolio Review</h2>
          </div>
          <div className="flex items-center gap-3">
            {aiReview && (
              <span className="text-label text-tertiary">
                Last updated: {minutesAgo(aiReview.generatedAt)}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={loadAiReview}
              disabled={loadingAiReview}
              className="flex items-center gap-2 px-3 py-2 rounded text-label font-medium text-secondary hover:text-primary hover:bg-surface border border-default transition-colors disabled:opacity-50"
              aria-label="Refresh AI review"
            >
              <RefreshCw className={`size-4 ${loadingAiReview ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Card body */}
        <div className="p-6">
          {loadingAiReview ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))}
              </div>
            </div>
          ) : aiReviewError || !aiReview ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <AlertTriangle className="size-8 text-loss opacity-60" aria-hidden="true" />
              <p className="text-body-sm text-secondary">Could not load AI review.</p>
              <Button
                type="button"
                onClick={loadAiReview}
                className="px-4 py-2 rounded text-body-sm font-medium bg-surface border border-default text-secondary hover:text-primary transition-colors"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Review paragraph */}
              <p className="text-body-sm text-secondary leading-relaxed">{aiReview.review}</p>

              {/* Three-column breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Key Insights */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="size-4 text-accent-text" aria-hidden="true" />
                    <h3 className="text-label font-semibold uppercase tracking-wider text-accent-text">
                      Key Insights
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {aiReview.keyInsights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-label text-secondary">
                        <span className="mt-2 size-2 rounded-full bg-accent-text shrink-0" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risk Factors */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="size-4 text-loss" aria-hidden="true" />
                    <h3 className="text-label font-semibold uppercase tracking-wider text-loss">
                      Risk Factors
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {aiReview.riskFactors.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-label text-secondary">
                        <span className="mt-2 size-2 rounded-full bg-loss shrink-0" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Opportunities */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="size-4 text-gain" aria-hidden="true" />
                    <h3 className="text-label font-semibold uppercase tracking-wider text-gain">
                      Opportunities
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {aiReview.opportunities.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-label text-secondary">
                        <span className="mt-2 size-2 rounded-full bg-gain shrink-0" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Ask AI ─────────────────────────────────────────────────────── */}
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-accent-text" aria-hidden="true" />
          <h2 className="text-body-md font-medium text-primary">Ask AI</h2>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2">
          <Input
            ref={aiInputRef}
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loadingAiQuery) submitAiQuery();
            }}
            placeholder="Ask about your portfolio..."
            className="flex-1 bg-surface border border-default rounded-sm px-3 py-2 text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text/40 transition"
            disabled={loadingAiQuery}
            aria-label="Ask AI a question about your portfolio"
          />
          <Button
            type="button"
            onClick={submitAiQuery}
            disabled={loadingAiQuery || !aiQuery.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-sm text-body-md font-medium bg-accent-text/15 text-accent-text border border-accent-text/30 hover:bg-accent-text/25 transition-colors disabled:opacity-50"
            aria-label="Send question to AI"
          >
            {loadingAiQuery ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            Send
          </Button>
        </div>

        {/* AI response */}
        {aiAnswer && (
          <div className="bg-surface border border-default rounded-sm p-4 flex items-start gap-3">
            <Bot className="size-4 text-accent-text mt-1 shrink-0" aria-hidden="true" />
            <p className="text-body-sm text-secondary leading-relaxed">{aiAnswer.response}</p>
          </div>
        )}
      </div>
    </div>
  );
}
