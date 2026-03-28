import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trophy,
  Bitcoin,
  Landmark,
  TrendingUp,
  Wallet,
  Cpu,
  LayoutGrid,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface MarketToken {
  id: string;
  outcome: string;
  price: string;
  liquidity: string;
}

interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  seriesSlug: string;
  tokens: MarketToken[];
  volume24h: string;
  endDate: string;
  closed: boolean;
}

interface MarketsResponse {
  data: Market[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

type SortOption = 'volume' | 'newest' | 'closing_soon' | 'liquidity';
type ViewMode = 'cards' | 'table';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Volume', value: 'volume' },
  { label: 'Newest', value: 'newest' },
  { label: 'Closing Soon', value: 'closing_soon' },
  { label: 'Liquidity', value: 'liquidity' },
];

const CATEGORIES = ['all', 'Sports', 'Crypto', 'Politics', 'Economics', 'Finance', 'Technology', 'Other'] as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <LayoutGrid className="size-4" />,
  Sports: <Trophy className="size-4" />,
  Crypto: <Bitcoin className="size-4" />,
  Politics: <Landmark className="size-4" />,
  Economics: <TrendingUp className="size-4" />,
  Finance: <Wallet className="size-4" />,
  Technology: <Cpu className="size-4" />,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Sports: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  Crypto: { bg: 'bg-pf-warning/15', text: 'text-pf-warning' },
  Politics: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  Economics: { bg: 'bg-pf-success/15', text: 'text-pf-success' },
  Finance: { bg: 'bg-pf-cyan-500/15', text: 'text-pf-cyan-400' },
  Technology: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
};

function formatVolume(vol: string): string {
  const v = parseFloat(vol);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function daysUntil(dateStr: string): string {
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return 'Closed';
  if (d === 0) return 'Today';
  if (d === 1) return '1 day';
  if (d < 30) return `${d} days`;
  const months = Math.round(d / 30);
  return `${months}mo`;
}

function isClosingSoon(dateStr: string): boolean {
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  return d >= 0 && d <= 7;
}

function tokenPercent(token: MarketToken): number {
  return Math.round(parseFloat(token.price || '0') * 100);
}

function yesPercent(market: Market): number | null {
  const token = market.tokens.find((t) => t.outcome === 'YES');
  if (!token) return null;
  const val = Math.round(parseFloat(String(token.price)) * 100);
  return isNaN(val) || val === 0 ? null : val;
}

function priceCents(market: Market, outcome: 'YES' | 'NO'): string {
  const token = market.tokens.find((t) => t.outcome === outcome);
  if (!token) return '\u2014';
  const val = parseFloat(String(token.price));
  if (isNaN(val) || val === 0) return '\u2014';
  return Math.round(val * 100) + '\u00A2';
}

// strategyCount removed — synthetic data must not be shown to users.
// TODO: Replace with real strategy count from API when available.

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-pf-md bg-pf-overlay shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-pf-overlay rounded w-[85%]" />
          <div className="h-3 bg-pf-overlay rounded w-[50%]" />
        </div>
      </div>
      <div className="h-1.5 bg-pf-overlay rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-9 bg-pf-overlay rounded-pf" />
        <div className="h-9 bg-pf-overlay rounded-pf" />
      </div>
    </div>
  );
}

/* ─── Market Card ────────────────────────────────────────────────────── */

