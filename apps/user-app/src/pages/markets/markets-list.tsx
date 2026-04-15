import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Input, Select, CardSkeleton, SkeletonLine, SkeletonCircle } from '@polyforge/ui';
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
  Flame,
  Clock,
  Calendar,
  SlidersHorizontal,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { OnboardingDashboardChecklist } from '../../components/onboarding/onboarding-dashboard-checklist';

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
  strategyCount?: number;
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
type EndDateFilter = 'any' | 'today' | 'week' | 'month';

/* ─── Advanced Search Types ──────────────────────────────────────────── */

interface MarketSearchFilters {
  query: string;
  categories: string[];
  endDateFrom?: string;
  endDateTo?: string;
  minVolume?: number;
  maxVolume?: number;
  minYesPrice?: number;
  maxYesPrice?: number;
  minLiquidity?: number;
  status: 'active' | 'closed' | 'all';
  sortBy: 'volume' | 'liquidity' | 'endDate' | 'newest' | 'yesPrice';
  sortDir: 'asc' | 'desc';
}

const DEFAULT_ADVANCED_FILTERS: MarketSearchFilters = {
  query: '',
  categories: [],
  endDateFrom: undefined,
  endDateTo: undefined,
  minVolume: undefined,
  maxVolume: undefined,
  minYesPrice: undefined,
  maxYesPrice: undefined,
  minLiquidity: undefined,
  status: 'active',
  sortBy: 'volume',
  sortDir: 'desc',
};

const ADVANCED_SORT_OPTIONS: { label: string; value: MarketSearchFilters['sortBy'] }[] = [
  { label: 'Volume', value: 'volume' },
  { label: 'Liquidity', value: 'liquidity' },
  { label: 'End Date', value: 'endDate' },
  { label: 'Newest', value: 'newest' },
  { label: 'YES Price', value: 'yesPrice' },
];

const SEARCH_CATEGORIES = ['Crypto', 'Politics', 'Sports', 'Finance', 'Technology', 'Economics', 'Entertainment', 'Other'];

function countActiveFilters(f: MarketSearchFilters): number {
  let n = 0;
  if (f.categories.length > 0) n += f.categories.length;
  if (f.endDateFrom) n++;
  if (f.endDateTo) n++;
  if (f.minVolume !== undefined) n++;
  if (f.maxVolume !== undefined) n++;
  if (f.minYesPrice !== undefined) n++;
  if (f.maxYesPrice !== undefined) n++;
  if (f.minLiquidity !== undefined) n++;
  if (f.status !== 'active') n++;
  if (f.sortBy !== 'volume' || f.sortDir !== 'desc') n++;
  return n;
}

interface MarketSentiment {
  marketId: string;
  score: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalCount: number;
  lastUpdated: string | null;
}

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
  Sports: { bg: 'bg-info/15', text: 'text-info' },
  Crypto: { bg: 'bg-warning/15', text: 'text-warning' },
  Politics: { bg: 'bg-pf-purple-500/15', text: 'text-pf-purple-400' },
  Economics: { bg: 'bg-gain/15', text: 'text-gain' },
  Finance: { bg: 'bg-accent/15', text: 'text-accent-text' },
  Technology: { bg: 'bg-pf-purple-300/15', text: 'text-pf-purple-300' },
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

// Strategy count not available — Strategy model has no direct marketId FK in current schema.

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function MarketCardSkeleton() {
  return (
    <CardSkeleton>
      <div className="flex items-start gap-3">
        <SkeletonCircle size="w-12 h-12" rounded="rounded-pf-md" />
        <div className="flex-1 space-y-2">
          <SkeletonLine h="h-4" w="w-[85%]" />
          <SkeletonLine w="w-[50%]" />
        </div>
      </div>
      <SkeletonLine h="h-2" className="rounded-pf-full" />
      <div className="grid grid-cols-2 gap-2">
        <SkeletonLine h="h-9" className="rounded-pf" />
        <SkeletonLine h="h-9" className="rounded-pf" />
      </div>
    </CardSkeleton>
  );
}

