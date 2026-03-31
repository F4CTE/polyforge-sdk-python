import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Users,
  Trophy,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TraderCard {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  rank: number;
  pnl: string;
  winRate: string;
  tradeCount: number;
  score?: number;
}

interface LeaderboardResponse {
  data: TraderCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CopyConfig {
  id: string;
  targetWallet: string;
  userId?: string;
}

type Category = 'All' | 'Politics' | 'Sports' | 'Crypto' | 'Finance' | 'Entertainment';
type WinRateFilter = 'Any' | '50' | '60' | '70' | '80';
type MinTradesFilter = 'Any' | '10' | '25' | '50' | '100';

/* ─── Constants ──────────────────────────────────────────────────────── */

const CATEGORIES: Category[] = ['All', 'Politics', 'Sports', 'Crypto', 'Finance', 'Entertainment'];

const WIN_RATE_OPTIONS: { label: string; value: WinRateFilter }[] = [
  { label: 'Any', value: 'Any' },
  { label: '50%+', value: '50' },
  { label: '60%+', value: '60' },
  { label: '70%+', value: '70' },
  { label: '80%+', value: '80' },
];

const MIN_TRADES_OPTIONS: { label: string; value: MinTradesFilter }[] = [
  { label: 'Any', value: 'Any' },
  { label: '10+', value: '10' },
  { label: '25+', value: '25' },
  { label: '50+', value: '50' },
  { label: '100+', value: '100' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (rank === 2) return 'bg-slate-400/20 text-slate-300 border border-slate-400/30';
  if (rank === 3) return 'bg-orange-600/20 text-orange-400 border border-orange-600/30';
  return 'bg-pf-overlay text-pf-text-muted border border-pf-border';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-pf-success';
  if (score >= 60) return 'text-pf-cyan-400';
  if (score >= 40) return 'text-pf-warning';
  return 'text-pf-danger';
}

function pnlIsPositive(pnl: string): boolean {
  const num = parseFloat(pnl.replace(/[^0-9.-]/g, ''));
  return !pnl.startsWith('-') && num >= 0;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-pf-overlay shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-pf-overlay rounded w-[55%]" />
          <div className="h-3 bg-pf-overlay rounded w-[35%]" />
        </div>
        <div className="h-5 w-10 bg-pf-overlay rounded-full" />
      </div>
      <div className="h-3 bg-pf-overlay rounded w-[40%]" />
      <div className="flex gap-3">
        <div className="h-4 bg-pf-overlay rounded w-[30%]" />
        <div className="h-4 bg-pf-overlay rounded w-[25%]" />
        <div className="h-4 bg-pf-overlay rounded w-[20%]" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-8 bg-pf-overlay rounded-pf w-full" />
        <div className="h-8 bg-pf-overlay rounded-pf w-24 shrink-0" />
      </div>
    </div>
  );
}

/* ─── Trader Card ────────────────────────────────────────────────────── */

function TraderCardItem({
  trader,
  isCopying,
}: {
  trader: TraderCard;
  isCopying: boolean;
}) {
  const navigate = useNavigate();
  const positive = pnlIsPositive(trader.pnl);

  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 hover:border-pf-border-strong transition-colors flex flex-col gap-3">
      {/* Avatar + name + rank */}
      <div className="flex items-center gap-3">
        {trader.avatarUrl ? (
          <img
            src={trader.avatarUrl}
            alt={trader.displayName ?? trader.username}
            className="size-10 rounded-full object-cover shrink-0 bg-pf-overlay"
          />
        ) : (
          <div className="size-10 rounded-full bg-pf-cyan-500/20 text-pf-cyan-400 flex items-center justify-center text-sm font-semibold shrink-0 select-none">
            {initials(trader.displayName ?? trader.username)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-pf-text truncate">
            {trader.displayName ?? trader.username}
          </p>
          <p className="text-xs text-pf-text-muted truncate">@{trader.username}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${rankBadgeClass(trader.rank)}`}
          title={`Rank #${trader.rank}`}
        >
          {trader.rank <= 3 && <Trophy className="size-3" aria-hidden="true" />}#
          {trader.rank}
        </span>
      </div>

      {/* Edge Score badge */}
      {trader.score !== undefined && (
        <div className="flex items-center gap-1.5">
          <TrendingUp className="size-3.5 text-pf-text-muted" aria-hidden="true" />
          <span className="text-xs text-pf-text-secondary">Edge Score</span>
          <span className={`text-xs font-mono font-bold ${scoreColor(trader.score)}`}>
            {trader.score}
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex flex-col gap-0.5">
          <span className="text-pf-text-muted">P&amp;L</span>
          <span className={`font-mono font-semibold ${positive ? 'text-pf-success' : 'text-pf-danger'}`}>
            {trader.pnl}
          </span>
        </span>
        <span className="text-pf-border-strong">|</span>
        <span className="flex flex-col gap-0.5">
          <span className="text-pf-text-muted">Win Rate</span>
          <span className="font-mono text-pf-text">{trader.winRate}</span>
        </span>
        <span className="text-pf-border-strong">|</span>
        <span className="flex flex-col gap-0.5">
          <span className="text-pf-text-muted">Trades</span>
          <span className="font-mono text-pf-text">{trader.tradeCount}</span>
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-pf-border-subtle">
        <Link
          to={`/profile/${trader.username}`}
          className="flex-1 text-center px-3 py-1.5 rounded-pf text-xs font-medium text-pf-text-secondary bg-pf-overlay hover:bg-pf-surface hover:text-pf-text transition-colors"
        >
          View Profile
        </Link>
        {isCopying ? (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-pf text-xs font-medium bg-pf-success/10 text-pf-success border border-pf-success/20 shrink-0">
            Already Copying
          </span>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/copy/new?address=${trader.username}`)}
            className="px-3 py-1.5 rounded-pf text-xs font-medium bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors shrink-0"
          >
            Copy Trade
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [traders, setTraders] = useState<TraderCard[]>([]);
  const [copyConfigs, setCopyConfigs] = useState<CopyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  /* Filters */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [winRate, setWinRate] = useState<WinRateFilter>('Any');
  const [minTrades, setMinTrades] = useState<MinTradesFilter>('Any');

  /* Fetch existing copy configs once to detect "already copying" */
  useEffect(() => {
    fetch('/api/v1/copy?limit=100&page=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.data) setCopyConfigs(res.data);
      })
      .catch(() => {/* ignore — non-critical */});
  }, []);

  const load = useCallback(
    (p: number = 1) => {
      setLoading(true);
      const params = new URLSearchParams({
        period: 'allTime',
        page: String(p),
        limit: '20',
      });
      if (category !== 'All') params.set('category', category);
      if (winRate !== 'Any') params.set('minWinRate', winRate);
      if (minTrades !== 'Any') params.set('minTrades', minTrades);
      if (search.trim()) params.set('q', search.trim());

      fetch(`/api/v1/leaderboard?${params}`, { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((res: LeaderboardResponse) => {
          setTraders(res.data ?? []);
          setTotalPages(res.totalPages ?? 0);
          setLoading(false);
        })
        .catch(() => {
          toast.error('Failed to load traders');
          setTraders([]);
          setLoading(false);
        });
    },
    [category, winRate, minTrades, search],
  );

  useEffect(() => {
    setPage(1);
    load(1);
  }, [load]);

  function onPageChange(next: number) {
    setPage(next);
    load(next);
  }

  /* Client-side search filter applied on top of whatever the API returns */
  const visibleTraders = search.trim()
    ? traders.filter(
        (t) =>
          t.username.toLowerCase().includes(search.trim().toLowerCase()) ||
          (t.displayName ?? '').toLowerCase().includes(search.trim().toLowerCase()),
      )
    : traders;

  /* Determine which traders are already being copied */
  const copiedUserIds = new Set(copyConfigs.map((c) => c.userId).filter(Boolean));
  const copiedWallets = new Set(copyConfigs.map((c) => c.targetWallet));

  function isCopying(trader: TraderCard): boolean {
    return copiedUserIds.has(trader.userId) || copiedWallets.has(trader.username);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Users className="size-6 text-pf-cyan-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-pf-text">Discover Traders</h1>
          <p className="text-sm text-pf-text-muted mt-0.5">Find top performers to copy</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Search */}
        <input
          type="search"
          placeholder="Search by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text text-sm placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors"
        />

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors cursor-pointer ${
                category === cat
                  ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                  : 'border-pf-border text-pf-text-secondary hover:text-pf-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Win Rate + Min Trades selects */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-pf-text-secondary whitespace-nowrap" htmlFor="win-rate-filter">
              Win Rate
            </label>
            <select
              id="win-rate-filter"
              value={winRate}
              onChange={(e) => setWinRate(e.target.value as WinRateFilter)}
              className="px-2.5 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-pf-text text-sm focus:outline-none focus:border-pf-cyan-500/50 transition-colors cursor-pointer"
            >
              {WIN_RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-pf-text-secondary whitespace-nowrap" htmlFor="min-trades-filter">
              Min Trades
            </label>
            <select
              id="min-trades-filter"
              value={minTrades}
              onChange={(e) => setMinTrades(e.target.value as MinTradesFilter)}
              className="px-2.5 py-1.5 rounded-pf bg-pf-elevated border border-pf-border text-pf-text text-sm focus:outline-none focus:border-pf-cyan-500/50 transition-colors cursor-pointer"
            >
              {MIN_TRADES_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && visibleTraders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">No traders found matching your filters</p>
          <p className="text-sm text-pf-text-muted mt-1">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Trader cards grid */}
      {!loading && visibleTraders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {visibleTraders.map((trader) => (
            <TraderCardItem
              key={trader.userId}
              trader={trader}
              isCopying={isCopying(trader)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
