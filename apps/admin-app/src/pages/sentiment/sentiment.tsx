import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@polyforge/ui';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Hash,
  BarChart2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SentimentRow {
  marketId: string;
  marketTitle: string;
  score: number;
  label: string;
  signalCount: number;
  bullishCount: number;
  bearishCount: number;
  lastUpdated: string;
}

interface SentimentSummary {
  totalMarkets: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  avgScore: number;
  mostBullishCategory: string;
  mostBearishCategory: string;
  trendingTopics: string[];
}

interface CategorySentiment {
  category: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  avgScore: number;
}

type LabelFilter = '' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
type Period = '1h' | '24h' | '7d';
type SortKey = keyof SentimentRow | null;
type SortDir = 'asc' | 'desc';

// ─── Sub-components ────────────────────────────────────────────────────────────

function LabelPill({ label }: { label: string }) {
  if (label === 'BULLISH') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-xs font-medium bg-pf-success/10 text-pf-success">
        <TrendingUp size={11} aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (label === 'BEARISH') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-xs font-medium bg-pf-danger/10 text-pf-danger">
        <TrendingDown size={11} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-xs font-medium bg-pf-base text-pf-text-secondary border border-pf-border">
      <Minus size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

function scoreColor(score: number): string {
  if (score > 0.1) return 'text-pf-success';
  if (score < -0.1) return 'text-pf-danger';
  return 'text-pf-text-secondary';
}

function scoreBgColor(score: number): string {
  if (score > 0.1) return 'bg-pf-success';
  if (score < -0.1) return 'bg-pf-danger';
  return 'bg-pf-text-muted';
}

/** Map score -1..1 → 0..100 */
function scoreToPercent(score: number): number {
  return Math.round(((score + 1) / 2) * 100);
}

function StatCard({
  label,
  value,
  sub,
  colorClass,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">{label}</span>
      {loading ? (
        <div className="h-7 w-24 bg-pf-surface rounded animate-pulse mt-1" />
      ) : (
        <span className={`text-2xl font-bold ${colorClass ?? 'text-pf-text'}`}>{value}</span>
      )}
      {sub && !loading && (
        <span className="text-xs text-pf-text-tertiary">{sub}</span>
      )}
    </div>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) {
    return <ArrowUp size={12} className="opacity-20 ml-1 inline-block" aria-hidden="true" />;
  }
  return sortDir === 'asc'
    ? <ArrowUp size={12} className="text-pf-cyan-500 ml-1 inline-block" aria-hidden="true" />
    : <ArrowDown size={12} className="text-pf-cyan-500 ml-1 inline-block" aria-hidden="true" />;
}

interface ThProps {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  align?: 'left' | 'right';
  children: React.ReactNode;
}

function SortableTh({ col, sortKey, sortDir, onSort, align = 'left', children }: ThProps) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider cursor-pointer select-none hover:text-pf-text transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(col)}
      aria-sort={sortKey === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {children}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );
}

