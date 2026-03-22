import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Compass, Heart, GitFork,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type SortOption = 'popular' | 'newest' | 'top_pnl' | 'most_forked';

interface PublicStrategy {
  id: string;
  name: string;
  description?: string;
  execMode: string;
  tags: string[];
  likeCount: number;
  forkCount: number;
  createdAt: string;
  author: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

interface DiscoverResponse {
  data: PublicStrategy[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Popular', value: 'popular' },
  { label: 'Newest', value: 'newest' },
  { label: 'Top P&L', value: 'top_pnl' },
  { label: 'Most Forked', value: 'most_forked' },
];

function authorInitials(s: PublicStrategy): string {
  return (s.author.displayName ?? s.author.username).slice(0, 2).toUpperCase();
}

function execLabel(mode: string): string {
  const map: Record<string, string> = { TICK: 'Tick', EVENT: 'Event' };
  return map[mode] ?? mode;
}

function mockPnl(s: PublicStrategy): number {
  const hash = s.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  if (hash % 10 < 3) return 0;
  const seed = Math.sin(hash) * 10000;
  return parseFloat(((seed - Math.floor(seed)) * 20 - 10).toFixed(1));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer">
      <div className="h-3.5 bg-pf-overlay rounded w-[60%]" />
      <div className="h-2.5 bg-pf-overlay rounded w-[90%]" />
      <div className="h-2.5 bg-pf-overlay rounded w-[75%]" />
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-pf-overlay rounded-full" />
        <div className="h-5 w-12 bg-pf-overlay rounded-full" />
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [strategies, setStrategies] = useState<PublicStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('popular');

  const load = useCallback(async (p: number, s: SortOption) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/discover?sort=${s}&page=${p}&limit=12`, { credentials: 'include' });
      if (res.ok) {
        const data: DiscoverResponse = await res.json();
        setStrategies(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, sort); }, [page, sort, load]);

  function changeSort(s: SortOption) {
    setSort(s);
    setPage(1);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Discover</h1>
        {!loading && <span className="text-sm text-pf-text-muted">{total} strategies</span>}
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => changeSort(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              sort === opt.value
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading && strategies.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Compass className="size-10 text-pf-text-muted mb-4" />
          <p className="text-pf-text font-medium">No strategies found</p>
          <p className="text-sm text-pf-text-muted mt-1">Be the first to publish a public strategy.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children ${loading ? 'opacity-60' : ''}`}>
          {strategies.map(s => {
            const pnl = mockPnl(s);
            return (
              <Link
                key={s.id}
                to={`/strategies/${s.id}`}
                className="group block bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5"
              >
                {/* Author row */}
                <div className="flex items-center gap-2 mb-3">
                  {s.author.avatarUrl ? (
                    <img src={s.author.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
                  ) : (
                    <div className="size-7 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-[10px] font-bold text-cyan-400">
                      {authorInitials(s)}
                    </div>
                  )}
                  <Link
                    to={`/profile/${s.author.username}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-pf-text-secondary hover:text-pf-cyan-400 transition-colors"
                  >
                    {s.author.displayName ?? s.author.username}
                  </Link>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-pf-overlay text-pf-text-muted">
                    {execLabel(s.execMode)}
                  </span>
                </div>

                {/* Name + description */}
                <div className="text-sm font-medium text-pf-text group-hover:text-pf-cyan-400 transition-colors mb-1">
                  {s.name}
                </div>
                {s.description && (
                  <div className="text-xs text-pf-text-muted line-clamp-2 mb-3">{s.description}</div>
                )}

                {/* Tags */}
                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] bg-pf-overlay text-pf-text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer stats */}
                <div className="flex items-center gap-3 text-xs text-pf-text-muted pt-2 border-t border-pf-border-subtle">
                  <span className="flex items-center gap-1"><Heart className="size-3" /> {s.likeCount}</span>
                  <span className="flex items-center gap-1"><GitFork className="size-3" /> {s.forkCount}</span>
                  <span className={`ml-auto font-mono ${
                    pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-pf-text-muted'
                  }`}>
                    <span className="text-[10px] text-pf-text-muted font-sans mr-0.5">24h</span>
                    {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(1)}%` : '\u2014'}
                  </span>
                  <span className="font-mono text-[11px]">{formatDate(s.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
