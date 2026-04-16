import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';
import { Users, TrendingUp, RefreshCw } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { chartLegendStyle } from '@polyforge/ui/lib/chart-styles';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RetentionOverview {
  dau: number;
  wau: number;
  mau: number;
  dauWauRatio: number;
  wauMauRatio: number;
  newUsersToday: number;
  newUsersWeek: number;
  churnRate: number;
}

interface TrendPoint {
  date: string;
  dau: number;
  newUsers: number;
  returningUsers: number;
}

interface CohortRow {
  cohort: string;
  size: number;
  retention: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function retentionColor(pct: number): string {
  if (pct >= 80) return 'bg-gain text-primary';
  if (pct >= 60) return 'bg-gain/60 text-gain';
  if (pct >= 40) return 'bg-gain/30 text-primary';
  if (pct >= 20) return 'bg-warning/30 text-primary';
  if (pct > 0) return 'bg-loss/20 text-tertiary';
  return 'bg-overlay text-tertiary';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Skeleton Components ───────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-elevated border border-default rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-app rounded w-24 mb-3" />
      <div className="h-7 bg-app rounded w-16" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-elevated border border-default rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-app rounded w-32 mb-4" />
      <div className="h-chart-sm bg-app rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-elevated border border-default rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-app rounded w-40 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 bg-app rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

// Map series names back to design token classes (Recharts resolves CSS vars to hex)
const SERIES_BG_CLASS: Record<string, string> = {
  'New Users': 'bg-accent',
  'Returning Users': 'bg-purple-500',
  'DAU': 'bg-warning',
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-elevated border border-default rounded-sm p-3 text-caption shadow-lg">
      <p className="font-semibold text-primary mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${SERIES_BG_CLASS[entry.name] ?? 'bg-tertiary'}`} />
          <span className="text-secondary">{entry.name}:</span>
          <span className="text-primary font-medium">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Period Selector ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { label: string; value: number }[] = [
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

// ─── Cohort column labels ──────────────────────────────────────────────────────

const COHORT_WEEKS = ['Week 0', 'Week 1', 'Week 2', 'Week 4', 'Week 8', 'Week 12'];

// ─── Main Component ────────────────────────────────────────────────────────────

export function Component() {
  const [overview, setOverview] = useState<RetentionOverview | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [trendDays, setTrendDays] = useState(30);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingCohorts, setLoadingCohorts] = useState(true);

  const [overviewError, setOverviewError] = useState(false);
  const [trendError, setTrendError] = useState(false);
  const [cohortsError, setCohortsError] = useState(false);

  // ── Fetch overview + cohorts (stable) ────────────────────────────────────────

  const loadOverviewAndCohorts = useCallback(async () => {
    setLoadingOverview(true);
    setLoadingCohorts(true);
    setOverviewError(false);
    setCohortsError(false);

    const [overviewResult, cohortsResult] = await Promise.allSettled([
      adminApi.retentionOverview(),
      adminApi.retentionCohorts(6),
    ]);

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      setOverviewError(true);
    }
    setLoadingOverview(false);

    if (cohortsResult.status === 'fulfilled') {
      setCohorts(cohortsResult.value.data);
    } else {
      setCohortsError(true);
    }
    setLoadingCohorts(false);
  }, []);

  // ── Fetch trend (depends on trendDays) ───────────────────────────────────────

  const loadTrend = useCallback(async (days: number) => {
    setLoadingTrend(true);
    setTrendError(false);
    try {
      const res = await adminApi.retentionTrend(days);
      setTrend(res.data);
    } catch {
      setTrendError(true);
    } finally {
      setLoadingTrend(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewAndCohorts();
  }, [loadOverviewAndCohorts]);

  useEffect(() => {
    loadTrend(trendDays);
  }, [trendDays, loadTrend]);

  async function handleRefresh() {
    toast.promise(
      Promise.all([loadOverviewAndCohorts(), loadTrend(trendDays)]),
      {
        loading: 'Refreshing retention data…',
        success: 'Data refreshed',
        error: 'Some data failed to load',
      },
    );
  }

  // ── DAU/WAU ratio color ───────────────────────────────────────────────────────

  function dauWauColor(ratio: number): string {
    if (ratio > 0.3) return 'text-gain';
    if (ratio >= 0.2) return 'text-warning';
    return 'text-loss';
  }

  function churnColor(rate: number): string {
    if (rate > 0.05) return 'text-loss';
    if (rate >= 0.02) return 'text-warning';
    return 'text-gain';
  }

  // ── Stat cards definition ─────────────────────────────────────────────────────

  const row1 = [
    {
      label: 'DAU',
      value: fmt(overview?.dau ?? 0),
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      label: 'WAU',
      value: fmt(overview?.wau ?? 0),
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'MAU',
      value: fmt(overview?.mau ?? 0),
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
  ];

  const row2 = [
    {
      label: 'DAU/WAU Ratio',
      value: overview ? fmtPct(overview.dauWauRatio) : '—',
      color: overview ? dauWauColor(overview.dauWauRatio) : 'text-primary',
      bg: 'bg-app',
      valueClass: overview ? dauWauColor(overview.dauWauRatio) : 'text-primary',
    },
    {
      label: 'New Users (7d)',
      value: fmt(overview?.newUsersWeek ?? 0),
      color: 'text-gain',
      bg: 'bg-gain/10',
      valueClass: undefined,
    },
    {
      label: 'Churn Rate (30d)',
      value: overview ? fmtPct(overview.churnRate) : '—',
      color: overview ? churnColor(overview.churnRate) : 'text-primary',
      bg: 'bg-app',
      valueClass: overview ? churnColor(overview.churnRate) : 'text-primary',
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-accent/10">
            <Users size={20} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-primary">User Retention</h1>
            <p className="text-caption text-tertiary">DAU, WAU, MAU and cohort analysis</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-sm border border-default text-body-sm text-secondary hover:text-primary hover:bg-elevated transition-colors"
          aria-label="Refresh retention data"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Section 1: Overview stat cards */}
      {loadingOverview ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      ) : overviewError ? (
        <div className="bg-elevated border border-default rounded-xl p-6 text-center">
          <p className="text-body-sm text-secondary">Overview data unavailable</p>
          <Button
            type="button"
            variant="ghost"
            onClick={loadOverviewAndCohorts}
            className="text-accent-text hover:text-accent-text text-caption mt-2"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Row 1: DAU | WAU | MAU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
            {row1.map((card) => (
              <div key={card.label} className="bg-elevated border border-default rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label text-secondary">{card.label}</span>
                  <div className={`p-2 rounded-sm ${card.bg}`}>
                    <TrendingUp size={16} className={card.color} aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-primary">{card.value}</div>
              </div>
            ))}
          </div>
          {/* Row 2: DAU/WAU Ratio | New Users (7d) | Churn Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
            {row2.map((card) => (
              <div key={card.label} className="bg-elevated border border-default rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label text-secondary">{card.label}</span>
                  <div className={`p-2 rounded-sm ${card.bg}`}>
                    <TrendingUp size={16} className={card.color} aria-hidden="true" />
                  </div>
                </div>
                <div className={`text-2xl font-semibold ${card.valueClass ?? 'text-primary'}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: DAU Trend Chart */}
      {loadingTrend ? (
        <ChartSkeleton />
      ) : trendError ? (
        <div className="bg-elevated border border-default rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-tertiary" aria-hidden="true" />
            <h2 className="text-heading font-semibold text-primary">DAU Trend</h2>
          </div>
          <div className="text-center py-8">
            <p className="text-body-sm text-secondary">Trend data unavailable</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => loadTrend(trendDays)}
              className="text-accent-text hover:text-accent-text text-caption mt-2"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-elevated border border-default rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" aria-hidden="true" />
              <h2 className="text-heading font-semibold text-primary">DAU Trend</h2>
            </div>
            {/* Period selector chips */}
            <div className="flex items-center gap-1" role="group" aria-label="Select trend period">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setTrendDays(opt.value)}
                  className={`px-3 py-1 rounded-sm text-label font-medium transition-colors ${
                    trendDays === opt.value
                      ? 'bg-accent/20 text-accent border border-accent/40'
                      : 'border border-default text-secondary hover:text-primary hover:bg-app'
                  }`}
                  aria-pressed={trendDays === opt.value}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={chartLegendStyle}
              />
              <Bar
                dataKey="newUsers"
                name="New Users"
                stackId="dau"
                fill="var(--accent-default)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="returningUsers"
                name="Returning Users"
                stackId="dau"
                fill="var(--color-purple-500)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                dataKey="dau"
                name="DAU"
                type="monotone"
                stroke="var(--warning)"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Section 3: Cohort Retention Table */}
      {loadingCohorts ? (
        <TableSkeleton />
      ) : cohortsError ? (
        <div className="bg-elevated border border-default rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-tertiary" aria-hidden="true" />
            <h2 className="text-heading font-semibold text-primary">Cohort Retention</h2>
          </div>
          <div className="text-center py-8">
            <p className="text-body-sm text-secondary">Cohort data unavailable</p>
            <Button
              type="button"
              variant="ghost"
              onClick={loadOverviewAndCohorts}
              className="text-accent-text hover:text-accent-text text-caption mt-2"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-elevated border border-default rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-accent" aria-hidden="true" />
            <h2 className="text-heading font-semibold text-primary">Cohort Retention</h2>
            <span className="text-caption text-tertiary ml-1">(last 6 months)</span>
          </div>
          {cohorts.length === 0 ? (
            <p className="text-body-sm text-secondary py-4">No cohort data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-caption">
                <caption className="sr-only">Cohort retention table</caption>
                <thead>
                  <tr className="text-left border-b border-default">
                    <th scope="col" className="pb-2 pr-4 font-medium text-tertiary uppercase tracking-wider whitespace-nowrap">
                      Cohort
                    </th>
                    {COHORT_WEEKS.map((w) => (
                      <th
                        key={w}
                        scope="col"
                        className="pb-2 px-1 font-medium text-tertiary uppercase tracking-wider text-center whitespace-nowrap"
                      >
                        {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {cohorts.map((row) => (
                    <tr key={row.cohort}>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <div className="font-medium text-primary">{row.cohort}</div>
                        <div className="text-label text-tertiary">{fmt(row.size)} users</div>
                      </td>
                      {COHORT_WEEKS.map((_, colIdx) => {
                        const pct = row.retention[colIdx] ?? 0;
                        return (
                          <td key={colIdx} className="py-2 px-1">
                            <div
                              className={`flex items-center justify-center rounded-sm h-7 w-14 mx-auto font-medium text-label transition-opacity cursor-default ${retentionColor(pct)}`}
                              title={`${row.cohort} — ${COHORT_WEEKS[colIdx]}: ${pct}%`}
                              aria-label={`${row.cohort} ${COHORT_WEEKS[colIdx]} retention: ${pct}%`}
                            >
                              {pct > 0 ? `${pct}%` : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
