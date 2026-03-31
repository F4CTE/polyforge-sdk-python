import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DollarSign, ShoppingBag, GitFork, Star, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

interface MonthlyRevenue {
  month: string;
  revenue: number;
  fees: number;
  purchases: number;
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

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

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function Component() {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [monthlyPeriod, setMonthlyPeriod] = useState<6 | 12>(12);

  async function load() {
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

  useEffect(() => { load(); }, []);
  useEffect(() => { loadMonthly(monthlyPeriod); }, [monthlyPeriod]);

  const statCards = stats ? [
    { label: 'Total Revenue', value: fmt(stats.totalRevenue), icon: <DollarSign className="size-5" />, color: 'text-pf-success', bg: 'bg-pf-success/10' },
    { label: 'Platform Fees', value: fmt(stats.platformFeeTotal), icon: <DollarSign className="size-5" />, color: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
    { label: 'Total Purchases', value: String(stats.totalPurchases), icon: <ShoppingBag className="size-5" />, color: 'text-pf-info', bg: 'bg-pf-info/10' },
    { label: 'Active Listings', value: `${stats.activeListings} / ${stats.totalListings}`, icon: <GitFork className="size-5" />, color: 'text-pf-warning', bg: 'bg-pf-warning/10' },
  ] : [];

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Marketplace Revenue</h1>
        <button type="button" onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:text-pf-text transition-colors disabled:opacity-50">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse">
            <div className="h-3 bg-pf-base rounded w-24 mb-3" /><div className="h-7 bg-pf-base rounded w-16" />
          </div>
        )) : statCards.map(card => (
          <div key={card.label} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-pf-sm ${card.bg} ${card.color}`}>{card.icon}</div>
              <span className="text-xs text-pf-text-muted font-medium uppercase tracking-wide">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-pf-text font-mono">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Trend */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border">
          <h2 className="text-sm font-semibold text-pf-text">Revenue Trend</h2>
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
            <div className="h-[240px] bg-pf-base rounded animate-pulse" />
          ) : monthlyData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-pf-text-muted">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyData.map(d => ({ ...d, label: fmtMonth(d.month) }))} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Listings */}
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-pf-border">
            <h2 className="text-sm font-semibold text-pf-text">Top Listings by Revenue</h2>
          </div>
          <div className="divide-y divide-pf-border-subtle">
            {loading ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></div>
            )) : (stats?.topListings ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-pf-text-muted">No listings yet</div>
            ) : (stats?.topListings ?? []).map((l, i) => (
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
            {loading ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></div>
            )) : (stats?.recentPurchases ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-pf-text-muted">No recent purchases</div>
            ) : (stats?.recentPurchases ?? []).map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-pf-text truncate">{p.listing.title}</div>
                  <div className="text-xs text-pf-text-muted">
                    {new Date(p.createdAt).toLocaleDateString()} · fee: ${parseFloat(p.platformFee).toFixed(2)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-semibold text-pf-text">${parseFloat(p.priceUsdc).toFixed(2)}</div>
                  <div className="text-xs text-pf-success">+${parseFloat(p.sellerNet).toFixed(2)} seller</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
