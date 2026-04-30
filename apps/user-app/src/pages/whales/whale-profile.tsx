import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Copy, Fish, UserPlus, UserCheck, AlertCircle,
} from 'lucide-react';
import { Button } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface WhaleStats {
  totalVolume: string;
  totalPnl: string;
  tradeCount: number;
  winRate: string;
}

interface WhaleTrade {
  id: string;
  marketName: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  size: string;
  price: string;
  timestamp: string;
}

interface WhaleProfileData {
  walletAddress: string;
  stats: WhaleStats;
  recentTrades: WhaleTrade[];
  sparkline: number[]; // 30 values for trades per day
  isFollowing: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Address copied'),
    () => toast.error('Failed to copy'),
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pnlColor(pnl: string): string {
  const v = parseFloat(pnl);
  if (isNaN(v)) return 'text-secondary';
  return v >= 0 ? 'text-gain' : 'text-loss';
}

function pnlSign(pnl: string): string {
  const v = parseFloat(pnl);
  if (isNaN(v) || v === 0) return pnl;
  return v > 0 ? `+${pnl}` : pnl;
}

/* ─── Sparkline ──────────────────────────────────────────────────────── */

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 40;
  const step = w / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none" role="img" aria-label="Activity sparkline chart showing trades per day over the last 30 days">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        points={points}
        className="text-accent-text"
      />
    </svg>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      <div className="h-4 bg-overlay rounded w-20 animate-pulse" />
      <div className="h-6 bg-overlay rounded w-[300px] animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-elevated border border-default rounded-pf p-4 space-y-2 animate-shimmer">
            <div className="h-3 bg-overlay rounded w-[60%]" />
            <div className="h-5 bg-overlay rounded w-[80%]" />
          </div>
        ))}
      </div>
      <div className="bg-elevated border border-default rounded-pf p-4 animate-shimmer">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-3 bg-overlay rounded w-full mb-3" />
        ))}
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { address } = useParams<{ address: string }>();
  const [profile, setProfile] = useState<WhaleProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setNotFound(false);
    setError(false);
    try {
      const res = await fetch(`/api/v1/whales/${address}`, { credentials: 'include' });
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      if (!res.ok) { setError(true); setLoading(false); return; }
      const data: WhaleProfileData = await res.json();
      setProfile(data);
      setFollowing(data.isFollowing);
    } catch {
      toast.error('Failed to load whale profile');
      setError(true);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => { load(); }, [load]);

  async function toggleFollow() {
    if (!address) return;
    try {
      const res = await fetch(`/api/v1/whales/${address}/${following ? 'unfollow' : 'follow'}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setFollowing(f => !f);
        toast.success(following ? 'Unfollowed whale' : 'Following whale');
      }
    } catch { toast.error('Action failed'); }
  }

  if (loading) return <ProfileSkeleton />;

  if (notFound) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <Link to="/whales" className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">Wallet not found</p>
          <p className="text-body-sm text-tertiary mt-1">No whale activity recorded for this address.</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <Link to="/whales" className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="size-10 text-loss mb-4" />
          <p className="text-primary font-medium">Something went wrong</p>
          <p className="text-body-sm text-tertiary mt-1">Failed to load whale profile. Please try again.</p>
          <Button type="button" variant="secondary" onClick={load} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { stats, recentTrades = [], sparkline = [] } = profile;
  if (!stats) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <Link to="/whales" className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">No stats available</p>
          <p className="text-body-sm text-tertiary mt-1">This whale has no recorded activity yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link to="/whales" className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors">
        <ArrowLeft className="size-4" /> Back to feed
      </Link>

      {/* Address + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-accent-subtle border border-accent/25 flex items-center justify-center">
            <Fish className="size-5 text-accent-text" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-body-md text-primary break-all">{address}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => copyToClipboard(address ?? '')}
                aria-label="Copy wallet address"
                title="Copy address"
                className="shrink-0"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={following ? 'default' : 'secondary'}
            onClick={toggleFollow}
            className="flex items-center gap-2"
          >
            {following ? <><UserCheck className="size-4" /> Following</> : <><UserPlus className="size-4" /> Follow</>}
          </Button>
          <Link
            to={`/copy/new?wallet=${address}`}
            className="flex items-center gap-2 px-4 py-2 rounded-sm text-body-md font-medium border border-gain/30 text-gain hover:bg-gain/10 transition-colors"
          >
            <Copy className="size-4" /> Copy This Whale
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div data-testid="whale-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="text-label text-secondary mb-1">Total Volume</div>
          <div data-testid="whale-total-volume" className="text-lg font-mono font-semibold text-primary">{stats.totalVolume}</div>
        </div>
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="text-label text-secondary mb-1">Total P&L</div>
          <div className={`text-lg font-mono font-semibold ${pnlColor(stats.totalPnl)}`}>
            {pnlSign(stats.totalPnl)}
          </div>
        </div>
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="text-label text-secondary mb-1">Trade Count</div>
          <div className="text-lg font-mono font-semibold text-primary">{stats.tradeCount}</div>
        </div>
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="text-label text-secondary mb-1">Win Rate</div>
          <div data-testid="whale-win-rate" className="text-lg font-mono font-semibold text-primary">{stats.winRate}%</div>
        </div>
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="text-label text-secondary mb-1">Favorite Market</div>
          <div data-testid="whale-favorite-markets" className="text-body-md font-mono font-semibold text-primary truncate">
            {recentTrades.length > 0 ? recentTrades[0].marketName : '—'}
          </div>
        </div>
      </div>

      {/* Activity sparkline */}
      {sparkline.length > 0 && (
        <div className="bg-elevated border border-default rounded-pf p-4">
          <div className="text-label text-secondary mb-3">Activity (last 30 days)</div>
          <Sparkline data={sparkline} />
        </div>
      )}

      {/* Recent trades table */}
      <div data-testid="trading-history" className="bg-elevated border border-default rounded-pf overflow-hidden">
        <div className="px-4 py-3 border-b border-default">
          <h2 className="text-body-md font-medium text-primary">Recent Trades</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm" aria-label="Recent whale trades">
            <caption className="sr-only">Recent whale trades</caption>
            <thead>
              <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium">Market</th>
                <th scope="col" className="px-4 py-3 font-medium">Side</th>
                <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Price</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-body-sm text-tertiary">No trades recorded yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentTrades.map(trade => (
                  <tr key={trade.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-primary max-w-[200px] truncate">{trade.marketName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-label font-semibold ${
                        trade.side === 'BUY' ? 'bg-gain-subtle text-gain' : 'bg-loss-subtle text-loss'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-label font-semibold ${
                        trade.outcome === 'YES' ? 'bg-gain-subtle text-gain' : 'bg-loss-subtle text-loss'
                      }`}>
                        {trade.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-secondary">{trade.size}</td>
                    <td className="px-4 py-3 text-right font-mono text-secondary">{trade.price}</td>
                    <td className="px-4 py-3 text-right font-mono text-secondary text-caption">{formatDate(trade.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
