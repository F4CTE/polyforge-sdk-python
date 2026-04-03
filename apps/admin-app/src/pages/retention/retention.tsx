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
  if (pct >= 80) return 'bg-pf-success text-white';
  if (pct >= 60) return 'bg-pf-success/60 text-pf-success';
  if (pct >= 40) return 'bg-pf-success/30 text-pf-text';
  if (pct >= 20) return 'bg-pf-warning/30 text-pf-text';
  if (pct > 0) return 'bg-pf-danger/20 text-pf-text-muted';
  return 'bg-pf-overlay text-pf-text-muted';
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
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse">
      <div className="h-3 bg-pf-base rounded w-24 mb-3" />
      <div className="h-7 bg-pf-base rounded w-16" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 animate-pulse">
      <div className="h-4 bg-pf-base rounded w-32 mb-4" />
      <div className="h-[220px] bg-pf-base rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5 animate-pulse">
      <div className="h-4 bg-pf-base rounded w-40 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 bg-pf-base rounded" />
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

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-sm p-3 text-xs shadow-pf-lg">
      <p className="font-semibold text-pf-text mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-pf-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-pf-text-secondary">{entry.name}:</span>
          <span className="text-pf-text font-medium">{fmt(entry.value)}</span>
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
    if (ratio > 0.3) return 'text-pf-success';
    if (ratio >= 0.2) return 'text-pf-warning';
    return 'text-pf-danger';
  }

  function churnColor(rate: number): string {
    if (rate > 0.05) return 'text-pf-danger';
    if (rate >= 0.02) return 'text-pf-warning';
    return 'text-pf-success';
  }

  // ── Stat cards definition ─────────────────────────────────────────────────────

  const row1 = [
    {
      label: 'DAU',
      value: fmt(overview?.dau ?? 0),
      color: 'text-pf-info',
      bg: 'bg-pf-info/10',
    },
    {
      label: 'WAU',
      value: fmt(overview?.wau ?? 0),
      color: 'text-[var(--color-pf-purple-500)]',
      bg: 'bg-[var(--color-pf-purple-500)]/10',
    },
    {
      label: 'MAU',
      value: fmt(overview?.mau ?? 0),
      color: 'text-pf-cyan-500',
      bg: 'bg-pf-cyan-500/10',
    },
  ];

  const row2 = [
    {
      label: 'DAU/WAU Ratio',
      value: overview ? fmtPct(overview.dauWauRatio) : '—',
      color: overview ? dauWauColor(overview.dauWauRatio) : 'text-pf-text',
      bg: 'bg-pf-base',
      valueClass: overview ? dauWauColor(overview.dauWauRatio) : 'text-pf-text',
    },
    {
      label: 'New Users (7d)',
      value: fmt(overview?.newUsersWeek ?? 0),
      color: 'text-pf-success',
      bg: 'bg-pf-success/10',
      valueClass: undefined,
    },
    {
      label: 'Churn Rate (30d)',
      value: overview ? fmtPct(overview.churnRate) : '—',
      color: overview ? churnColor(overview.churnRate) : 'text-pf-text',
      bg: 'bg-pf-base',
      valueClass: overview ? churnColor(overview.churnRate) : 'text-pf-text',
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-pf-sm bg-pf-cyan-500/10">
            <Users size={20} className="text-pf-cyan-500" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-pf-text">User Retention</h1>
            <p className="text-xs text-pf-text-tertiary">DAU, WAU, MAU and cohort analysis</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated transition-colors"
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
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 text-center">
          <p className="text-sm text-pf-text-secondary">Overview data unavailable</p>
          <Button
            type="button"
            variant="ghost"
            onClick={loadOverviewAndCohorts}
            className="text-pf-cyan-400 hover:text-pf-cyan-300 text-xs mt-2"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Row 1: DAU | WAU | MAU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
            {row1.map((card) => (
              <div key={card.label} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-pf-text-secondary">{card.label}</span>
                  <div className={`p-2 rounded-pf-sm ${card.bg}`}>
                    <TrendingUp size={16} className={card.color} aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-pf-text">{card.value}</div>
              </div>
            ))}
          </div>
          {/* Row 2: DAU/WAU Ratio | New Users (7d) | Churn Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
            {row2.map((card) => (
              <div key={card.label} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-pf-text-secondary">{card.label}</span>
                  <div className={`p-2 rounded-pf-sm ${card.bg}`}>
                    <TrendingUp size={16} className={card.color} aria-hidden="true" />
                  </div>
                </div>
                <div className={`text-2xl font-bold ${card.valueClass ?? 'text-pf-text'}`}>
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
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-pf-text-tertiary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-pf-text">DAU Trend</h2>
          </div>
          <div className="text-center py-8">
            <p className="text-sm text-pf-text-secondary">Trend data unavailable</p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => loadTrend(trendDays)}
              className="text-pf-cyan-400 hover:text-pf-cyan-300 text-xs mt-2"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-pf-cyan-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-pf-text">DAU Trend</h2>
            </div>
            {/* Period selector chips */}
            <div className="flex items-center gap-1" role="group" aria-label="Select trend period">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setTrendDays(opt.value)}
                  className={`px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors ${
                    trendDays === opt.value
                      ? 'bg-pf-cyan-500/20 text-pf-cyan-500 border border-pf-cyan-500/40'
                      : 'border border-pf-border text-pf-text-secondary hover:text-pf-text hover:bg-pf-base'
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
                tick={{ fontSize: 10, fill: 'var(--color-pf-text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-pf-text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', color: 'var(--color-pf-text-secondary)' }}
              />
              <Bar
                dataKey="newUsers"
                name="New Users"
                stackId="dau"
                fill="var(--color-pf-cyan-500)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="returningUsers"
                name="Returning Users"
                stackId="dau"
                fill="var(--color-pf-purple-500)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                dataKey="dau"
                name="DAU"
                type="monotone"
                stroke="var(--color-pf-warning)"
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
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-pf-text-tertiary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-pf-text">Cohort Retention</h2>
          </div>
          <div className="text-center py-8">
            <p className="text-sm text-pf-text-secondary">Cohort data unavailable</p>
            <Button
              type="button"
              variant="ghost"
              onClick={loadOverviewAndCohorts}
              className="text-pf-cyan-400 hover:text-pf-cyan-300 text-xs mt-2"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-pf-cyan-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-pf-text">Cohort Retention</h2>
            <span className="text-xs text-pf-text-tertiary ml-1">(last 6 months)</span>
          </div>
          {cohorts.length === 0 ? (
            <p className="text-sm text-pf-text-secondary py-4">No cohort data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Cohort retention table</caption>
                <thead>
                  <tr className="text-left border-b border-pf-border">
                    <th scope="col" className="pb-2 pr-4 font-medium text-pf-text-tertiary uppercase tracking-wider whitespace-nowrap">
                      Cohort
                    </th>
                    {COHORT_WEEKS.map((w) => (
                      <th
                        key={w}
                        scope="col"
                        className="pb-2 px-1 font-medium text-pf-text-tertiary uppercase tracking-wider text-center whitespace-nowrap"
                      >
                        {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pf-border">
                  {cohorts.map((row) => (
                    <tr key={row.cohort}>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <div className="font-medium text-pf-text">{row.cohort}</div>
                        <div className="text-[11px] text-pf-text-tertiary">{fmt(row.size)} users</div>
                      </td>
                      {COHORT_WEEKS.map((_, colIdx) => {
                        const pct = row.retention[colIdx] ?? 0;
                        return (
                          <td key={colIdx} className="py-2 px-1">
                            <div
                              className={`flex items-center justify-center rounded-pf-sm h-7 w-14 mx-auto font-medium text-[11px] transition-opacity cursor-default ${retentionColor(pct)}`}
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
