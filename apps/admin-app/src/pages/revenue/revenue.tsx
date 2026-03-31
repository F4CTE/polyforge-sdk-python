import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, BarChart2,
  PieChart as PieChartIcon, Users, ShoppingBag, GitFork, Star, RefreshCw,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, BarChart,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d';
type SourceKey = 'marketplace_listings' | 'copy_fees' | 'strategy_sales' | 'subscription' | 'other';

interface RevenueSource {
  source: SourceKey;
  label: string;
  revenue: number;
  pct: number;
  change: number;
  transactionCount: number;
}

interface RevenueBreakdown {
  totalRevenue: number;
  totalChange: number;
  sources: RevenueSource[];
  period: string;
}

interface TopRevenueUser {
  userId: string;
  username: string;
  revenueGenerated: number;
  tradeVolume: string;
  primarySource: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  fees: number;
  purchases: number;
}

interface MarketplaceStats {
  totalListings: number;
  activeListings: number;
  totalPurchases: number;
  totalRevenue: number;
  platformFeeTotal: number;
  topListings: Array<{
    id: string; title: string; priceUsdc: string; purchaseCount: number;
    forkCount: number; avgRating: string | null; ratingCount: number;
    totalRevenue: string; seller: { username: string; displayName: string | null };
  }>;
  recentPurchases: Array<{
    id: string; priceUsdc: string; platformFee: string; sellerNet: string;
    createdAt: string; listing: { title: string };
  }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<SourceKey, string> = {
  marketplace_listings: '#22d3ee', // pf-cyan-400
  copy_fees: '#22c55e',            // pf-success
  strategy_sales: '#8b5cf6',
  subscription: '#f59e0b',         // pf-warning
  other: '#6b7280',                // pf-text-muted
};

const SOURCE_BG: Record<SourceKey, string> = {
  marketplace_listings: 'bg-cyan-400/10',
  copy_fees: 'bg-green-500/10',
  strategy_sales: 'bg-violet-500/10',
  subscription: 'bg-amber-500/10',
  other: 'bg-gray-500/10',
};

const PERIODS: { label: string; value: Period }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
];

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ─── Tooltip components ──────────────────────────────────────────────────────

interface MonthlyTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function MonthlyTooltip({ active, payload, label }: MonthlyTooltipProps) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find(p => p.name === 'Revenue')?.value ?? 0;
  const fees = payload.find(p => p.name === 'Fees')?.value ?? 0;
  const purchases = payload.find(p => p.name === 'Purchases')?.value ?? 0;
  return (
    <div className="bg-pf-surface border border-pf-border rounded px-3 py-2 text-xs">
      <div className="font-semibold text-pf-text mb-1">{label}</div>
      <div className="text-pf-text-secondary">Revenue: <span className="text-pf-text font-mono">{fmtDollar(revenue)}</span></div>
      <div className="text-pf-text-secondary">Fees: <span className="text-pf-text font-mono">{fmtDollar(fees)}</span></div>
      <div className="text-pf-text-secondary">Purchases: <span className="text-pf-text font-mono">{purchases}</span></div>
    </div>
  );
}

interface CompareTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill?: string }>;
  label?: string;
}

