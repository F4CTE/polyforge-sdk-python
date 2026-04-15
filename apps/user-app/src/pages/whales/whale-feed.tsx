import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Fish, Copy, Search, UserPlus, UserCheck,
} from 'lucide-react';
import { Button, Input, Select, CardSkeleton, SkeletonLine, SkeletonBadge } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

type MinSize = '5000' | '10000' | '50000' | '100000';

interface WhaleTrade {
  id: string;
  walletAddress: string;
  marketName: string;
  marketCategory: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  size: string;
  price: string;
  notional: string;
  timestamp: string;
  isFollowing?: boolean;
}

interface WhaleFeedResponse {
  data: WhaleTrade[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const MIN_SIZES: { label: string; value: MinSize }[] = [
  { label: '$5K+', value: '5000' },
  { label: '$10K+', value: '10000' },
  { label: '$50K+', value: '50000' },
  { label: '$100K+', value: '100000' },
];

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function fmtUsd(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return `${Math.round(n * 100)}¢`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Address copied'),
    () => toast.error('Failed to copy'),
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function WhaleFeedSkeleton() {
  return (
    <CardSkeleton>
      <div className="flex items-center gap-2">
        <SkeletonLine h="h-4" w="w-[120px]" />
        <SkeletonBadge w="w-16" className="ml-auto" />
      </div>
      <SkeletonLine w="w-[80%]" />
      <div className="flex gap-2">
        <SkeletonBadge w="w-12" />
        <SkeletonBadge w="w-12" />
      </div>
      <SkeletonLine w="w-[50%]" />
    </CardSkeleton>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [minSize, setMinSize] = useState<MinSize>('10000');
  const [category, setCategory] = useState('');
  const [walletSearch, setWalletSearch] = useState('');
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: number, min: MinSize, cat: string, wallet: string) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), minSize: min });
      if (cat) params.set('category', cat);
      if (wallet) params.set('wallet', wallet);
      const res = await fetch(`/api/v1/whales/feed?${params}`, { credentials: 'include', signal: controller.signal });
      if (res.ok) {
        const json: WhaleFeedResponse = await res.json();
        // Normalise: API returns nested market object + detectedAt; flatten for UI
        const trades: WhaleTrade[] = (json.data ?? []).map((t: WhaleTrade & { market?: { title?: string; category?: string }; detectedAt?: string; createdAt?: string }) => ({
          ...t,
          marketName: t.marketName ?? t.market?.title ?? 'Unknown market',
          marketCategory: t.marketCategory ?? t.market?.category ?? '',
          timestamp: t.timestamp ?? t.detectedAt ?? t.createdAt ?? new Date().toISOString(),
          size: typeof t.size === 'number' || typeof t.size === 'string' ? String(t.size) : '0',
          price: typeof t.price === 'number' || typeof t.price === 'string' ? String(t.price) : '0',
          notional: typeof t.notional === 'number' || typeof t.notional === 'string' ? String(t.notional) : '0',
        }));
        setTrades(trades);
        setTotal(json.meta?.total ?? 0);
        setTotalPages(json.meta?.totalPages ?? 0);
        const following = new Set<string>();
        trades.forEach(t => { if (t.isFollowing) following.add(t.walletAddress); });
        setFollowingSet(prev => {
          const merged = new Set(prev);
          following.forEach(a => merged.add(a));
          return merged;
        });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast.error('Failed to load whale trades');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, minSize, category, walletSearch); }, [page, minSize, category, walletSearch, load]);

  // Auto-refresh every 10 seconds — guarded against concurrent fetches
  useEffect(() => {
    refreshRef.current = setInterval(() => {
      if (!loading) load(page, minSize, category, walletSearch);
    }, 10_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [page, minSize, category, walletSearch, load, loading]);

  function changeMinSize(s: MinSize) { setMinSize(s); setPage(1); }
  function changeCategory(c: string) { setCategory(c); setPage(1); }

  async function toggleFollow(address: string) {
    const isFollowing = followingSet.has(address);
    try {
      const res = await fetch(`/api/v1/whales/${address}/${isFollowing ? 'unfollow' : 'follow'}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setFollowingSet(prev => {
          const next = new Set(prev);
          if (isFollowing) next.delete(address); else next.add(address);
          return next;
        });
        toast.success(isFollowing ? 'Unfollowed whale' : 'Following whale');
      }
    } catch { toast.error('Action failed'); }
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fish className="size-6 text-accent-text" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-primary">Whale Tracker</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/whales/following"
            className="text-xs font-medium text-primary hover:text-accent-text transition-colors"
          >
            Following
          </Link>
          {!loading && <span className="text-sm font-medium text-secondary">{total} trades</span>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Min size dropdown */}
        <div className="flex gap-2">
          {MIN_SIZES.map(s => (
            <Button
              type="button"
              variant="ghost"
              key={s.value}
              onClick={() => changeMinSize(s.value)}
              className={`px-3 py-2 rounded-pf-full text-xs font-medium whitespace-nowrap border transition-colors ${
                minSize === s.value
                  ? 'bg-accent/15 text-accent-text border-accent/30'
                  : 'bg-elevated text-secondary border-default hover:border-strong'
              }`}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {/* Category select */}
        <Select
          value={category}
          onChange={e => changeCategory(e.target.value)}
          aria-label="Filter by category"
          className="px-3 py-2 rounded-pf-sm text-xs bg-elevated text-secondary border border-default hover:border-strong transition-colors"
        >
          <option value="">All Categories</option>
          <option value="crypto">Crypto</option>
          <option value="politics">Politics</option>
          <option value="sports">Sports</option>
          <option value="entertainment">Entertainment</option>
          <option value="science">Science</option>
        </Select>

        {/* Wallet search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
          <Input
            type="text"
            placeholder="Search wallet..."
            aria-label="Search wallet address"
            value={walletSearch}
            onChange={e => { setWalletSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 rounded-pf-sm text-xs bg-elevated text-primary border border-default hover:border-strong focus-visible:border-accent/50 focus-visible:outline-none transition-colors placeholder:text-tertiary"
          />
        </div>
      </div>

      {/* Feed */}
      {loading && trades.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }, (_, i) => <WhaleFeedSkeleton key={i} />)}
        </div>
      ) : trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Fish className="size-10 text-tertiary mb-4" />
          <p className="text-primary font-medium">No whale trades detected yet</p>
          <p className="text-sm text-tertiary mt-1 max-w-sm">
            When large trades happen on Polymarket, they'll appear here. Follow wallets to track specific traders.
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${loading ? 'opacity-60' : ''}`}>
          {trades.map(trade => (
            <div
              key={trade.id}
              data-testid="whale-feed-item"
              className="bg-elevated border border-default rounded-pf-lg p-4 transition-all duration-pf-normal hover:border-strong hover:shadow-pf-sm"
            >
              {/* Top row: wallet + time */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/whales/${trade.walletAddress}`}
                    data-testid={`whale-${trade.walletAddress}`}
                    className="font-mono text-sm text-primary hover:text-accent-text transition-colors"
                  >
                    <span data-testid="whale-address">{truncateAddress(trade.walletAddress)}</span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => copyToClipboard(trade.walletAddress)}
                    className="text-tertiary hover:text-primary transition-colors"
                    title="Copy address"
                    aria-label="Copy wallet address"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
                <span data-testid="transaction-timestamp" className="text-pf-label text-tertiary">{timeAgo(trade.timestamp)}</span>
              </div>

              {/* Market name + category */}
              <div className="flex items-center gap-2 mb-3">
                <span data-testid="transaction-market" className="text-sm text-primary font-medium truncate">{trade.marketName}</span>
                <span className="px-2 py-1 rounded-pf-full text-pf-caption bg-overlay text-tertiary shrink-0">
                  {trade.marketCategory}
                </span>
              </div>

              {/* Side + Outcome badges */}
              <div className="flex items-center gap-2 mb-3">
                <span data-testid="transaction-side" className={`px-2 py-1 rounded text-pf-label font-semibold ${
                  trade.side === 'BUY'
                    ? 'bg-gain/15 text-gain'
                    : 'bg-loss/15 text-loss'
                }`}>
                  {trade.side}
                </span>
                <span className={`px-2 py-1 rounded text-pf-label font-semibold ${
                  trade.outcome === 'YES'
                    ? 'bg-gain/15 text-gain'
                    : 'bg-loss/15 text-loss'
                }`}>
                  {trade.outcome}
                </span>
              </div>

              {/* Size / Price / Notional */}
              <div className="flex items-center gap-4 text-xs text-secondary mb-3">
                <span data-testid="transaction-amount">Size: <span className="font-mono text-primary">{fmtUsd(trade.size)}</span></span>
                <span>Price: <span className="font-mono text-primary">{fmtPrice(trade.price)}</span></span>
                <span>Notional: <span className="font-mono text-primary font-semibold">{fmtUsd(trade.notional)}</span></span>
              </div>

              {/* Separator */}
              <div className="border-t border-subtle my-2" />

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  data-testid={followingSet.has(trade.walletAddress) ? `unfollow-${trade.walletAddress}` : `follow-${trade.walletAddress}`}
                  onClick={() => toggleFollow(trade.walletAddress)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-pf-sm text-xs font-medium border cursor-pointer transition-colors ${
                    followingSet.has(trade.walletAddress)
                      ? 'bg-accent/15 text-accent-text border-accent/30'
                      : 'text-accent-text border-accent/30 hover:bg-accent/10'
                  }`}
                >
                  {followingSet.has(trade.walletAddress) ? (
                    <><UserCheck className="size-4" /> Following</>
                  ) : (
                    <><UserPlus className="size-4" /> Follow</>
                  )}
                </Button>
                <Link
                  to={`/copy/new?wallet=${trade.walletAddress}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-pf-sm text-xs font-medium border border-gain/30 text-gain hover:bg-gain/10 transition-colors"
                >
                  <Copy className="size-4" /> Copy
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span data-testid="page-indicator" className="text-sm font-mono text-secondary" aria-live="polite">{page} / {totalPages}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