// Recharts custom tooltip
function CategoryTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-sm px-3 py-2 text-xs shadow-pf-lg">
      <p className="font-semibold text-pf-text mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function Component() {
  // Existing state
  const [rows, setRows] = useState<SentimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('');
  const [refreshing, setRefreshing] = useState(false);

  // New state
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [categoryData, setCategoryData] = useState<CategorySentiment[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [period, setPeriod] = useState<Period>('24h');
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Fetch main rows (period-aware)
  const loadRows = useCallback(async (showRefreshing = false, p: Period = period) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await adminApi.sentimentOverview({ period: p });
      setRows(res ?? []);
    } catch {
      toast.error('Failed to load sentiment data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  // Fetch summary
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await adminApi.sentimentSummary();
      setSummary(res);
    } catch {
      toast.error('Failed to load sentiment summary');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Fetch category breakdown
  const loadCategory = useCallback(async () => {
    setLoadingCategory(true);
    try {
      const res = await adminApi.sentimentByCategory();
      setCategoryData(res?.data ?? []);
    } catch {
      toast.error('Failed to load category breakdown');
    } finally {
      setLoadingCategory(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadCategory();
  }, [loadSummary, loadCategory]);

  useEffect(() => {
    loadRows(false, period);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sorting handler
  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  }

  // Derived: filter + sort
  const processed = useMemo(() => {
    let data = labelFilter ? rows.filter((r) => r.label === labelFilter) : rows;
    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = a[sortKey as keyof SentimentRow];
        const bv = b[sortKey as keyof SentimentRow];
        let cmp = 0;
        if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv;
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [rows, labelFilter, sortKey, sortDir]);

  // Stat card values
  const bullishPct = summary
    ? ((summary.bullishCount / Math.max(summary.totalMarkets, 1)) * 100).toFixed(1) + '%'
    : '—';
  const bearishPct = summary
    ? ((summary.bearishCount / Math.max(summary.totalMarkets, 1)) * 100).toFixed(1) + '%'
    : '—';
  const avgScoreDisplay = summary
    ? (summary.avgScore > 0 ? '+' : '') + summary.avgScore.toFixed(3)
    : '—';

  // Chart data: add percentage fields for display
  const chartData = categoryData.map((c) => {
    const total = c.bullishCount + c.bearishCount + c.neutralCount;
    return {
      ...c,
      bullishPct: total > 0 ? Math.round((c.bullishCount / total) * 100) : 0,
      neutralPct: total > 0 ? Math.round((c.neutralCount / total) * 100) : 0,
      bearishPct: total > 0 ? Math.round((c.bearishCount / total) * 100) : 0,
    };
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pf-text">Market Sentiment</h2>
        <Button
          type="button"
          variant="ghost"
          onClick={() => { loadRows(true, period); loadSummary(); loadCategory(); }}
          disabled={refreshing}
          aria-label="Refresh sentiment data"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Markets"
          value={summary ? summary.totalMarkets.toLocaleString() : '—'}
          sub={summary ? `${summary.neutralCount} neutral` : undefined}
          loading={loadingSummary}
        />
        <StatCard
          label="Bullish"
          value={bullishPct}
          sub={summary ? `${summary.bullishCount} markets` : undefined}
          colorClass="text-pf-success"
          loading={loadingSummary}
        />
        <StatCard
          label="Bearish"
          value={bearishPct}
          sub={summary ? `${summary.bearishCount} markets` : undefined}
          colorClass="text-pf-danger"
          loading={loadingSummary}
        />
        <StatCard
          label="Avg Score"
          value={avgScoreDisplay}
          sub={summary ? `Most bullish: ${summary.mostBullishCategory}` : undefined}
          colorClass={summary ? scoreColor(summary.avgScore) : 'text-pf-text'}
          loading={loadingSummary}
        />
      </div>

      {/* ── Category breakdown chart ── */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={15} className="text-pf-text-tertiary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-pf-text">Sentiment by Category</h3>
          <div className="ml-auto flex items-center gap-3 text-xs text-pf-text-tertiary">
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-pf-success" />Bullish</span>
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-pf-text-muted opacity-50" />Neutral</span>
            <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm bg-pf-danger" />Bearish</span>
          </div>
        </div>

        {loadingCategory ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="h-4 w-32 bg-pf-surface rounded animate-pulse" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-pf-text-tertiary text-sm">
            No category data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--color-pf-text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={90}
                tick={{ fontSize: 11, fill: 'var(--color-pf-text-secondary)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="bullishPct" name="Bullish %" stackId="a" fill="var(--color-pf-success)" radius={[0, 0, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.category} fill="var(--color-pf-success)" />
                ))}
              </Bar>
              <Bar dataKey="neutralPct" name="Neutral %" stackId="a" fill="var(--color-pf-text-muted)" opacity={0.45}>
                {chartData.map((entry) => (
                  <Cell key={entry.category} fill="var(--color-pf-text-muted)" />
                ))}
              </Bar>
              <Bar dataKey="bearishPct" name="Bearish %" stackId="a" fill="var(--color-pf-danger)" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.category} fill="var(--color-pf-danger)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Trending topics ── */}
      {(loadingSummary || (summary?.trendingTopics && summary.trendingTopics.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 text-xs font-medium text-pf-text-tertiary">
            <Hash size={12} aria-hidden="true" />
            Trending:
          </span>
          {loadingSummary
            ? Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="h-5 w-16 bg-pf-surface rounded-pf-full animate-pulse inline-block" />
              ))
            : summary?.trendingTopics.map((topic) => (
                <span
                  key={topic}
                  className="inline-block px-3 py-1 rounded-pf-full text-xs font-medium bg-pf-cyan-500/10 text-pf-cyan-400 border border-pf-cyan-500/20"
                >
                  {topic}
                </span>
              ))}
        </div>
      )}

      {/* ── Table controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period pills */}
        <div className="flex items-center gap-1 rounded-pf-sm border border-pf-border overflow-hidden">
          {(['1h', '24h', '7d'] as Period[]).map((p) => (
            <Button
              key={p}
              type="button"
              variant="ghost"
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-pf-cyan-500/10 text-pf-cyan-500'
                  : 'text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text'
              }`}
              aria-pressed={period === p}
            >
              {p}
            </Button>
          ))}
        </div>

        {/* Label filter pills */}
        <div className="flex items-center gap-1 rounded-pf-sm border border-pf-border overflow-hidden">
          {(['', 'BULLISH', 'BEARISH', 'NEUTRAL'] as LabelFilter[]).map((val) => (
            <Button
              key={val === '' ? 'all' : val}
              type="button"
              variant="ghost"
              onClick={() => setLabelFilter(val)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                labelFilter === val
                  ? 'bg-pf-cyan-500/10 text-pf-cyan-500'
                  : 'text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text'
              }`}
              aria-pressed={labelFilter === val}
            >
              {val === '' ? 'All' : val}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Main table ── */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Market sentiment overview</caption>
            <thead>
              <tr className="border-b border-pf-border">
                <SortableTh col="marketTitle" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="left">
                  Market
                </SortableTh>
                <SortableTh col="score" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right">
                  Score
                </SortableTh>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">
                  Label
                </th>
                <SortableTh col="bullishCount" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right">
                  Bullish
                </SortableTh>
                <SortableTh col="bearishCount" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right">
                  Bearish
                </SortableTh>
                <SortableTh col="signalCount" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right">
                  Total
                </SortableTh>
                <SortableTh col="lastUpdated" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="left">
                  Last Updated
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : processed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <TrendingUp className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-pf-text-secondary font-medium">No sentiment data found</p>
                    <p className="text-pf-text-tertiary text-xs mt-1">
                      {labelFilter ? `No ${labelFilter} markets at this time` : 'Sentiment signals will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                processed.map((row) => {
                  const pct = scoreToPercent(row.score);
                  const neutralCount = row.signalCount - row.bullishCount - row.bearishCount;
                  return (
                    <tr key={row.marketId} className="border-b border-pf-border last:border-0 hover:bg-pf-base transition-colors">
                      {/* Market title */}
                      <td className="px-4 py-3 text-pf-text font-medium max-w-[260px]">
                        <span className="block truncate">{row.marketTitle}</span>
                      </td>

                      {/* Score column: value + progress bar */}
                      <td className="px-4 py-3 text-right min-w-[120px]">
                        <span className={`font-mono font-medium text-xs ${scoreColor(row.score)}`}>
                          {row.score > 0 ? '+' : ''}{row.score.toFixed(3)}
                        </span>
                        <div className="mt-1 h-2 w-full bg-pf-surface rounded-pf-full overflow-hidden">
                          <div
                            className={`h-full rounded-pf-full transition-all ${scoreBgColor(row.score)}`}
                            style={{ width: `${pct}%` }}
                            aria-label={`Score ${pct}%`}
                          />
                        </div>
                      </td>

                      {/* Label + B/N/Be mini chips */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <LabelPill label={row.label} />
                          <div className="flex items-center gap-1">
                            <span className="text-pf-caption px-2 py-px rounded bg-pf-success/10 text-pf-success font-mono">
                              B:{row.bullishCount}
                            </span>
                            <span className="text-pf-caption px-2 py-px rounded bg-pf-base border border-pf-border text-pf-text-secondary font-mono">
                              N:{Math.max(0, neutralCount)}
                            </span>
                            <span className="text-pf-caption px-2 py-px rounded bg-pf-danger/10 text-pf-danger font-mono">
                              Be:{row.bearishCount}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-pf-success font-mono">{row.bullishCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-pf-danger font-mono">{row.bearishCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-pf-text-secondary font-mono">{row.signalCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-pf-text-tertiary">{formatDateTime(row.lastUpdated)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
