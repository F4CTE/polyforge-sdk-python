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
  if (isNaN(v)) return 'text-pf-text-secondary';
  return v >= 0 ? 'text-pf-success' : 'text-pf-danger';
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
        className="text-pf-cyan-400"
      />
    </svg>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      <div className="h-4 bg-pf-overlay rounded w-20 animate-pulse" />
      <div className="h-6 bg-pf-overlay rounded w-[300px] animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-2 animate-shimmer">
            <div className="h-3 bg-pf-overlay rounded w-[60%]" />
            <div className="h-5 bg-pf-overlay rounded w-[80%]" />
          </div>
        ))}
      </div>
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-shimmer">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-3 bg-pf-overlay rounded w-full mb-3" />
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
        <Link to="/whales" className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">Wallet not found</p>
          <p className="text-sm text-pf-text-muted mt-1">No whale activity recorded for this address.</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="animate-fade-in p-6 max-w-5xl mx-auto">
        <Link to="/whales" className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="size-10 text-pf-danger mb-4" />
          <p className="text-pf-text font-medium">Something went wrong</p>
          <p className="text-sm text-pf-text-muted mt-1">Failed to load whale profile. Please try again.</p>
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
        <Link to="/whales" className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors mb-6">
          <ArrowLeft className="size-4" /> Back to feed
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">No stats available</p>
          <p className="text-sm text-pf-text-muted mt-1">This whale has no recorded activity yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link to="/whales" className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors">
        <ArrowLeft className="size-4" /> Back to feed
      </Link>

      {/* Address + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-pf-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center">
            <Fish className="size-5 text-pf-cyan-400" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-pf-text break-all">{address}</span>
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
            className="flex items-center gap-1.5"
          >
            {following ? <><UserCheck className="size-4" /> Following</> : <><UserPlus className="size-4" /> Follow</>}
          </Button>
          <Link
            to={`/copy/new?wallet=${address}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-success/30 text-pf-success hover:bg-pf-success/10 transition-colors"
          >
            <Copy className="size-4" /> Copy This Whale
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Total Volume</div>
          <div className="text-lg font-mono font-semibold text-pf-text">{stats.totalVolume}</div>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Total P&L</div>
          <div className={`text-lg font-mono font-semibold ${pnlColor(stats.totalPnl)}`}>
            {pnlSign(stats.totalPnl)}
          </div>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Trade Count</div>
          <div className="text-lg font-mono font-semibold text-pf-text">{stats.tradeCount}</div>
        </div>
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-1">Win Rate</div>
          <div className="text-lg font-mono font-semibold text-pf-text">{stats.winRate}%</div>
        </div>
      </div>

      {/* Activity sparkline */}
      {sparkline.length > 0 && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
          <div className="text-xs text-pf-text-secondary mb-3">Activity (last 30 days)</div>
          <Sparkline data={sparkline} />
        </div>
      )}

      {/* Recent trades table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-pf-border">
          <h2 className="text-sm font-medium text-pf-text">Recent Trades</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Recent whale trades">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium">Market</th>
                <th scope="col" className="px-4 py-3 font-medium">Side</th>
                <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Price</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm text-pf-text-muted">No trades recorded yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentTrades.map(trade => (
                  <tr key={trade.id} className="hover:bg-pf-surface/50 transition-colors">
                    <td className="px-4 py-3 text-pf-text max-w-[200px] truncate">{trade.marketName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        trade.side === 'BUY' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        trade.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'
                      }`}>
                        {trade.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">{trade.size}</td>
                    <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">{trade.price}</td>
                    <td className="px-4 py-3 text-right font-mono text-pf-text-secondary text-xs">{formatDate(trade.timestamp)}</td>
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
