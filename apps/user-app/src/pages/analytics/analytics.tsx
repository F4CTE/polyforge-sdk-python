import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
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
  if (n > 0) return 'text-pf-success';
  if (n < 0) return 'text-pf-danger';
  return 'text-pf-text-muted';
}

function brierColor(score: number): string {
  if (score < 0.2) return 'text-pf-success';
  if (score < 0.3) return 'text-yellow-400';
  return 'text-pf-danger';
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-pf-overlay rounded animate-pulse ${className ?? ''}`} />;
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
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
      <span className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary block mb-2">
        {label}
      </span>
      <span className={`text-3xl font-mono font-semibold ${valueClass ?? 'text-pf-text'}`}>
        {value}
      </span>
      {sub && <p className="text-xs text-pf-text-muted mt-1">{sub}</p>}
    </div>
  );
}

/* ─── Score Row ──────────────────────────────────────────────────────── */

function ScoreRow({ label, value, max }: { label: string; value: string; max: number }) {
  const numeric = parseFloat(value);
  const pct = Number.isFinite(numeric) ? Math.min(Math.max((numeric / max) * 100, 0), 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-pf-text-secondary">{label}</span>
        <span className="font-mono text-pf-text">{value}</span>
      </div>
      <div className="h-1.5 bg-pf-overlay rounded-full overflow-hidden">
        <div
          className="h-full bg-pf-cyan-400 rounded-full transition-all duration-500"
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

  const themeColors = useMemo(() => {
    const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    return {
      textMuted: s?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A',
      bgElevated: s?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E',
      borderColor: s?.getPropertyValue('--color-pf-border').trim() || '#1E3350',
      textSecondary: s?.getPropertyValue('--color-pf-text-secondary').trim() || '#7A94B4',
      success: s?.getPropertyValue('--color-pf-success').trim() || '#10B981',
      danger: s?.getPropertyValue('--color-pf-danger').trim() || '#EF4444',
    };
  }, []);
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

  useEffect(() => {
    loadAccuracy();
    loadScore();
  }, [loadAccuracy, loadScore]);

  useEffect(() => {
    loadPnl(period);
  }, [loadPnl, period]);

  const isLoading = loadingPnl || loadingAccuracy || loadingScore;

  if (isLoading) return <PageSkeleton />;

  /* ─── Derived values ──────────────────────────────────────────────── */

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

  return (
    <div className="animate-fade-in p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <LineChartIcon className="size-5 text-pf-text-muted" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-pf-text">Analytics</h1>
        </div>

        {/* Period selector */}
        <div
          className="flex items-center gap-1 bg-pf-elevated border border-pf-border rounded-pf-sm p-1"
          role="group"
          aria-label="Select period"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-400/40 ${
                period === p.value
                  ? 'bg-pf-cyan-400/15 text-pf-cyan-400'
                  : 'text-pf-text-secondary hover:text-pf-text hover:bg-pf-surface'
              }`}
            >
              {p.label}
            </button>
          ))}
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
          valueClass={pnlData ? pnlTextColor(totalPnlVal) : 'text-pf-text-muted'}
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
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
        <h2 className="text-sm font-medium text-pf-text mb-1">P&L Equity Curve</h2>
        <p className="text-xs text-pf-text-muted mb-4">Cumulative profit and loss over the selected period.</p>
        {loadingPnl ? (
          <div className="h-64 animate-pulse bg-pf-overlay rounded" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-2">
            <LineChartIcon className="size-10 text-pf-text-muted opacity-40" aria-hidden="true" />
            <p className="text-sm text-pf-text-muted">No P&L data for this period yet.</p>
            <p className="text-xs text-pf-text-muted">Place and resolve trades to see your equity curve.</p>
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
                  tick={{ fill: textMuted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: textMuted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: bgElevated,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: textSecondary }}
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
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-pf-border">
            <h2 className="text-sm font-medium text-pf-text">Category Performance</h2>
            <p className="text-xs text-pf-text-muted mt-0.5">Brier score by category — lower is better.</p>
          </div>
          {loadingAccuracy ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-pf-overlay rounded animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
              <p className="text-sm text-pf-text-muted">No category data available yet.</p>
              <p className="text-xs text-pf-text-muted">
                Resolve predictions across categories to see breakdown here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Category performance">
                <thead>
                  <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-6 py-3 font-medium">Category</th>
                    <th scope="col" className="px-6 py-3 font-medium text-right">Trades</th>
                    <th scope="col" className="px-6 py-3 font-medium text-right">Brier Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pf-border">
                  {categories.map(([cat, stat]) => (
                    <tr key={cat} className="hover:bg-pf-surface/50 transition-colors">
                      <td className="px-6 py-3 text-pf-text font-medium capitalize">{cat}</td>
                      <td className="px-6 py-3 text-right font-mono text-pf-text-secondary">
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
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
          <h2 className="text-sm font-medium text-pf-text mb-0.5">Score Breakdown</h2>
          <p className="text-xs text-pf-text-muted mb-6">Key trading performance metrics.</p>
          {loadingScore ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : scoreData === null ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <p className="text-sm text-pf-text-muted">No score data available yet.</p>
              <p className="text-xs text-pf-text-muted">
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
    </div>
  );
}
