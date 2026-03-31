import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Users, ChevronLeft, ChevronRight, Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface FeedActor {
  username: string;
  displayName: string | null;
  avatarUrl?: string;
}

interface FeedItem {
  id: string;
  type: 'ORDER_FILLED' | 'STRATEGY_CREATED' | 'POSITION_CLOSED' | 'BACKTEST_COMPLETED';
  actor: FeedActor;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface FeedResponse {
  data: FeedItem[];
  total: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function activityDescription(item: FeedItem): string {
  const p = item.payload;
  switch (item.type) {
    case 'ORDER_FILLED': {
      const side = typeof p.side === 'string' ? p.side : '';
      const outcome = typeof p.outcome === 'string' ? p.outcome : '';
      const marketTitle = typeof p.marketTitle === 'string' ? p.marketTitle : 'a market';
      const base = `placed a ${side} ${outcome} order on ${marketTitle}`.trim();
      if (typeof p.pnl === 'number' || typeof p.pnl === 'string') {
        return `${base} · P&L: ${p.pnl}`;
      }
      return base;
    }
    case 'STRATEGY_CREATED': {
      const name = typeof p.strategyName === 'string' ? p.strategyName : 'a strategy';
      return `created a new strategy: ${name}`;
    }
    case 'POSITION_CLOSED': {
      const pnl = typeof p.pnl === 'number' || typeof p.pnl === 'string' ? p.pnl : 'unknown';
      return `closed position with ${pnl} P&L`;
    }
    case 'BACKTEST_COMPLETED': {
      const winRate = typeof p.winRate === 'number' || typeof p.winRate === 'string' ? p.winRate : '?';
      return `completed a backtest with ${winRate}% win rate`;
    }
    default:
      return 'performed an action';
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Initials({ actor }: { actor: FeedActor }) {
  const label = (actor.displayName ?? actor.username).slice(0, 2).toUpperCase();
  return (
    <div className="size-9 rounded-full bg-pf-surface flex items-center justify-center text-sm font-bold text-pf-cyan-400 shrink-0">
      {label}
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-pf-border-subtle last:border-b-0">
      <div className="size-9 rounded-full bg-pf-overlay animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 bg-pf-overlay rounded animate-pulse" />
        <div className="h-3 w-64 bg-pf-overlay rounded animate-pulse" />
        <div className="h-2.5 w-16 bg-pf-overlay rounded animate-pulse" />
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  // null = unknown (loading), true = has follows, false = no follows at all
  const [hasFollows, setHasFollows] = useState<boolean | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/v1/feed?page=${page}&limit=${LIMIT}`, { credentials: 'include' });
        if (!res.ok) {
          toast.error('Failed to load feed');
          return;
        }
        const json: FeedResponse = await res.json();
        if (!cancelled) {
          setItems(json.data ?? []);
          setTotal(json.total ?? 0);
          setTotalPages(json.totalPages ?? 1);
          // If on page 1 and no items, check if they follow anyone
          if (page === 1 && (json.data ?? []).length === 0) {
            // Try to determine if user follows anyone by checking total
            // total=0 with no items could mean no follows or no activity
            // We differentiate via a "no-follows" sentinel: if total is explicitly 0
            // and the API does not tell us, we attempt a profile follows check
            try {
              const followRes = await fetch('/api/v1/users/me/following?limit=1', { credentials: 'include' });
              if (!cancelled) {
                if (followRes.ok) {
                  const followData = await followRes.json();
                  const count = followData.total ?? followData.data?.length ?? 0;
                  setHasFollows(count > 0);
                } else {
                  setHasFollows(false);
                }
              }
            } catch {
              if (!cancelled) setHasFollows(false);
            }
          } else {
            if (!cancelled) setHasFollows(true);
          }
        }
      } catch {
        if (!cancelled) toast.error('Failed to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [page]);

  function handlePrev() {
    if (page > 1) setPage(p => p - 1);
  }

  function handleNext() {
    if (page < totalPages) setPage(p => p + 1);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Users className="size-5 text-pf-cyan-400 shrink-0" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-pf-text">Following Feed</h1>
        {!loading && total > 0 && (
          <span className="ml-auto text-xs text-pf-text-muted">{total.toLocaleString()} item{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Feed card */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : items.length === 0 ? (
          /* Empty states */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users className="size-10 text-pf-text-muted mb-3" aria-hidden="true" />
            {hasFollows === false ? (
              <>
                <p className="text-sm font-medium text-pf-text mb-1">You're not following anyone yet</p>
                <p className="text-xs text-pf-text-muted mb-4">
                  Follow traders to see their activity here.
                </p>
                <Link
                  to="/leaderboard"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pf bg-pf-cyan-500/15 text-pf-cyan-400 border border-pf-cyan-500/30 hover:bg-pf-cyan-500/25 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
                >
                  <Trophy className="size-3.5" aria-hidden="true" />
                  Discover traders on the Leaderboard
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-pf-text mb-1">No recent activity</p>
                <p className="text-xs text-pf-text-muted">
                  No recent activity from traders you follow.
                </p>
              </>
            )}
          </div>
        ) : (
          /* Feed timeline */
          <ul className="divide-y divide-pf-border-subtle" role="list">
            {items.map(item => {
              const actor = item.actor;
              const displayName = actor.displayName ?? actor.username;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-4 hover:bg-pf-surface/40 transition-colors">
                  {/* Avatar */}
                  <Link
                    to={`/profile/${actor.username}`}
                    aria-label={`View ${displayName}'s profile`}
                    className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-full"
                  >
                    {actor.avatarUrl ? (
                      <img
                        src={actor.avatarUrl}
                        alt={`${displayName} avatar`}
                        className="size-9 rounded-full object-cover"
                      />
                    ) : (
                      <Initials actor={actor} />
                    )}
                  </Link>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <Link
                        to={`/profile/${actor.username}`}
                        className="text-sm font-semibold text-pf-text hover:text-pf-cyan-400 transition-colors focus-visible:outline-none focus-visible:underline"
                      >
                        {displayName}
                      </Link>
                      <span className="text-xs text-pf-text-muted">@{actor.username}</span>
                    </div>
                    <p className="text-xs text-pf-text-secondary mt-0.5 leading-relaxed">
                      {activityDescription(item)}
                    </p>
                    <time
                      className="text-[10px] text-pf-text-muted mt-1 block"
                      dateTime={item.createdAt}
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {relativeTime(item.createdAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs font-medium text-pf-text-secondary border border-pf-border hover:border-pf-border-strong hover:text-pf-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Previous
          </button>
          <span className="text-xs text-pf-text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf text-xs font-medium text-pf-text-secondary border border-pf-border hover:border-pf-border-strong hover:text-pf-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
          >
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
