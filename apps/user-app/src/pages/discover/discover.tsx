import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Compass, Heart, GitFork, TrendingUp, Tag, Star, Award, Library,
} from 'lucide-react';
import { Button, Input, CardSkeleton, SkeletonLine, SkeletonBadge } from '@polyforge/ui';

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

function DiscoverSkeleton() {
  return (
    <CardSkeleton>
      <SkeletonLine h="h-4" w="w-[60%]" />
      <SkeletonLine w="w-[90%]" />
      <SkeletonLine w="w-[75%]" />
      <div className="flex gap-2">
        <SkeletonBadge w="w-12" />
        <SkeletonBadge w="w-12" />
      </div>
    </CardSkeleton>
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
        <h1 className="text-2xl font-semibold text-primary">Discover</h1>
        {!loading && <span className="text-sm text-tertiary">{total} strategies</span>}
      </div>

      {/* Featured Strategies */}
      {featuredListings.length > 0 && (
        <section aria-label="Featured Strategies">
          <div className="flex items-center gap-2 mb-3">
            <Star className="size-4 text-warning fill-warning" aria-hidden="true" />
            <span className="text-base font-semibold text-primary">Featured</span>
            <Award className="size-4 text-warning ml-1" aria-hidden="true" />
            <span className="text-xs text-tertiary ml-1">Hand-picked by the PolyForge team</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredListings.map(f => (
              <Link
                key={f.id}
                to={`/marketplace/${f.id}`}
                className="group block bg-elevated border border-warning/40 rounded-pf-lg p-4 transition-all duration-pf-normal hover:border-warning/60 hover:shadow-pf-sm hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {/* FEATURED badge + seller */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-warning/15 text-warning text-pf-caption font-bold px-2 py-1 rounded">
                    FEATURED
                  </span>
                  <span className="text-xs text-secondary ml-auto truncate">
                    {f.seller.displayName ?? f.seller.username}
                  </span>
                </div>

                {/* Title */}
                <div className="text-sm font-semibold text-primary group-hover:text-warning transition-colors mb-1 truncate">
                  {f.title}
                </div>

                {/* Description */}
                {f.description && (
                  <div className="text-xs text-tertiary line-clamp-2 mb-3">{f.description}</div>
                )}

                {/* Stats row */}
                <div className="flex flex-wrap gap-2 text-pf-label text-secondary mb-3">
                  {f.winRate != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3" aria-hidden="true" />
                      {f.winRate}% win rate
                    </span>
                  )}
                  {f.tradeCount != null && (
                    <span>{f.tradeCount} trades</span>
                  )}
                  <span className="ml-auto font-semibold text-primary">
                    {Number(f.priceUsdc) === 0 ? 'Free' : `$${Number(f.priceUsdc).toFixed(2)}`}
                  </span>
                </div>

                {/* Separator */}
                <div className="border-t border-subtle my-2" />

                {/* Footer: forks / likes + CTA */}
                <div className="flex items-center gap-3 text-xs text-tertiary">
                  <span className="flex items-center gap-1"><GitFork className="size-3" aria-hidden="true" /> {f.forkCount}</span>
                  <span className="flex items-center gap-1"><Heart className="size-3" aria-hidden="true" /> {f.likeCount}</span>
                  <span className="ml-auto border border-accent/40 text-accent-text text-pf-caption font-medium px-2 py-1 rounded hover:bg-accent/10 transition-colors">
                    View Strategy
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {/* Separator before main grid */}
          <div className="border-t border-default mt-6" />
        </section>
      )}

      {/* Collections strip */}
      {collections.length > 0 && (
        <section aria-label="Strategy Collections">
          <div className="flex items-center gap-2 mb-3">
            <Library className="size-4 text-accent-text" aria-hidden="true" />
            <span className="text-base font-semibold text-primary">Collections</span>
            <Link
              to="/collections"
              className="ml-auto text-xs text-accent-text hover:text-accent-text transition-colors flex items-center gap-1"
            >
              View all <ChevronRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {collections.map(col => (
              <Button
                key={col.id}
                type="button"
                variant="ghost"
                onClick={() => navigate(`/collections/${col.id}`)}
                className="bg-elevated border border-default rounded-pf-full px-3 py-2 text-sm flex items-center gap-2 whitespace-nowrap hover:border-strong cursor-pointer transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span role="img" aria-label={col.title}>{col.emoji}</span>
                <span className="text-primary font-medium">{col.title}</span>
                <span className="text-tertiary text-xs">{col.listingCount} strategies</span>
              </Button>
            ))}
          </div>
        </section>
      )}

      {/* Search + Tag filter bar */}
      <div className="flex gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <Input
            type="text"
            placeholder="Search strategies..."
            aria-label="Search strategies"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-3 rounded-pf-sm text-sm bg-elevated text-primary border border-default hover:border-strong focus-visible:border-accent/50 focus-visible:outline-none transition-colors placeholder:text-tertiary"
          />
        </div>
        {/* Tag filter */}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-tertiary" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Filter by tag..."
            aria-label="Filter by tag"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="pl-8 pr-3 py-3 rounded-pf-sm text-sm bg-elevated text-primary border border-default hover:border-strong focus-visible:border-accent/50 focus-visible:outline-none transition-colors placeholder:text-tertiary w-36"
          />
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {SORT_OPTIONS.map(opt => (
          <Button
            type="button"
            variant="ghost"
            key={opt.value}
            role="tab"
            aria-selected={sort === opt.value}
            onClick={() => changeSort(opt.value)}
            className={`px-3 py-2 rounded-pf-full text-xs font-medium whitespace-nowrap border transition-colors ${
              sort === opt.value
                ? 'bg-accent/15 text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
            }`}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <Button
            type="button"
            variant="ghost"
            key={cat.value ?? 'all'}
            onClick={() => changeCategory(cat.value)}
            className={`px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors whitespace-nowrap ${
              category === cat.value
                ? 'bg-accent/15 text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
            }`}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {loading && strategies.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }, (_, i) => <DiscoverSkeleton key={i} />)}
        </div>
      ) : strategies.length === 0 ? (
        <div data-testid="empty-state" className="flex flex-col items-center justify-center py-20 text-center" role="status">
          <Compass className="size-10 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">No strategies found</p>
          <p className="text-sm text-tertiary mt-1">Be the first to publish a public strategy.</p>
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
                data-testid="strategy-card"
                to={`/strategies/${s.id}`}
                className="group block bg-elevated border border-default rounded-pf-lg p-4 transition-all duration-pf-normal hover:border-strong hover:shadow-pf-sm hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {/* Author row */}
                <div className="flex items-center gap-2 mb-3">
                  {s.author.avatarUrl ? (
                    <img src={s.author.avatarUrl} alt={`${s.author.displayName ?? s.author.username} avatar`} className="size-7 rounded-pf-full object-cover" width={28} height={28} loading="lazy" />
                  ) : (
                    <div className="size-7 rounded-pf-full bg-accent/15 border border-accent/25 flex items-center justify-center text-pf-caption font-bold text-accent-text">
                      {authorInitials(s)}
                    </div>
                  )}
                  <a
                    data-testid="strategy-author"
                    href={`/profile/${s.author.username}`}
                    onClick={e => { e.stopPropagation(); }}
                    className="text-xs text-secondary hover:text-accent-text transition-colors"
                  >
                    {s.author.displayName ?? s.author.username}
                  </a>
                  {s.author.score != null && s.author.score > 0 && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-pf-caption font-mono font-bold border ${
                      s.author.score >= 70 ? 'text-gain bg-gain/10 border-gain/20' :
                      s.author.score >= 40 ? 'text-warning bg-warning/10 border-warning/20' :
                      'text-loss bg-loss/10 border-loss/20'
                    }`}>
                      <TrendingUp className="size-3" />
                      {s.author.score}
                    </span>
                  )}
                  <span data-testid="strategy-status" className="ml-auto text-pf-caption px-2 py-1 rounded bg-overlay text-tertiary">
                    {execLabel(s.execMode)}
                  </span>
                </div>

                {/* Name + description */}
                <div data-testid="strategy-name" className="text-sm font-medium text-primary group-hover:text-accent-text transition-colors mb-1">
                  {s.name}
                </div>
                {s.description && (
                  <div data-testid="strategy-description" className="text-xs text-tertiary line-clamp-2 mb-3">{s.description}</div>
                )}

                {/* Tags */}
                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.tags.slice(0, 4).map(tag => (
                      <span key={tag} className={`px-2 py-1 rounded-pf-full text-pf-caption font-medium ${
                        tag === 'momentum' ? 'bg-warning/15 text-warning' :
                        tag === 'political' ? 'bg-info/15 text-info' :
                        tag === 'yes-bias' ? 'bg-gain/15 text-gain' :
                        tag === 'defensive' ? 'bg-pf-purple-500/15 text-pf-purple-400' :
                        tag === 'scalping' ? 'bg-loss/15 text-loss' :
                        tag === 'high-freq' ? 'bg-pf-purple-300/15 text-pf-purple-300' :
                        'bg-overlay text-tertiary'
                      }`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-subtle my-2" />

                {/* Footer stats */}
                <div className="flex items-center gap-3 text-sm text-tertiary pt-1">
                  {/* Like button */}
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid="strategy-pnl"
                    aria-label={isLiked ? 'Unlike strategy' : 'Like strategy'}
                    aria-pressed={isLiked}
                    disabled={isLiking}
                    onClick={e => handleLike(e, s.id)}
                    className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                      isLiked
                        ? 'text-loss hover:text-loss/70'
                        : 'hover:text-loss'
                    }`}
                  >
                    <Heart
                      className="size-4"
                      aria-hidden="true"
                      fill={isLiked ? 'currentColor' : 'none'}
                    />
                    {likeCount}
                  </Button>
                  <span data-testid="strategy-forks" className="flex items-center gap-1"><GitFork className="size-4" aria-hidden="true" /> {s.forkCount}</span>
                  <span className="ml-auto text-pf-label text-tertiary">&bull;</span>
                  <span className="font-mono text-pf-label">{formatDate(s.createdAt)}</span>
                </div>
              </Link>
            );
          })}
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
          <span data-testid="page-indicator" className="text-sm font-mono text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
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
