import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Fish, UserMinus } from 'lucide-react';
import { Button, CardSkeleton, SkeletonLine } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface FollowedWallet {
  walletAddress: string;
  totalVolume?: string;
  totalPnl?: string;
  tradeCount?: number;
  profile?: {
    totalVolume?: string;
    totalPnl?: string;
    tradeCount?: number;
  };
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function WhaleFollowingSkeleton() {
  return (
    <CardSkeleton>
      <SkeletonLine h="h-4" w="w-[50%]" />
      <div className="flex gap-4">
        <SkeletonLine w="w-[25%]" />
        <SkeletonLine w="w-[25%]" />
        <SkeletonLine w="w-[25%]" />
      </div>
    </CardSkeleton>
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
      <Link to="/whales" className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to feed
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Fish className="size-6 text-accent-text" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-primary">Following</h1>
        {!loading && <span className="text-body-sm text-tertiary">{wallets.length} wallets</span>}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => <WhaleFollowingSkeleton key={i} />)}
        </div>
      ) : wallets.length === 0 ? (
        <div data-testid="empty-state" className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">You're not following any whales yet</p>
          <p className="text-body-sm text-tertiary mt-1">Follow whales from the feed to track their trades.</p>
          <Link
            to="/whales"
            className="mt-4 px-4 py-2 rounded-sm text-body-md bg-elevated border border-default text-primary hover:border-strong transition-colors"
          >
            Go to Whale Feed
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map(wallet => (
            <div
              key={wallet.walletAddress}
              data-testid="whale-feed-item"
              className="bg-elevated border border-default rounded-pf p-4 transition-all duration-panel hover:border-strong hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <Link
                  to={`/whales/${wallet.walletAddress}`}
                  className="font-mono text-body-md text-primary hover:text-accent-text transition-colors"
                >
                  {truncateAddress(wallet.walletAddress)}
                </Link>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => unfollow(wallet.walletAddress)}
                  data-testid={`unfollow-${wallet.walletAddress}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-sm text-label font-medium border border-loss/30 text-loss hover:bg-loss/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss/40 transition-colors"
                  aria-label={`Unfollow wallet ${truncateAddress(wallet.walletAddress)}`}
                >
                  <UserMinus className="size-4" /> Unfollow
                </Button>
              </div>

              <div data-testid="whale-stats" className="flex items-center gap-4 text-label text-secondary">
                <span>Volume: <span className="font-mono text-primary">{wallet.profile?.totalVolume ?? wallet.totalVolume ?? '—'}</span></span>
                <span>P&L: <span className={`font-mono ${pnlColor(wallet.profile?.totalPnl ?? wallet.totalPnl ?? '0')}`}>{pnlSign(wallet.profile?.totalPnl ?? wallet.totalPnl ?? '0')}</span></span>
                <span>Trades: <span className="font-mono text-primary">{wallet.profile?.tradeCount ?? wallet.tradeCount ?? 0}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