/* ─── Market Card ────────────────────────────────────────────────────── */

function SentimentPill({ sentiment }: { sentiment: MarketSentiment | undefined }) {
  if (!sentiment || sentiment.signalCount === 0) return null;
  const styles: Record<MarketSentiment['direction'], string> = {
    BULLISH: 'bg-gain/15 text-gain',
    BEARISH: 'bg-loss/15 text-loss',
    NEUTRAL: 'bg-overlay text-tertiary',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-pf-full text-pf-caption font-semibold uppercase tracking-wide ${styles[sentiment.direction]}`}
      title={`Sentiment score: ${sentiment.score}`}
      aria-label={`Market sentiment: ${sentiment.direction}`}
    >
      {sentiment.direction}
    </span>
  );
}

const MarketCard = memo(function MarketCard({
  market,
  featured,
  isWatched,
  isWatchLoading,
  onToggleWatch,
  sentiment,
}: {
  market: Market;
  featured?: boolean;
  isWatched: boolean;
  isWatchLoading: boolean;
  onToggleWatch: (marketId: string, e: React.MouseEvent) => void;
  sentiment?: MarketSentiment;
}) {
  const catColor = CATEGORY_COLORS[market.category];

  return (
    <Link
      to={`/markets/${market.id}`}
      data-testid="market-card"
      className={`group block bg-elevated border border-default rounded-pf-lg p-4 transition-all duration-pf-normal hover:border-strong hover:shadow-pf-sm hover:-translate-y-1 ${featured ? 'ring-1 ring-accent/20' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-[52px] h-[52px] rounded-pf-md flex items-center justify-center shrink-0 ${catColor?.bg ?? 'bg-overlay'}`}
        >
          <span className={`text-lg font-semibold ${catColor?.text ?? 'text-tertiary'}`}>
            {market.title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-primary leading-snug line-clamp-2 group-hover:text-accent-text transition-colors">
            {market.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-secondary">
            <span>{formatVolume(market.volume24h)} Vol</span>
            <span>&middot;</span>
            <span className={isClosingSoon(market.endDate) ? 'text-warning' : ''}>
              {daysUntil(market.endDate)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(e) => onToggleWatch(market.id, e)}
          disabled={isWatchLoading}
          aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          className={`p-2 rounded-pf transition-colors ${isWatched ? 'text-pf-gold-500 hover:text-pf-gold-400' : 'text-tertiary hover:text-primary'}`}
          title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={isWatched ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </Button>
      </div>

      {/* Binary market */}
      {market.tokens.length <= 2 ? (
        <div className="space-y-2">
          <div>
            <div className="h-2 bg-overlay rounded-pf-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-pf-full transition-all"
                style={{ width: `${yesPercent(market) ?? 50}%` }}
              />
            </div>
            <span className="text-pf-label text-tertiary mt-1 block">
              {yesPercent(market) !== null ? `${yesPercent(market)}% chance` : '\u2014'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="h-9 flex items-center justify-center rounded-pf text-sm font-medium bg-gain/10 text-gain">
              Yes {priceCents(market, 'YES') !== '\u2014' ? priceCents(market, 'YES') : ''}
            </span>
            <span className="h-9 flex items-center justify-center rounded-pf text-sm font-medium bg-loss/10 text-loss">
              No {priceCents(market, 'NO') !== '\u2014' ? priceCents(market, 'NO') : ''}
            </span>
          </div>
        </div>
      ) : (
        /* Multi-outcome */
        <div className="space-y-2">
          {market.tokens.slice(0, 4).map((token) => (
            <div key={token.id} className="flex items-center gap-2 text-xs">
              <span className="w-20 truncate text-secondary">{token.outcome}</span>
              <div className="flex-1 h-2 bg-overlay rounded-pf-full overflow-hidden">
                <div
                  className="h-full bg-accent/60 rounded-pf-full"
                  style={{ width: `${tokenPercent(token)}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-tertiary">{tokenPercent(token)}%</span>
            </div>
          ))}
          {market.tokens.length > 4 && (
            <span className="text-pf-label text-tertiary">+{market.tokens.length - 4} more</span>
          )}
        </div>
      )}

      {/* Footer */}
      {market.tokens.length > 0 && (
        <div className="flex items-center justify-between gap-1 mt-3">
          <div className="flex items-center gap-2 text-pf-label text-tertiary">
            <span className="flex items-center gap-1">
              <Zap className="size-3" aria-hidden="true" />
              {market.tokens.length} outcomes
            </span>
            {(market.strategyCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-accent-text">
                <Cpu className="size-3" aria-hidden="true" />
                {market.strategyCount} {market.strategyCount === 1 ? 'strategy' : 'strategies'}
              </span>
            )}
          </div>
          <SentimentPill sentiment={sentiment} />
        </div>
      )}
    </Link>
  );
});

