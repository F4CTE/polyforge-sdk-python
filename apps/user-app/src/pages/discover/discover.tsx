import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Compass, Heart, GitFork, TrendingUp, Tag, Star, Award, Library,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type SortOption = 'popular' | 'newest' | 'top_pnl' | 'most_forked';
type Category = 'politics' | 'sports' | 'crypto' | 'finance' | 'entertainment' | 'science' | 'weather';

interface PublicStrategy {
  id: string;
  name: string;
  description?: string;
  execMode: string;
  tags: string[];
  likeCount: number;
  isLiked?: boolean;
  forkCount: number;
  createdAt: string;
  author: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
    score?: number;
  };
}

interface FeaturedListing {
  id: string;
  title: string;
  description?: string;
  priceUsdc: string;
  winRate?: number;
  tradeCount?: number;
  forkCount: number;
  likeCount: number;
  seller: {
    username: string;
    displayName?: string;
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

const CATEGORIES: { label: string; value: Category | null }[] = [
  { label: 'All', value: null },
  { label: 'Politics', value: 'politics' },
  { label: 'Sports', value: 'sports' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Finance', value: 'finance' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'Science', value: 'science' },
  { label: 'Weather', value: 'weather' },
];

function authorInitials(s: PublicStrategy): string {
  return (s.author.displayName ?? s.author.username).slice(0, 2).toUpperCase();
}

function execLabel(mode: string): string {
  const map: Record<string, string> = { TICK: 'Tick', EVENT: 'Event' };
  return map[mode] ?? mode;
}

// Author score sourced from TraderScore table (0–100, computed from real trading activity).

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

interface Collection {
  id: string;
  title: string;
  description: string;
  emoji: string;
  listingCount: number;
  totalVolume: string;
  avgWinRate: string;
  createdAt: string;
  coverListings: Array<{ id: string; title: string; seller: { username: string } }>;
}

export function Component() {
  const navigate = useNavigate();
  const [featuredListings, setFeaturedListings] = useState<FeaturedListing[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [strategies, setStrategies] = useState<PublicStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likingInFlight, setLikingInFlight] = useState<Set<string>>(new Set());

  // Fetch featured listings once on mount
  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await fetch('/api/v1/marketplace/listings?featured=true&limit=3', {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const items: FeaturedListing[] = Array.isArray(json) ? json : (json.data ?? []);
          setFeaturedListings(items.slice(0, 3));
        }
      } catch {
        // silently ignore — featured section simply won't render
      }
    }
    loadFeatured();
  }, []);

  // Fetch collections strip on mount
  useEffect(() => {
    async function loadCollections() {
      try {
        const res = await fetch('/api/v1/marketplace/collections?limit=6', {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setCollections(Array.isArray(json) ? json : (json.data ?? []));
        }
      } catch {
        // silently ignore — strip won't render
      }
    }
    loadCollections();
  }, []);

  // Debounce tag filter
  const tagDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedTag, setDebouncedTag] = useState('');

  useEffect(() => {
    if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    tagDebounceRef.current = setTimeout(() => {
      setDebouncedTag(tagFilter);
      setPage(1);
    }, 400);
    return () => {
      if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    };
  }, [tagFilter]);