const MarketCard = memo(function MarketCard({ market, featured }: { market: Market; featured?: boolean }) {
  const catColor = CATEGORY_COLORS[market.category];

  return (
    <Link
      to={`/markets/${market.id}`}
      className={`group block bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5 ${featured ? 'ring-1 ring-pf-cyan-500/20' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-[52px] h-[52px] rounded-pf-md flex items-center justify-center shrink-0 ${catColor?.bg ?? 'bg-pf-overlay'}`}
        >
          <span className={`text-lg font-bold ${catColor?.text ?? 'text-pf-text-muted'}`}>
            {market.title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-pf-text leading-snug line-clamp-2 group-hover:text-pf-cyan-400 transition-colors">
            {market.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-pf-text-secondary">
            <span>{formatVolume(market.volume24h)} Vol</span>
            <span>&middot;</span>
            <span className={isClosingSoon(market.endDate) ? 'text-pf-warning' : ''}>
              {daysUntil(market.endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Binary market */}
      {market.tokens.length <= 2 ? (
        <div className="space-y-2">
          <div>
            <div className="h-1.5 bg-pf-overlay rounded-full overflow-hidden">
              <div
                className="h-full bg-pf-cyan-500 rounded-full transition-all"
                style={{ width: `${yesPercent(market) ?? 50}%` }}
              />
            </div>
            <span className="text-[11px] text-pf-text-muted mt-1 block">
              {yesPercent(market) !== null ? `${yesPercent(market)}% chance` : '\u2014'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="h-9 flex items-center justify-center rounded-pf text-sm font-medium bg-pf-success/10 text-pf-success">
              Yes {priceCents(market, 'YES') !== '\u2014' ? priceCents(market, 'YES') : ''}
            </span>
            <span className="h-9 flex items-center justify-center rounded-pf text-sm font-medium bg-pf-danger/10 text-pf-danger">
              No {priceCents(market, 'NO') !== '\u2014' ? priceCents(market, 'NO') : ''}
            </span>
          </div>
        </div>
      ) : (
        /* Multi-outcome */
        <div className="space-y-1.5">
          {market.tokens.slice(0, 4).map((token) => (
            <div key={token.id} className="flex items-center gap-2 text-xs">
              <span className="w-20 truncate text-pf-text-secondary">{token.outcome}</span>
              <div className="flex-1 h-1.5 bg-pf-overlay rounded-full overflow-hidden">
                <div
                  className="h-full bg-pf-cyan-500/60 rounded-full"
                  style={{ width: `${tokenPercent(token)}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-pf-text-muted">{tokenPercent(token)}%</span>
            </div>
          ))}
          {market.tokens.length > 4 && (
            <span className="text-[11px] text-pf-text-muted">+{market.tokens.length - 4} more</span>
          )}
        </div>
      )}

      {/* Footer */}
      {market.tokens.length > 0 && (
        <div className="flex items-center gap-1 mt-3 text-[11px] text-pf-text-muted">
          <Zap className="size-3" />
          {market.tokens.length} outcomes
        </div>
      )}
    </Link>
  );
});

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('volume');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('pf-markets-view') as ViewMode) || 'cards',
  );

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (p: number, s: string, so: SortOption, cat: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(p));
        params.set('limit', '25');
        if (s) params.set('search', s);
        params.set('sort', so);
        if (cat !== 'all') params.set('category', cat);
        const res = await fetch(`/api/v1/markets?${params}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load');
        const data: MarketsResponse = await res.json();
        setMarkets(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch {
        toast.error('Failed to load markets');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Keep a ref to the latest search value so the debounce callback never captures stale state
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    load(page, search, sort, category);
  }, [page, search, sort, category, load]);

  function onSearchInput(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('pf-markets-view', mode);
  }

  // Category filtering is now done server-side via query param
  const filtered = markets;
  const featured = filtered.slice(0, 3);
  const grid = filtered.slice(3);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Markets</h1>
        {!loading && (
          <span className="text-sm text-pf-text-muted">{total.toLocaleString()} markets</span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" />
        <input
          type="text"
          placeholder="Search markets..."
          aria-label="Search markets"
          defaultValue=""
          onChange={(e) => onSearchInput(e.target.value)}
          className="w-full h-11 pl-11 pr-4 rounded-full bg-pf-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 focus:ring-1 focus:ring-pf-cyan-500/20 transition-colors"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              category === cat
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {CATEGORY_ICONS[cat]}
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          {!loading && total > 0 && (
            <span className="text-sm text-pf-text-muted">
              Showing {(page - 1) * 25 + 1}&ndash;{Math.min(page * 25, total)} of {total.toLocaleString()} markets
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-pf-surface rounded-pf border border-pf-border-subtle">
            <button
              onClick={() => changeViewMode('cards')}
              className={`p-1.5 rounded-pf-sm transition-colors ${viewMode === 'cards' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-muted hover:text-pf-text-secondary'}`}
              aria-label="Card view"
            >
              <Grid3X3 className="size-4" />
            </button>
            <button
              onClick={() => changeViewMode('table')}
              className={`p-1.5 rounded-pf-sm transition-colors ${viewMode === 'table' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-muted hover:text-pf-text-secondary'}`}
              aria-label="Table view"
            >
              <List className="size-4" />
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-pf-text-secondary">Sort by</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
              className="h-8 px-3 rounded-pf bg-pf-elevated border border-pf-border text-xs text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
          </div>
        </>
      )}

      {/* Card view */}
      {!loading && viewMode === 'cards' && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="size-10 text-pf-text-muted mb-4" />
              <p className="text-pf-text font-medium">No markets found</p>
              <p className="text-sm text-pf-text-muted mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
                  {featured.map((m) => <MarketCard key={m.id} market={m} featured />)}
                </div>
              )}
              {/* Grid */}
              {grid.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {grid.map((m) => <MarketCard key={m.id} market={m} />)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Table view */}
      {!loading && viewMode === 'table' && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="size-10 text-pf-text-muted mb-4" />
              <p className="text-pf-text font-medium">No markets found</p>
              <p className="text-sm text-pf-text-muted mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="border border-pf-border rounded-pf-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium text-right">YES</th>
                    <th className="px-4 py-3 font-medium text-right">NO</th>
                    <th className="px-4 py-3 font-medium text-right">Vol 24h</th>
                    <th className="px-4 py-3 font-medium text-right">Closes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pf-border-subtle">
                  {filtered.map((market) => {
                    const catColor = CATEGORY_COLORS[market.category];
                    return (
                      <tr key={market.id} className="group hover:bg-pf-elevated/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/markets/${market.id}`} className="text-pf-text hover:text-pf-cyan-400 transition-colors line-clamp-1">
                            {market.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor?.bg ?? 'bg-pf-overlay'} ${catColor?.text ?? 'text-pf-text-muted'}`}>
                            {CATEGORY_ICONS[market.category]}
                            {market.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-pf-success">
                          {priceCents(market, 'YES')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-pf-danger">
                          {priceCents(market, 'NO')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-pf-text">
                          {formatVolume(market.volume24h)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-xs ${isClosingSoon(market.endDate) ? 'text-pf-warning' : 'text-pf-text-secondary'}`}>
                            {daysUntil(market.endDate)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
