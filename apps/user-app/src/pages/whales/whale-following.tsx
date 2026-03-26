import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Fish, UserMinus } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface FollowedWallet {
  walletAddress: string;
  totalVolume: string;
  totalPnl: string;
  tradeCount: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer">
      <div className="h-3.5 bg-pf-overlay rounded w-[50%]" />
      <div className="flex gap-4">
        <div className="h-3 bg-pf-overlay rounded w-[25%]" />
        <div className="h-3 bg-pf-overlay rounded w-[25%]" />
        <div className="h-3 bg-pf-overlay rounded w-[25%]" />
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [wallets, setWallets] = useState<FollowedWallet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/whales/following', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const data: FollowedWallet[] = Array.isArray(json) ? json : (json.data ?? []);
        setWallets(data);
      }
    } catch { toast.error('Failed to load followed wallets'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function unfollow(address: string) {
    try {
      const res = await fetch(`/api/v1/whales/${address}/unfollow`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setWallets(prev => prev.filter(w => w.walletAddress !== address));
        toast.success('Unfollowed whale');
      }
    } catch { toast.error('Action failed'); }
  }

  return (
    <div className="animate-fade-in p-6 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link to="/whales" className="flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors">
        <ArrowLeft className="size-4" /> Back to feed
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Fish className="size-6 text-pf-cyan-400" />
        <h1 className="text-2xl font-semibold text-pf-text">Following</h1>
        {!loading && <span className="text-sm text-pf-text-muted">{wallets.length} wallets</span>}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-pf-text-muted mb-4" />
          <p className="text-pf-text font-medium">You're not following any whales yet</p>
          <p className="text-sm text-pf-text-muted mt-1">Follow whales from the feed to track their trades.</p>
          <Link
            to="/whales"
            className="mt-4 px-4 py-2 rounded-pf-sm text-sm bg-pf-elevated border border-pf-border text-pf-text hover:border-pf-border-strong transition-colors"
          >
            Go to Whale Feed
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map(wallet => (
            <div
              key={wallet.walletAddress}
              className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <Link
                  to={`/whales/${wallet.walletAddress}`}
                  className="font-mono text-sm text-pf-text hover:text-pf-cyan-400 transition-colors"
                >
                  {truncateAddress(wallet.walletAddress)}
                </Link>
                <button
                  onClick={() => unfollow(wallet.walletAddress)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-medium border border-pf-danger/30 text-pf-danger hover:bg-pf-danger/10 transition-colors"
                >
                  <UserMinus className="size-3.5" /> Unfollow
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-pf-text-secondary">
                <span>Volume: <span className="font-mono text-pf-text">{wallet.totalVolume}</span></span>
                <span>P&L: <span className={`font-mono ${pnlColor(wallet.totalPnl)}`}>{pnlSign(wallet.totalPnl)}</span></span>
                <span>Trades: <span className="font-mono text-pf-text">{wallet.tradeCount}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
