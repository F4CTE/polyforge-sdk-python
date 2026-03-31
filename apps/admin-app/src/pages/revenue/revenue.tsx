import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DollarSign, ShoppingBag, GitFork, Star, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';

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

  useEffect(() => { load(); }, []);

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
