import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Compass, Heart, GitFork, TrendingUp,
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
    score?: number;
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

// P&L data removed — synthetic financial metrics must not be shown to users.
// TODO: Replace with real P&L from API when available.

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
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (p: number, s: SortOption, q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: s, page: String(p), limit: '12' });
      if (q) params.set('search', q);
      const res = await fetch(`/api/v1/discover?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: DiscoverResponse = await res.json();
        setStrategies(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, sort, searchQuery); }, [page, sort, searchQuery, load]);

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

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          type="text"
          placeholder="Search strategies..."
          aria-label="Search strategies"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); }}
          className="w-full pl-10 pr-4 py-2.5 rounded-pf-sm text-sm bg-pf-elevated text-pf-text border border-pf-border hover:border-pf-border-strong focus:border-pf-cyan-500/50 focus:outline-none transition-colors placeholder:text-pf-text-muted"
        />
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {SORT_OPTIONS.map(opt => (
          <button
            type="button"
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
        <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
          <Compass className="size-10 text-pf-text-muted mb-4" aria-hidden="true" />
          <p className="text-pf-text font-medium">No strategies found</p>
          <p className="text-sm text-pf-text-muted mt-1">Be the first to publish a public strategy.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children ${loading ? 'opacity-60' : ''}`}>
          {strategies.map(s => {
            return (
              <Link
                key={s.id}
                to={`/strategies/${s.id}`}
                className="group block bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
              >
                {/* Author row */}
                <div className="flex items-center gap-2 mb-3">
                  {s.author.avatarUrl ? (
                    <img src={s.author.avatarUrl} alt={`${s.author.displayName ?? s.author.username} avatar`} className="size-7 rounded-full object-cover" width={28} height={28} loading="lazy" />
                  ) : (
                    <div className="size-7 rounded-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center text-[10px] font-bold text-pf-cyan-400">
                      {authorInitials(s)}
                    </div>
                  )}
                  <a
                    href={`/profile/${s.author.username}`}
                    onClick={e => { e.stopPropagation(); }}
                    className="text-xs text-pf-text-secondary hover:text-pf-cyan-400 transition-colors"
                  >
                    {s.author.displayName ?? s.author.username}
                  </a>
                  {s.author.score != null && s.author.score > 0 && (
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      s.author.score >= 80 ? 'text-pf-success bg-pf-success/10 border-pf-success/20' :
                      s.author.score >= 60 ? 'text-pf-cyan-400 bg-pf-cyan-500/10 border-pf-cyan-500/20' :
                      s.author.score >= 40 ? 'text-pf-warning bg-pf-warning/10 border-pf-warning/20' :
                      'text-pf-text-muted bg-pf-overlay border-pf-border'
                    }`}>
                      <TrendingUp className="size-2.5" />
                      {s.author.score}
                    </span>
                  )}
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
                      <span key={tag} className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        tag === 'momentum' ? 'bg-amber-500/15 text-amber-400' :
                        tag === 'political' ? 'bg-blue-500/15 text-blue-400' :
                        tag === 'yes-bias' ? 'bg-emerald-500/15 text-emerald-400' :
                        tag === 'defensive' ? 'bg-purple-500/15 text-purple-400' :
                        tag === 'scalping' ? 'bg-red-500/15 text-red-400' :
                        tag === 'high-freq' ? 'bg-pink-500/15 text-pink-400' :
                        'bg-pf-overlay text-pf-text-muted'
                      }`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-pf-border-subtle my-2" />

                {/* Footer stats */}
                <div className="flex items-center gap-3 text-sm text-pf-text-muted pt-1">
                  <span className="flex items-center gap-1"><Heart className="size-3.5" aria-hidden="true" /> {s.likeCount}</span>
                  <span className="flex items-center gap-1"><GitFork className="size-3.5" aria-hidden="true" /> {s.forkCount}</span>
                  <span className="ml-auto text-[11px] text-pf-text-muted">&bull;</span>
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
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