/* ─── Trending Card ──────────────────────────────────────────────────── */

function TrendingCardSkeleton() {
  return (
    <CardSkeleton>
      <SkeletonLine h="h-4" w="w-[90%]" />
      <SkeletonLine w="w-[55%]" />
      <SkeletonLine h="h-8" w="w-[40%]" />
      <div className="flex items-center justify-between">
        <SkeletonLine h="h-5" w="w-[30%]" />
        <SkeletonLine h="h-5" w="w-[25%]" />
      </div>
    </CardSkeleton>
  );
}

function TrendingCard({ market }: { market: Market }) {
  const catColor = CATEGORY_COLORS[market.category];
  const yesP = yesPercent(market);
  const closing = daysUntil(market.endDate);
  const closingSoon = isClosingSoon(market.endDate);

  return (
    <Link
      to={`/markets/${market.slug || market.id}`}
      className="group block bg-elevated border border-default rounded-pf-lg p-4 space-y-3 transition-all duration-pf-normal hover:border-accent/30 hover:shadow-pf-sm hover:-translate-y-1"
    >
      {/* Question */}
      <p className="text-sm font-medium text-primary leading-snug line-clamp-2 group-hover:text-accent-text transition-colors">
        {market.title}
      </p>

      {/* Category badge */}
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-pf-label font-medium ${catColor?.bg ?? 'bg-overlay'} ${catColor?.text ?? 'text-tertiary'}`}
      >
        {market.category}
      </span>

      {/* YES price */}
      {yesP !== null && (
        <div className="text-2xl font-semibold text-accent-text">{yesP}¢</div>
      )}

      {/* Footer badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-xs bg-warning/10 text-warning">
          <TrendingUp className="size-3" aria-hidden="true" />
          {formatVolume(market.volume24h)} vol
        </span>
        <span className={`inline-flex items-center gap-1 text-xs font-mono ${closingSoon ? 'text-loss' : 'text-secondary'}`}>
          <Clock className="size-3" aria-hidden="true" />
          {closing}
        </span>
      </div>
    </Link>
  );
}

/* ─── Advanced Search Modal ──────────────────────────────────────────── */

function AdvancedSearchModal({
  open,
  onClose,
  onFiltersChange,
}: {
  open: boolean;
  onClose: () => void;
  onFiltersChange?: (filters: MarketSearchFilters) => void;
}) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MarketSearchFilters>(DEFAULT_ADVANCED_FILTERS);
  const [results, setResults] = useState<Market[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const [searchOffset, setSearchOffset] = useState(0);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  // Auto-focus query input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => queryInputRef.current?.focus(), 50);
    } else {
      setFilters(DEFAULT_ADVANCED_FILTERS);
      setResults([]);
      setSearchTotal(null);
      setSearchOffset(0);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function runSearch(offset = 0) {
    setSearchLoading(true);
    try {
      const res = await fetch('/api/v1/markets/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, offset, limit: LIMIT }),
      });
      if (!res.ok) throw new Error('Search failed');
      const json: { data: Market[]; total: number } = await res.json();
      if (offset === 0) {
        setResults(json.data);
      } else {
        setResults((prev) => [...prev, ...json.data]);
      }
      setSearchTotal(json.total);
      setSearchOffset(offset);
    } catch {
      toast.error('Advanced search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  }

  function handleLoadMore() {
    runSearch(searchOffset + LIMIT);
  }

  function handleReset() {
    const reset = DEFAULT_ADVANCED_FILTERS;
    setFilters(reset);
    setResults([]);
    setSearchTotal(null);
    setSearchOffset(0);
    onFiltersChange?.(reset);
  }

  function updateFilters(updater: (prev: MarketSearchFilters) => MarketSearchFilters) {
    setFilters((prev) => {
      const next = updater(prev);
      onFiltersChange?.(next);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    updateFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  function handleResultClick(market: Market) {
    onClose();
    navigate(`/markets/${market.id}`);
  }

  if (!open) return null;

  const activeFilterCount = countActiveFilters(filters);
  const canLoadMore = searchTotal !== null && results.length < searchTotal;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Advanced Market Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-6 bg-surface/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl bg-elevated border border-default rounded-pf-lg shadow-pf-lg flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-default shrink-0">
          <Search className="size-5 text-accent-text shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold text-primary flex-1">Advanced Market Search</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close advanced search"
            className="p-2 rounded-pf text-tertiary hover:text-primary hover:bg-overlay transition-colors"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable filter + results body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Query */}
          <Input
            ref={queryInputRef}
            type="text"
            placeholder="Search by keyword, topic, or question..."
            aria-label="Search query"
            value={filters.query}
            onChange={(e) => updateFilters((prev) => ({ ...prev, query: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(0); }}
            className="w-full h-11 px-4 rounded-pf bg-surface border border-default text-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
          />

          {/* Categories */}
          <div>
            <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => updateFilters((prev) => ({ ...prev, categories: [] }))}
                className={`px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors ${
                  filters.categories.length === 0
                    ? 'bg-accent/15 text-accent-text border-accent/30'
                    : 'bg-surface text-secondary border-default hover:border-strong'
                }`}
              >
                All
              </Button>
              {SEARCH_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors ${
                    filters.categories.includes(cat)
                      ? 'bg-accent/15 text-accent-text border-accent/30'
                      : 'bg-surface text-secondary border-default hover:border-strong'
                  }`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* End Date + YES Price Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* End date */}
            <div className="bg-surface border border-default rounded-pf p-3 space-y-2">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide">End Date</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label htmlFor="end-date-from" className="block text-pf-caption text-tertiary mb-1">From</label>
                  <input
                    id="end-date-from"
                    type="date"
                    value={filters.endDateFrom ?? ''}
                    onChange={(e) => updateFilters((prev) => ({ ...prev, endDateFrom: e.target.value || undefined }))}
                    className="w-full h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="end-date-to" className="block text-pf-caption text-tertiary mb-1">To</label>
                  <input
                    id="end-date-to"
                    type="date"
                    value={filters.endDateTo ?? ''}
                    onChange={(e) => updateFilters((prev) => ({ ...prev, endDateTo: e.target.value || undefined }))}
                    className="w-full h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* YES price range */}
            <div className="bg-surface border border-default rounded-pf p-3 space-y-2">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide">YES Price Range</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-pf-caption text-tertiary mb-1">Min</label>
                  <Input
                    type="number"
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    placeholder="0.01"
                    value={filters.minYesPrice ?? ''}
                    onChange={(e) => updateFilters((prev) => ({ ...prev, minYesPrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                  />
                </div>
                <span className="text-tertiary text-xs mt-4">—</span>
                <div className="flex-1">
                  <label className="block text-pf-caption text-tertiary mb-1">Max</label>
                  <Input
                    type="number"
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    placeholder="0.99"
                    value={filters.maxYesPrice ?? ''}
                    onChange={(e) => updateFilters((prev) => ({ ...prev, maxYesPrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                  />
                </div>
              </div>
              {(filters.minYesPrice !== undefined || filters.maxYesPrice !== undefined) && (
                <p className="text-pf-label text-accent-text font-mono">
                  {filters.minYesPrice ?? '0.01'} — {filters.maxYesPrice ?? '0.99'}
                </p>
              )}
            </div>
          </div>

          {/* Volume + Liquidity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface border border-default rounded-pf p-3 space-y-2">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide">Volume (USDC)</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={filters.minVolume ?? ''}
                  onChange={(e) => updateFilters((prev) => ({ ...prev, minVolume: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="flex-1 h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                />
                <span className="text-tertiary text-xs">—</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={filters.maxVolume ?? ''}
                  onChange={(e) => updateFilters((prev) => ({ ...prev, maxVolume: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="flex-1 h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                />
              </div>
            </div>

            <div className="bg-surface border border-default rounded-pf p-3 space-y-2">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide">Min Liquidity (USDC)</p>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 10000"
                value={filters.minLiquidity ?? ''}
                onChange={(e) => updateFilters((prev) => ({ ...prev, minLiquidity: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-full h-8 px-2 rounded-pf bg-elevated border border-default text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
              />
            </div>
          </div>

          {/* Status + Sort */}
          <div className="flex flex-wrap items-start gap-6">
            {/* Status */}
            <div>
              <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">Status</p>
              <div className="flex items-center gap-2">
                {(['active', 'closed', 'all'] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="ghost"
                    onClick={() => updateFilters((prev) => ({ ...prev, status: s }))}
                    className={`px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors capitalize ${
                      filters.status === s
                        ? s === 'active'
                          ? 'bg-gain/15 text-gain border-gain/30'
                          : s === 'closed'
                          ? 'bg-loss/15 text-loss border-loss/30'
                          : 'bg-accent/15 text-accent-text border-accent/30'
                        : 'bg-surface text-secondary border-default hover:border-strong'
                    }`}
                  >
                    {s === 'active' && filters.status === 'active' ? 'Active' : s.charAt(0).toUpperCase() + s.slice(1)}
                    {s === 'active' && filters.status === 'active' && (
                      <span className="ml-1 inline-block w-2 h-2 rounded-pf-full bg-gain align-middle" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="flex-1 min-w-[220px]">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">Sort By</p>
              <div className="flex flex-wrap gap-2">
                {ADVANCED_SORT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      updateFilters((prev) => ({
                        ...prev,
                        sortBy: opt.value,
                        sortDir: prev.sortBy === opt.value && prev.sortDir === 'desc' ? 'asc' : 'desc',
                      }));
                    }}
                    className={`flex items-center gap-1 px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors ${
                      filters.sortBy === opt.value
                        ? 'bg-accent/15 text-accent-text border-accent/30'
                        : 'bg-surface text-secondary border-default hover:border-strong'
                    }`}
                  >
                    {opt.label}
                    {filters.sortBy === opt.value && (
                      <ArrowUpDown className="size-3" aria-hidden="true" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
              className="px-4 py-2 rounded-pf text-sm text-secondary hover:text-primary hover:bg-overlay border border-default hover:border-strong transition-colors"
            >
              Reset Filters
            </Button>
            <Button
              type="button"
              onClick={() => runSearch(0)}
              disabled={searchLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-pf bg-accent hover:bg-accent-text text-app text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {searchLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-app/30 border-t-pf-bg rounded-pf-full animate-spin" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}
              Search Markets
            </Button>
          </div>

          {/* Results */}
          {searchTotal !== null && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b border-subtle">
                <p className="text-sm font-medium text-primary">
                  Results{' '}
                  <span className="text-tertiary font-normal">({searchTotal.toLocaleString()} markets)</span>
                </p>
              </div>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Search className="size-8 text-tertiary mb-3" aria-hidden="true" />
                  <p className="text-sm text-primary font-medium">No markets found</p>
                  <p className="text-xs text-tertiary mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-subtle border border-default rounded-pf overflow-hidden">
                  {results.map((market) => {
                    const catColor = CATEGORY_COLORS[market.category];
                    const yesP = yesPercent(market);
                    return (
                      <Button
                        key={market.id}
                        type="button"
                        variant="ghost"
                        onClick={() => handleResultClick(market)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-elevated transition-colors text-left group"
                      >
                        <div className={`w-8 h-8 rounded-pf-sm flex items-center justify-center shrink-0 ${catColor?.bg ?? 'bg-overlay'}`}>
                          <span className={`text-xs font-semibold ${catColor?.text ?? 'text-tertiary'}`}>
                            {market.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-primary group-hover:text-accent-text transition-colors line-clamp-1 font-medium">
                            {market.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-pf-caption px-2 py-1 rounded-pf-full ${catColor?.bg ?? 'bg-overlay'} ${catColor?.text ?? 'text-tertiary'}`}>
                              {market.category}
                            </span>
                            <span className="text-pf-caption text-tertiary">{formatVolume(market.volume24h)} vol</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {yesP !== null ? (
                            <span className="text-sm font-mono font-semibold text-accent-text">{yesP}¢</span>
                          ) : (
                            <span className="text-sm text-tertiary">—</span>
                          )}
                          <p className="text-pf-caption text-tertiary mt-1">{daysUntil(market.endDate)}</p>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}

              {canLoadMore && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleLoadMore}
                  disabled={searchLoading}
                  className="w-full py-2 text-sm text-secondary hover:text-primary border border-default hover:border-strong rounded-pf transition-colors disabled:opacity-60"
                >
                  {searchLoading ? 'Loading...' : `Load more (${searchTotal - results.length} remaining)`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [watchlistLoading, setWatchlistLoading] = useState<Set<string>>(new Set());
  const [sentimentMap, setSentimentMap] = useState<Map<string, MarketSentiment>>(new Map());
  const [endDateFilter, setEndDateFilter] = useState<EndDateFilter>('any');
  const [trendingMarkets, setTrendingMarkets] = useState<Market[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<MarketSearchFilters>(DEFAULT_ADVANCED_FILTERS);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (p: number, s: string, so: SortOption, cat: string, edf: EndDateFilter) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(p));
        params.set('limit', '25');
        if (s) params.set('search', s);
        params.set('sort', so);
        if (cat !== 'all') params.set('category', cat);
        if (edf === 'today') params.set('endsBefore', new Date(Date.now() + 86400000).toISOString());
        else if (edf === 'week') params.set('endsBefore', new Date(Date.now() + 7 * 86400000).toISOString());
        else if (edf === 'month') params.set('endsBefore', new Date(Date.now() + 30 * 86400000).toISOString());
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
    load(page, search, sort, category, endDateFilter);
  }, [page, search, sort, category, endDateFilter, load]);

  // Fetch trending markets once on mount — separate from main paginated fetch
  useEffect(() => {
    setTrendingLoading(true);
    fetch('/api/v1/markets?sort=volume&limit=3', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MarketsResponse | null) => {
        if (data?.data) setTrendingMarkets(data.data);
      })
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/v1/watchlist', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ id: string }>) => {
        setWatchedIds(new Set(items.map((m: any) => m.id)));
      })
      .catch(() => {});
  }, []);

  // Batch-fetch sentiment for visible markets (first 20) after markets load
  useEffect(() => {
    if (markets.length === 0) return;
    const ids = markets.slice(0, 20).map((m) => m.id);
    Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/v1/news/sentiment/${id}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
      ),
    ).then((results) => {
      const next = new Map<string, MarketSentiment>();
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          const s = r.value as MarketSentiment;
          next.set(s.marketId, s);
        }
      });
      setSentimentMap(next);
    });
  }, [markets]);

  // Ctrl+F / Cmd+F opens advanced search (page-scoped)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowAdvancedSearch(true);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const toggleWatch = async (marketId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (watchlistLoading.has(marketId)) return;
    setWatchlistLoading(prev => new Set([...prev, marketId]));
    try {
      const isWatched = watchedIds.has(marketId);
      if (isWatched) {
        await fetch(`/api/v1/watchlist/${marketId}`, { method: 'DELETE', credentials: 'include' });
        setWatchedIds(prev => { const next = new Set(prev); next.delete(marketId); return next; });
      } else {
        await fetch('/api/v1/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ marketId }),
        });
        setWatchedIds(prev => new Set([...prev, marketId]));
      }
    } catch {} finally {
      setWatchlistLoading(prev => { const next = new Set(prev); next.delete(marketId); return next; });
    }
  };

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
      {/* Onboarding checklist — shown to new users until dismissed or complete */}
      <OnboardingDashboardChecklist />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Markets</h1>
        {!loading && (
          <span className="text-sm text-tertiary">{total.toLocaleString()} markets</span>
        )}
      </div>

      {/* Trending Now */}
      {(trendingLoading || trendingMarkets.length > 0) && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-warning" aria-hidden="true" />
              <h2 className="text-base font-semibold text-primary">Trending Now</h2>
            </div>
            <p className="text-xs text-tertiary mt-1">Highest volume in the last 24h</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {trendingLoading
              ? [1, 2, 3].map((i) => <TrendingCardSkeleton key={i} />)
              : trendingMarkets.map((m) => <TrendingCard key={m.id} market={m} />)}
          </div>
        </div>
      )}

      <hr className="border-subtle" />

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-tertiary" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Search markets..."
            aria-label="Search markets"
            defaultValue=""
            onChange={(e) => onSearchInput(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-pf-full bg-elevated border border-default text-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
          />
        </div>
        {/* Advanced search button */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowAdvancedSearch(true)}
          aria-label="Open advanced search"
          title="Advanced Search (Ctrl+F)"
          className={`relative flex items-center gap-2 h-11 px-4 rounded-pf-full border text-sm font-medium transition-colors shrink-0 ${
            countActiveFilters(advancedFilters) > 0
              ? 'bg-accent/15 text-accent-text border-accent/30 hover:bg-accent/20'
              : 'bg-elevated text-secondary border-default hover:border-strong hover:text-primary'
          }`}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span>Advanced</span>
          {countActiveFilters(advancedFilters) > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-pf-full bg-accent text-app text-pf-caption font-semibold -mr-1">
              {countActiveFilters(advancedFilters)}
            </span>
          )}
        </Button>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <Button
            type="button"
            variant="ghost"
            key={cat}
            onClick={() => { setCategory(cat); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-pf-full text-xs font-medium whitespace-nowrap border transition-colors ${
              category === cat
                ? 'bg-accent/15 text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
            }`}
          >
            {CATEGORY_ICONS[cat]}
            {cat === 'all' ? 'All' : cat}
          </Button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          {!loading && total > 0 && (
            <span className="text-sm text-tertiary">
              Showing {(page - 1) * 25 + 1}&ndash;{Math.min(page * 25, total)} of {total.toLocaleString()} markets
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-surface rounded-pf border border-subtle">
            <Button
              type="button"
              variant="ghost"
              onClick={() => changeViewMode('cards')}
              className={`p-2 rounded-pf-sm transition-colors ${viewMode === 'cards' ? 'bg-elevated text-primary' : 'text-tertiary hover:text-secondary'}`}
              aria-label="Card view"
            >
              <Grid3X3 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => changeViewMode('table')}
              className={`p-2 rounded-pf-sm transition-colors ${viewMode === 'table' ? 'bg-elevated text-primary' : 'text-tertiary hover:text-secondary'}`}
              aria-label="Table view"
            >
              <List className="size-4" />
            </Button>
          </div>

          {/* End date filter */}
          <div className="flex items-center gap-2">
            {(
              [
                { value: 'today', label: 'Ending Today', Icon: Clock },
                { value: 'week', label: 'This Week', Icon: Calendar },
                { value: 'month', label: 'This Month', Icon: Calendar },
              ] as { value: EndDateFilter; label: string; Icon: typeof Clock }[]
            ).map(({ value, label, Icon }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                onClick={() => {
                  setEndDateFilter(endDateFilter === value ? 'any' : value);
                  setPage(1);
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-pf-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  endDateFilter === value
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-elevated text-secondary border-default hover:border-strong'
                }`}
              >
                <Icon className="size-3" aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-xs text-secondary">Sort by</label>
            <Select
              id="sort-select"
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
              className="h-8 px-3 rounded-pf bg-elevated border border-default text-xs text-primary focus-visible:outline-none focus-visible:border-accent/50"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <MarketCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => <MarketCardSkeleton key={i} />)}
          </div>
        </>
      )}

      {/* Card view */}
      {!loading && viewMode === 'cards' && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
              <Search className="size-10 text-tertiary mb-4" aria-hidden="true" />
              <p className="text-primary font-medium">No markets found</p>
              <p className="text-sm text-tertiary mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
                  {featured.map((m) => <MarketCard key={m.id} market={m} featured isWatched={watchedIds.has(m.id)} isWatchLoading={watchlistLoading.has(m.id)} onToggleWatch={toggleWatch} sentiment={sentimentMap.get(m.id)} />)}
                </div>
              )}
              {/* Grid */}
              {grid.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {grid.map((m) => <MarketCard key={m.id} market={m} isWatched={watchedIds.has(m.id)} isWatchLoading={watchlistLoading.has(m.id)} onToggleWatch={toggleWatch} sentiment={sentimentMap.get(m.id)} />)}
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
            <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
              <Search className="size-10 text-tertiary mb-4" aria-hidden="true" />
              <p className="text-primary font-medium">No markets found</p>
              <p className="text-sm text-tertiary mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="border border-default rounded-pf-lg overflow-hidden">
              <table className="w-full text-sm" aria-label="Markets">
                <thead>
                  <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wider">
                    <th scope="col" className="px-4 py-3 font-medium">Market</th>
                    <th scope="col" className="px-4 py-3 font-medium">Category</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">YES</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">NO</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Vol 24h</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Closes</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filtered.map((market) => {
                    const catColor = CATEGORY_COLORS[market.category];
                    return (
                      <tr key={market.id} className="group hover:bg-elevated/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/markets/${market.id}`} className="text-primary hover:text-accent-text transition-colors line-clamp-1">
                            {market.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-pf-full text-pf-label font-medium ${catColor?.bg ?? 'bg-overlay'} ${catColor?.text ?? 'text-tertiary'}`}>
                            {CATEGORY_ICONS[market.category]}
                            {market.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gain">
                          {priceCents(market, 'YES')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-loss">
                          {priceCents(market, 'NO')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-primary">
                          {formatVolume(market.volume24h)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-xs ${isClosingSoon(market.endDate) ? 'text-warning' : 'text-secondary'}`}>
                            {daysUntil(market.endDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => toggleWatch(market.id, e)}
                            disabled={watchlistLoading.has(market.id)}
                            aria-label={watchedIds.has(market.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                            className={`p-2 rounded-pf transition-colors ${watchedIds.has(market.id) ? 'text-pf-gold-500 hover:text-pf-gold-400' : 'text-tertiary hover:text-primary'}`}
                            title={watchedIds.has(market.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={watchedIds.has(market.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          </Button>
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-mono text-secondary" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        open={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onFiltersChange={setAdvancedFilters}
      />
    </div>
  );
}