  const load = useCallback(async (
    p: number,
    s: SortOption,
    q?: string,
    cat?: Category | null,
    tag?: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: s, page: String(p), limit: '12' });
      if (q) params.set('search', q);
      if (cat) params.set('category', cat);
      if (tag) params.set('tag', tag);
      const res = await fetch(`/api/v1/discover?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data: DiscoverResponse = await res.json();
        setStrategies(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);

        // Seed likedIds and likeCounts from fresh data
        setLikedIds(prev => {
          const next = new Set(prev);
          data.data.forEach(st => {
            if (st.isLiked) next.add(st.id);
          });
          return next;
        });
        setLikeCounts(prev => {
          const next = { ...prev };
          data.data.forEach(st => {
            if (!(st.id in next)) next[st.id] = st.likeCount;
          });
          return next;
        });
      }
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page, sort, searchQuery, category, debouncedTag);
  }, [page, sort, searchQuery, category, debouncedTag, load]);

  function changeSort(s: SortOption) {
    setSort(s);
    setPage(1);
  }

  function changeCategory(cat: Category | null) {
    setCategory(cat);
    setPage(1);
  }

  async function handleLike(e: React.MouseEvent, strategyId: string) {
    e.preventDefault();
    e.stopPropagation();

    if (likingInFlight.has(strategyId)) return;

    const wasLiked = likedIds.has(strategyId);
    const currentCount = likeCounts[strategyId] ?? 0;

    // Optimistic update
    setLikedIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(strategyId);
      else next.add(strategyId);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [strategyId]: wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
    }));
    setLikingInFlight(prev => new Set(prev).add(strategyId));

    try {
      const method = wasLiked ? 'DELETE' : 'POST';
      const res = await fetch(`/api/v1/marketplace/listings/${strategyId}/like`, {
        method,
        credentials: 'include',
      });
      if (!res.ok) {
        // Revert on failure
        setLikedIds(prev => {
          const next = new Set(prev);
          if (wasLiked) next.add(strategyId);
          else next.delete(strategyId);
          return next;
        });
        setLikeCounts(prev => ({ ...prev, [strategyId]: currentCount }));
        toast.error(wasLiked ? 'Failed to unlike' : 'Failed to like strategy');
      }
    } catch {
      // Revert on error
      setLikedIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(strategyId);
        else next.delete(strategyId);
        return next;
      });
      setLikeCounts(prev => ({ ...prev, [strategyId]: currentCount }));
      toast.error('Network error');
    } finally {
      setLikingInFlight(prev => {
        const next = new Set(prev);
        next.delete(strategyId);
        return next;
      });
    }
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Discover</h1>
        {!loading && <span className="text-sm text-pf-text-muted">{total} strategies</span>}
      </div>

      {/* Featured Strategies */}
      {featuredListings.length > 0 && (
        <section aria-label="Featured Strategies">
          <div className="flex items-center gap-2 mb-3">
            <Star className="size-4 text-pf-warning fill-pf-warning" aria-hidden="true" />
            <span className="text-base font-semibold text-pf-text">Featured</span>
            <Award className="size-3.5 text-pf-warning ml-0.5" aria-hidden="true" />
            <span className="text-xs text-pf-text-muted ml-1">Hand-picked by the PolyForge team</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredListings.map(f => (
              <Link
                key={f.id}
                to={`/marketplace/${f.id}`}
                className="group block bg-pf-elevated border border-pf-warning/40 rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-warning/60 hover:shadow-pf-sm hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-warning"
              >
                {/* FEATURED badge + seller */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-pf-warning/15 text-pf-warning text-[10px] font-bold px-1.5 py-0.5 rounded">
                    FEATURED
                  </span>
                  <span className="text-xs text-pf-text-secondary ml-auto truncate">
                    {f.seller.displayName ?? f.seller.username}
                  </span>
                </div>

                {/* Title */}
                <div className="text-sm font-semibold text-pf-text group-hover:text-pf-warning transition-colors mb-1 truncate">
                  {f.title}
                </div>

                {/* Description */}
                {f.description && (
                  <div className="text-xs text-pf-text-muted line-clamp-2 mb-3">{f.description}</div>
                )}

                {/* Stats row */}
                <div className="flex flex-wrap gap-2 text-[11px] text-pf-text-secondary mb-3">
                  {f.winRate != null && (
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="size-3" aria-hidden="true" />
                      {f.winRate}% win rate
                    </span>
                  )}
                  {f.tradeCount != null && (
                    <span>{f.tradeCount} trades</span>
                  )}
                  <span className="ml-auto font-semibold text-pf-text">
                    {Number(f.priceUsdc) === 0 ? 'Free' : `$${Number(f.priceUsdc).toFixed(2)}`}
                  </span>
                </div>

                {/* Separator */}
                <div className="border-t border-pf-border-subtle my-2" />

                {/* Footer: forks / likes + CTA */}
                <div className="flex items-center gap-3 text-xs text-pf-text-muted">
                  <span className="flex items-center gap-1"><GitFork className="size-3" aria-hidden="true" /> {f.forkCount}</span>
                  <span className="flex items-center gap-1"><Heart className="size-3" aria-hidden="true" /> {f.likeCount}</span>
                  <span className="ml-auto border border-pf-cyan-500/40 text-pf-cyan-400 text-[10px] font-medium px-2 py-0.5 rounded hover:bg-pf-cyan-500/10 transition-colors">
                    View Strategy
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {/* Separator before main grid */}
          <div className="border-t border-pf-border mt-6" />
        </section>
      )}

      {/* Collections strip */}
      {collections.length > 0 && (
        <section aria-label="Strategy Collections">
          <div className="flex items-center gap-2 mb-3">
            <Library className="size-4 text-pf-cyan-400" aria-hidden="true" />
            <span className="text-base font-semibold text-pf-text">Collections</span>
            <Link
              to="/collections"
              className="ml-auto text-xs text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors flex items-center gap-0.5"
            >
              View all <ChevronRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {collections.map(col => (
              <button
                key={col.id}
                type="button"
                onClick={() => navigate(`/collections/${col.id}`)}
                className="bg-pf-elevated border border-pf-border rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5 whitespace-nowrap hover:border-pf-border-strong cursor-pointer transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
              >
                <span role="img" aria-label={col.title}>{col.emoji}</span>
                <span className="text-pf-text font-medium">{col.title}</span>
                <span className="text-pf-text-muted text-xs">{col.listingCount} strategies</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Search + Tag filter bar */}
      <div className="flex gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="text"
            placeholder="Search strategies..."
            aria-label="Search strategies"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-pf-sm text-sm bg-pf-elevated text-pf-text border border-pf-border hover:border-pf-border-strong focus:border-pf-cyan-500/50 focus:outline-none transition-colors placeholder:text-pf-text-muted"
          />
        </div>
        {/* Tag filter */}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-pf-text-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Filter by tag..."
            aria-label="Filter by tag"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="pl-8 pr-3 py-2.5 rounded-pf-sm text-sm bg-pf-elevated text-pf-text border border-pf-border hover:border-pf-border-strong focus:border-pf-cyan-500/50 focus:outline-none transition-colors placeholder:text-pf-text-muted w-36"
          />
        </div>
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

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            type="button"
            key={cat.value ?? 'all'}
            onClick={() => changeCategory(cat.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
              category === cat.value
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {cat.label}
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
            const isLiked = likedIds.has(s.id);
            const likeCount = likeCounts[s.id] ?? s.likeCount;
            const isLiking = likingInFlight.has(s.id);

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
                      s.author.score >= 70 ? 'text-pf-success bg-pf-success/10 border-pf-success/20' :
                      s.author.score >= 40 ? 'text-pf-warning bg-pf-warning/10 border-pf-warning/20' :
                      'text-pf-danger bg-pf-danger/10 border-pf-danger/20'
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
                        tag === 'momentum' ? 'bg-pf-warning/15 text-pf-warning' :
                        tag === 'political' ? 'bg-pf-info/15 text-pf-info' :
                        tag === 'yes-bias' ? 'bg-pf-success/15 text-pf-success' :
                        tag === 'defensive' ? 'bg-pf-purple-500/15 text-pf-purple-400' :
                        tag === 'scalping' ? 'bg-pf-danger/15 text-pf-danger' :
                        tag === 'high-freq' ? 'bg-pf-purple-300/15 text-pf-purple-300' :
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
                  {/* Like button */}
                  <button
                    type="button"
                    aria-label={isLiked ? 'Unlike strategy' : 'Like strategy'}
                    aria-pressed={isLiked}
                    disabled={isLiking}
                    onClick={e => handleLike(e, s.id)}
                    className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                      isLiked
                        ? 'text-pf-danger hover:text-pf-danger/70'
                        : 'hover:text-pf-danger'
                    }`}
                  >
                    <Heart
                      className="size-3.5"
                      aria-hidden="true"
                      fill={isLiked ? 'currentColor' : 'none'}
                    />
                    {likeCount}
                  </button>
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