function CompareTooltip({ active, payload, label }: CompareTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pf-surface border border-pf-border rounded px-3 py-2 text-xs">
      <div className="font-semibold text-pf-text mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="text-pf-text-secondary">
          {p.name}: <span className="text-pf-text font-mono">{fmtDollar(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut center label ───────────────────────────────────────────────────────

interface DonutLabelProps {
  cx?: number;
  cy?: number;
  total: number;
}

function DonutCenterLabel({ cx = 0, cy = 0, total }: DonutLabelProps) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.4em" fontSize={11} fill="#9ca3af">Total</tspan>
      <tspan x={cx} dy="1.4em" fontSize={14} fontWeight={700} fill="#f3f4f6" fontFamily="monospace">
        {fmtDollar(total)}
      </tspan>
    </text>
  );
}

// ─── Period pill button ───────────────────────────────────────────────────────

interface PeriodPillProps {
  periods: { label: string; value: Period }[];
  active: Period;
  onChange: (v: Period) => void;
}

function PeriodPills({ periods, active, onChange }: PeriodPillProps) {
  return (
    <div className="flex gap-1">
      {periods.map(p => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            active === p.value
              ? 'bg-pf-cyan-500/20 text-pf-cyan-400 border border-pf-cyan-500/40'
              : 'text-pf-text-muted hover:text-pf-text border border-transparent'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Change badge ─────────────────────────────────────────────────────────────

function ChangeBadge({ change }: { change: number }) {
  const positive = change >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-pf-success' : 'text-pf-danger'}`}>
      {positive
        ? <TrendingUp className="size-3" />
        : <TrendingDown className="size-3" />}
      {positive ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-pf-base rounded animate-pulse ${className ?? ''}`} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Component() {
  // Global period
  const [period, setPeriod] = useState<Period>('30d');

  // Marketplace stats (existing)
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Monthly trend chart (existing)
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [monthlyPeriod, setMonthlyPeriod] = useState<6 | 12>(12);

  // Revenue breakdown (new)
  const [breakdown, setBreakdown] = useState<RevenueBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);

  // Top users (new)
  const [topUsers, setTopUsers] = useState<TopRevenueUser[]>([]);
  const [loadingTopUsers, setLoadingTopUsers] = useState(true);

  // ── Loaders ──

  async function loadStats() {
    setLoading(true);
    try {
      const data = await adminApi.marketplaceStats();
      setStats(data);
    } catch {
      toast.error('Failed to load revenue data');
    }
    setLoading(false);
  }

  async function loadMonthly(months: number) {
    setLoadingMonthly(true);
    try {
      const res = await adminApi.monthlyRevenue(months);
      setMonthlyData(res.data);
    } catch {
      toast.error('Failed to load monthly revenue data');
    }
    setLoadingMonthly(false);
  }

  async function loadBreakdown(p: Period) {
    setLoadingBreakdown(true);
    try {
      const data = await adminApi.revenueBreakdown(p);
      setBreakdown(data);
    } catch {
      toast.error('Failed to load revenue breakdown');
    }
    setLoadingBreakdown(false);
  }

  async function loadTopUsers(p: Period) {
    setLoadingTopUsers(true);
    try {
      const res = await adminApi.revenueTopUsers(p, 10);
      setTopUsers(res.data);
    } catch {
      toast.error('Failed to load top revenue users');
    }
    setLoadingTopUsers(false);
  }

  function refreshAll() {
    loadStats();
    loadMonthly(monthlyPeriod);
    loadBreakdown(period);
    loadTopUsers(period);
  }

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadMonthly(monthlyPeriod); }, [monthlyPeriod]);
  useEffect(() => {
    loadBreakdown(period);
    loadTopUsers(period);
  }, [period]);

  // ── Derived ──

  const statCards = stats ? [
    {
      label: 'Total Revenue',
      value: fmt(stats.totalRevenue),
      icon: <DollarSign className="size-5" />,
      color: 'text-pf-success',
      bg: 'bg-pf-success/10',
      sub: breakdown ? <ChangeBadge change={breakdown.totalChange} /> : null,
    },
    {
      label: 'Platform Fees',
      value: fmt(stats.platformFeeTotal),
      icon: <DollarSign className="size-5" />,
      color: 'text-pf-cyan-400',
      bg: 'bg-pf-cyan-500/10',
      sub: null,
    },
    {
      label: 'Total Purchases',
      value: String(stats.totalPurchases),
      icon: <ShoppingBag className="size-5" />,
      color: 'text-pf-info',
      bg: 'bg-pf-info/10',
      sub: null,
    },
    {
      label: 'Active Listings',
      value: `${stats.activeListings} / ${stats.totalListings}`,
      icon: <GitFork className="size-5" />,
      color: 'text-pf-warning',
      bg: 'bg-pf-warning/10',
      sub: null,
    },
  ] : [];

  // Breakdown stat cards derived from sources
  const breakdownStatCards = breakdown
    ? [
        {
          label: 'Total Revenue',
          value: fmtDollar(breakdown.totalRevenue),
          change: breakdown.totalChange,
          icon: <DollarSign className="size-5" />,
          color: 'text-pf-success',
          bg: 'bg-pf-success/10',
        },
        ...((['marketplace_listings', 'copy_fees', 'strategy_sales'] as SourceKey[]).map(key => {
          const src = breakdown.sources.find(s => s.source === key);
          return {
            label: src?.label ?? key,
            value: src ? fmtDollar(src.revenue) : '$0',
            change: src?.change ?? 0,
            icon: <BarChart2 className="size-5" />,
            color: 'text-pf-text',
            bg: SOURCE_BG[key],
            dotColor: SOURCE_COLORS[key],
          };
        })),
      ]
    : [];

  // Donut data
  const donutData = breakdown?.sources.map(s => ({
    name: s.label,
    value: s.revenue,
    color: SOURCE_COLORS[s.source],
  })) ?? [];

  // Period-over-period comparison bar chart data
  const compareData = breakdown?.sources.map(s => ({
    name: s.label.replace(' ', '\n'),
    Current: s.revenue,
    // Derive previous from change: prev = current / (1 + change/100)
    Previous: s.change !== -100 ? s.revenue / (1 + s.change / 100) : 0,
    color: SOURCE_COLORS[s.source],
  })) ?? [];

  // ── Render ──

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pf-text">Admin Revenue</h1>
          <p className="text-sm text-pf-text-muted mt-0.5">
            Platform earnings across marketplace listings, copy trading, and strategy sales
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodPills periods={PERIODS} active={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || loadingBreakdown}
            className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading || loadingBreakdown ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Marketplace stat cards (existing) ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse">
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          : statCards.map(card => (
              <div key={card.label} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-pf-sm ${card.bg} ${card.color}`}>{card.icon}</div>
                  <span className="text-xs text-pf-text-muted font-medium uppercase tracking-wide">{card.label}</span>
                </div>
                <div className="text-2xl font-bold text-pf-text font-mono">{card.value}</div>
                {card.sub && <div className="mt-1">{card.sub}</div>}
              </div>
            ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Revenue breakdown                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border">
          <div className="flex items-center gap-2">
            <PieChartIcon className="size-4 text-pf-cyan-400" />
            <h2 className="text-sm font-semibold text-pf-text">Revenue Breakdown by Source</h2>
          </div>
          <PeriodPills periods={PERIODS} active={period} onChange={setPeriod} />
        </div>

        {/* Breakdown stat cards */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingBreakdown
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-pf-base border border-pf-border rounded-pf p-3 animate-pulse">
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-6 w-14 mb-1" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))
            : breakdownStatCards.map((card, idx) => (
                <div key={card.label} className="bg-pf-base border border-pf-border rounded-pf p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {'dotColor' in card && (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: (card as { dotColor: string }).dotColor }}
                      />
                    )}
                    <span className="text-xs text-pf-text-muted truncate">{card.label}</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${idx === 0 ? 'text-pf-success' : 'text-pf-text'}`}>
                    {card.value}
                  </div>
                  <div className="mt-1">
                    <ChangeBadge change={card.change} />
                    <span className="text-xs text-pf-text-muted ml-1">vs prev period</span>
                  </div>
                </div>
              ))}
        </div>

        {/* Donut + table row */}
        <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Donut chart */}
          <div>
            <p className="text-xs text-pf-text-muted font-medium uppercase tracking-wide mb-3">Distribution</p>
            {loadingBreakdown ? (
              <Skeleton className="h-[260px]" />
            ) : donutData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-pf-text-muted">No data</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                      ))}
                      {/* Center label via labelLine=false + custom label prop using a component trick */}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [fmtDollar(value), '']}
                      contentStyle={{
                        backgroundColor: 'var(--color-pf-surface, #1e2130)',
                        border: '1px solid var(--color-pf-border, #2d3348)',
                        borderRadius: '6px',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center label overlay using absolute positioning trick */}
                <div className="relative -mt-[120px] mb-[60px] flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-xs text-pf-text-muted">Total</span>
                  <span className="text-base font-bold font-mono text-pf-text">
                    {fmtDollar(breakdown?.totalRevenue ?? 0)}
                  </span>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                  {breakdown?.sources.map(s => (
                    <div key={s.source} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SOURCE_COLORS[s.source] }}
                      />
                      <span className="text-pf-text-muted truncate">{s.label}</span>
                      <span className="font-mono text-pf-text ml-auto">{s.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source breakdown table */}
          <div>
            <p className="text-xs text-pf-text-muted font-medium uppercase tracking-wide mb-3">Source Detail</p>
            {loadingBreakdown ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-pf-text-muted border-b border-pf-border">
                      <th className="text-left pb-2 font-medium">Source</th>
                      <th className="text-right pb-2 font-medium">Revenue</th>
                      <th className="text-right pb-2 font-medium w-20">% Share</th>
                      <th className="text-right pb-2 font-medium">vs Prev</th>
                      <th className="text-right pb-2 font-medium">Txns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pf-border-subtle">
                    {(breakdown?.sources ?? []).map(s => (
                      <tr key={s.source} className="hover:bg-pf-overlay/40 transition-colors">
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: SOURCE_COLORS[s.source] }}
                            />
                            <span className="text-pf-text">{s.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-pf-text">{fmtDollar(s.revenue)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-pf-base rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(s.pct, 100)}%`,
                                  backgroundColor: SOURCE_COLORS[s.source],
                                }}
                              />
                            </div>
                            <span className="font-mono text-pf-text-muted w-9 text-right">
                              {s.pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <ChangeBadge change={s.change} />
                        </td>
                        <td className="py-2.5 text-right font-mono text-pf-text-muted">
                          {fmtNum(s.transactionCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Monthly revenue trend (existing, enhanced)            */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border">
          <div className="flex items-center gap-2">
            <BarChart2 className="size-4 text-pf-cyan-400" />
            <h2 className="text-sm font-semibold text-pf-text">Revenue Trend</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {([6, 12] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMonthlyPeriod(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    monthlyPeriod === p
                      ? 'bg-pf-cyan-500/20 text-pf-cyan-400 border border-pf-cyan-500/40'
                      : 'text-pf-text-muted hover:text-pf-text border border-transparent'
                  }`}
                >
                  {p} months
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => loadMonthly(monthlyPeriod)}
              disabled={loadingMonthly}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-pf-text-secondary hover:text-pf-text border border-pf-border bg-pf-base transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${loadingMonthly ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="px-4 py-4">
          {loadingMonthly ? (
            <Skeleton className="h-[240px]" />
          ) : monthlyData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-pf-text-muted">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={monthlyData.map(d => ({ ...d, label: fmtMonth(d.month) }))}
                margin={{ top: 4, right: 48, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={fmtDollar}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<MonthlyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#06b6d4" opacity={0.7} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="fees" name="Fees" fill="#8b5cf6" opacity={0.7} radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="purchases" name="Purchases" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Period-over-period comparison bar chart               */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-pf-border">
          <TrendingUp className="size-4 text-pf-success" />
          <h2 className="text-sm font-semibold text-pf-text">Period-over-Period Comparison</h2>
          <span className="text-xs text-pf-text-muted ml-1">Current vs previous {period}</span>
        </div>
        <div className="px-4 py-4">
          {loadingBreakdown ? (
            <Skeleton className="h-[220px]" />
          ) : compareData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-pf-text-muted">
              No comparison data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={compareData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtDollar} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CompareTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Current" name="Current" radius={[2, 2, 0, 0]} opacity={0.85}>
                  {compareData.map((entry, index) => (
                    <Cell key={`cur-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                <Bar dataKey="Previous" name="Previous" radius={[2, 2, 0, 0]} opacity={0.35}>
                  {compareData.map((entry, index) => (
                    <Cell key={`prev-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — Top listings + Recent purchases (existing)            */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Listings */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-pf-border">
            <h2 className="text-sm font-semibold text-pf-text">Top Listings by Revenue</h2>
          </div>
          <div className="divide-y divide-pf-border-subtle">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))
              : (stats?.topListings ?? []).length === 0
                ? <div className="px-4 py-8 text-center text-sm text-pf-text-muted">No listings yet</div>
                : (stats?.topListings ?? []).map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="font-mono text-xs text-pf-text-muted w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-pf-text font-medium truncate">{l.title}</div>
                        <div className="text-xs text-pf-text-muted">
                          by {l.seller.displayName ?? l.seller.username} · {l.purchaseCount} sales · {l.forkCount} forks
                          {l.avgRating && (
                            <span className="ml-1 inline-flex items-center gap-0.5">
                              <Star className="size-2.5 fill-pf-warning text-pf-warning" />
                              {parseFloat(l.avgRating).toFixed(1)} ({l.ratingCount})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold text-pf-success">
                          {fmt(parseFloat(l.totalRevenue))}
                        </div>
                        <div className="text-xs text-pf-text-muted">${parseFloat(l.priceUsdc).toFixed(2)} ea</div>
                      </div>
                    </div>
                  ))}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-pf-border">
            <h2 className="text-sm font-semibold text-pf-text">Recent Purchases (30d)</h2>
          </div>
          <div className="divide-y divide-pf-border-subtle">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))
              : (stats?.recentPurchases ?? []).length === 0
                ? <div className="px-4 py-8 text-center text-sm text-pf-text-muted">No recent purchases</div>
                : (stats?.recentPurchases ?? []).map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-pf-text truncate">{p.listing.title}</div>
                        <div className="text-xs text-pf-text-muted">
                          {new Date(p.createdAt).toLocaleDateString()} · fee: ${parseFloat(p.platformFee).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold text-pf-text">
                          ${parseFloat(p.priceUsdc).toFixed(2)}
                        </div>
                        <div className="text-xs text-pf-success">+${parseFloat(p.sellerNet).toFixed(2)} seller</div>
                      </div>
                    </div>
                  ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — Top revenue-generating users                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-pf-cyan-400" />
            <h2 className="text-sm font-semibold text-pf-text">Top Revenue-Generating Users</h2>
            <span className="text-xs text-pf-text-muted">fees paid to platform</span>
          </div>
          <button
            type="button"
            onClick={() => loadTopUsers(period)}
            disabled={loadingTopUsers}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-pf-text-secondary hover:text-pf-text border border-pf-border bg-pf-base transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${loadingTopUsers ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-pf-text-muted border-b border-pf-border">
                <th className="text-left px-4 py-2.5 font-medium w-10">#</th>
                <th className="text-left px-2 py-2.5 font-medium">Username</th>
                <th className="text-right px-2 py-2.5 font-medium">Revenue Generated</th>
                <th className="text-right px-2 py-2.5 font-medium">Trade Volume</th>
                <th className="text-right px-4 py-2.5 font-medium">Primary Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {loadingTopUsers
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : topUsers.length === 0
                  ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-pf-text-muted">
                          No data for this period
                        </td>
                      </tr>
                    )
                  : topUsers.map((user, idx) => {
                      const srcKey = user.primarySource as SourceKey;
                      const dotColor = SOURCE_COLORS[srcKey] ?? '#6b7280';
                      return (
                        <tr key={user.userId} className="hover:bg-pf-overlay/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-pf-text-muted">{idx + 1}</td>
                          <td className="px-2 py-3">
                            <a
                              href={`/admin/users/${user.userId}`}
                              className="text-pf-cyan-400 hover:text-pf-cyan-300 font-medium transition-colors"
                            >
                              @{user.username}
                            </a>
                          </td>
                          <td className="px-2 py-3 text-right font-mono font-semibold text-pf-success">
                            {fmtDollar(user.revenueGenerated)}
                          </td>
                          <td className="px-2 py-3 text-right font-mono text-pf-text-secondary">
                            {user.tradeVolume}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${dotColor}18`,
                                color: dotColor,
                                border: `1px solid ${dotColor}33`,
                              }}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: dotColor }}
                              />
                              {user.primarySource.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
