import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Newspaper, ChevronDown, ChevronUp,
  ExternalLink, ArrowUpRight, ArrowDownRight, X, Search,
} from 'lucide-react';
import { Button, Input, Select } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
type SentimentFilter = 'ALL' | Sentiment;

interface MarketSearchResult {
  id: string;
  slug: string;
  question: string;
}

interface NewsSignal {
  id: string;
  marketId: string;
  marketName: string;
  direction: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  confidence: number;
  reasoning: string;
}

interface NewsArticle {
  id: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  sentiment: Sentiment;
  publishedAt: string;
  signals: NewsSignal[];
}

interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NewsFeedResponse {
  data: NewsArticle[];
  meta: PaginatedMeta;
}

interface TopSignal {
  id: string;
  articleId: string;
  marketId: string;
  marketName: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  reasoning: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const SOURCES = ['All', 'Reuters', 'CNN', 'CoinGecko', 'Bloomberg', 'AP News'];

const SENTIMENT_TABS: { label: string; value: SentimentFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Positive', value: 'POSITIVE' },
  { label: 'Negative', value: 'NEGATIVE' },
  { label: 'Neutral', value: 'NEUTRAL' },
];

function sourceColor(source: string): string {
  const map: Record<string, string> = {
    Reuters: 'bg-info-subtle text-info border-info/30',
    CNN: 'bg-loss-subtle text-loss border-loss/30',
    CoinGecko: 'bg-warning-subtle text-warning border-warning/30',
    Bloomberg: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
    'AP News': 'bg-accent-subtle text-accent border-accent/30',
  };
  return map[source] ?? 'bg-overlay text-tertiary border-default';
}

function sentimentColor(s: Sentiment): string {
  if (s === 'POSITIVE') return 'bg-gain-subtle text-gain';
  if (s === 'NEGATIVE') return 'bg-loss-subtle text-loss';
  return 'bg-overlay text-tertiary';
}

function confidenceColor(c: number): string {
  if (c > 70) return 'bg-gain';
  if (c >= 40) return 'bg-warning';
  return 'bg-loss';
}

function confidenceBarBg(c: number): string {
  if (c > 70) return 'bg-gain-subtle';
  if (c >= 40) return 'bg-warning-subtle';
  return 'bg-loss-subtle';
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

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function ArticleSkeleton() {
  return (
    <div className="bg-elevated border border-default rounded-xl p-4 space-y-3 animate-shimmer">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 bg-overlay rounded-full" />
        <div className="h-5 w-16 bg-overlay rounded-full" />
        <div className="ml-auto h-3 w-16 bg-overlay rounded" />
      </div>
      <div className="h-4 bg-overlay rounded w-[85%]" />
      <div className="h-3 bg-overlay rounded w-[70%]" />
      <div className="h-3 bg-overlay rounded w-[50%]" />
    </div>
  );
}

function SignalSkeleton() {
  return (
    <div className="bg-elevated border border-default rounded-xl p-3 space-y-2 animate-shimmer">
      <div className="h-4 bg-overlay rounded w-[60%]" />
      <div className="h-3 bg-overlay rounded w-[40%]" />
      <div className="h-2 bg-overlay rounded w-full" />
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [searchParams] = useSearchParams();
  const marketFilter = searchParams.get('market') || '';

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);

  const [source, setSource] = useState('All');
  const [sentiment, setSentiment] = useState<SentimentFilter>('ALL');
  const [minConfidence, setMinConfidence] = useState(0);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [marketSearch, setMarketSearch] = useState('');
  const [marketId, setMarketId] = useState<string | null>(null);
  const [marketSearchResults, setMarketSearchResults] = useState<MarketSearchResult[]>([]);
  const [selectedMarketName, setSelectedMarketName] = useState('');
  const marketDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [topSignals, setTopSignals] = useState<TopSignal[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(true);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Load articles ─── */
  const loadArticles = useCallback(async (p: number, src: string, sent: SentimentFilter, minConf: number, mktId: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '10' });
      if (src !== 'All') params.set('source', src);
      if (sent !== 'ALL') params.set('sentiment', sent);
      if (minConf > 0) params.set('minConfidence', String(minConf));
      if (marketFilter) params.set('market', marketFilter);
      if (mktId) params.set('marketId', mktId);
      const res = await fetch(`/api/v1/news?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json: NewsFeedResponse = await res.json();
        // Normalise: signals may include nested market object — flatten marketName
        const articles = (json.data ?? []).map(a => ({
          ...a,
          signals: (a.signals ?? []).map((s: NewsSignal & { market?: { title?: string } }) => ({
            ...s,
            marketName: s.marketName ?? s.market?.title ?? 'Unknown market',
          })),
        }));
        setArticles(articles);
        setTotal(json.meta?.total ?? 0);
        setTotalPages(json.meta?.totalPages ?? 0);
      }
    } catch { toast.error('Failed to load news articles'); }
    setLoading(false);
  }, [marketFilter]);

  /* ─── Load top signals ─── */
  const loadTopSignals = useCallback(async () => {
    setLoadingSignals(true);
    try {
      const res = await fetch('/api/v1/news/signals?minConfidence=70&limit=10', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const signals: TopSignal[] = ((json.data ?? json) as (TopSignal & { market?: { title?: string } })[]).map((s) => ({
          ...s,
          marketName: s.marketName ?? s.market?.title ?? 'Unknown market',
        }));
        setTopSignals(signals);
      }
    } catch { toast.error('Failed to load signals') }
    setLoadingSignals(false);
  }, []);

  useEffect(() => { loadArticles(page, source, sentiment, minConfidence, marketId); }, [page, source, sentiment, minConfidence, marketId, loadArticles]);
  useEffect(() => { loadTopSignals(); }, [loadTopSignals]);

  // Auto-refresh top signals every 30 seconds
  useEffect(() => {
    refreshRef.current = setInterval(() => { loadTopSignals(); }, 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadTopSignals]);

  // Debounced market search
  useEffect(() => {
    if (marketDebounceRef.current) clearTimeout(marketDebounceRef.current);
    if (!marketSearch.trim()) { setMarketSearchResults([]); return; }
    marketDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: marketSearch.trim(), limit: '10' });
        const res = await fetch(`/api/v1/markets?${params}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setMarketSearchResults((json.data ?? json) as MarketSearchResult[]);
        }
      } catch { /* silent — search is best-effort */ }
    }, 400);
    return () => { if (marketDebounceRef.current) clearTimeout(marketDebounceRef.current); };
  }, [marketSearch]);

  function changeSource(s: string) { setSource(s); setPage(1); }
  function changeSentiment(s: SentimentFilter) { setSentiment(s); setPage(1); }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="size-6 text-accent-text" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-primary">AI News &amp; Signals</h1>
        </div>
        <span className="text-body-sm text-tertiary">{loading ? '...' : total} articles</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Market search filter */}
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-default bg-elevated focus-within:border-accent/50 transition-colors">
            <Search className="size-3 text-tertiary shrink-0" aria-hidden="true" />
            <Input
              type="text"
              value={marketSearch}
              onChange={e => setMarketSearch(e.target.value)}
              placeholder="Search markets..."
              aria-label="Search markets to filter news"
              className="text-label bg-transparent text-secondary placeholder:text-tertiary outline-none w-36"
            />
          </div>

          {/* Dropdown */}
          {marketSearchResults.length > 0 && !marketId && (
            <div className="absolute z-20 left-0 mt-1 w-72 bg-elevated border border-default rounded-sm shadow-lg overflow-hidden">
              {marketSearchResults.map(m => (
                <Button
                  key={m.id}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMarketId(m.id);
                    setSelectedMarketName(m.question.length > 50 ? m.question.slice(0, 50) + '…' : m.question);
                    setMarketSearch('');
                    setMarketSearchResults([]);
                    setPage(1);
                  }}
                  className="w-full flex flex-col items-start px-3 py-2 hover:bg-surface transition-colors text-left"
                >
                  <span className="text-caption font-mono text-tertiary">{m.slug}</span>
                  <span className="text-label text-primary truncate w-full">
                    {m.question.length > 60 ? m.question.slice(0, 60) + '…' : m.question}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Active market filter chip */}
        {marketId && (
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-label font-medium bg-accent-subtle text-accent-text border border-accent/30">
            {selectedMarketName}
            <Button
              type="button"
              variant="ghost"
              aria-label="Clear market filter"
              onClick={() => { setMarketId(null); setSelectedMarketName(''); setPage(1); }}
              className="hover:text-accent-text transition-colors"
            >
              <X className="size-3" />
            </Button>
          </span>
        )}

        {/* Source dropdown */}
        <Select
          value={source}
          onChange={e => changeSource(e.target.value)}
          aria-label="Filter by news source"
          className="px-3 py-2 rounded-sm text-label bg-elevated text-secondary border border-default hover:border-strong transition-colors"
        >
          {SOURCES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>

        {/* Sentiment tabs */}
        <div className="flex gap-2">
          {SENTIMENT_TABS.map(tab => (
            <Button
              type="button"
              variant="ghost"
              key={tab.value}
              onClick={() => changeSentiment(tab.value)}
              className={`px-3 py-2 rounded-full text-label font-medium whitespace-nowrap border transition-colors ${
                sentiment === tab.value
                  ? 'bg-accent-subtle text-accent-text border-accent/30'
                  : 'bg-elevated text-secondary border-default hover:border-strong'
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Min confidence slider */}
        <div className="flex items-center gap-3 ml-auto">
          <label htmlFor="min-confidence" className="text-label text-tertiary">Min Confidence:</label>
          <input
            id="min-confidence"
            type="range"
            min={0}
            max={100}
            step={5}
            value={minConfidence}
            onChange={e => { setMinConfidence(Number(e.target.value)); setPage(1); }}
            className="w-24 accent-accent"
          />
          <span className="text-label font-mono text-secondary w-8 text-right">{minConfidence}%</span>
        </div>
      </div>

      {/* Main layout: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: articles (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {loading && articles.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => <ArticleSkeleton key={i} />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Newspaper className="size-10 text-tertiary mb-4" />
              <p className="text-primary font-medium">No news articles found</p>
              <p className="text-body-sm text-tertiary mt-1">Adjust filters or check back later.</p>
            </div>
          ) : (
            <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
              {articles.map(article => {
                const expanded = expandedId === article.id;
                const signals = article.signals ?? [];
                return (
                  <div
                    key={article.id}
                    data-testid="news-card"
                    className="bg-elevated border border-default rounded-xl p-4 transition-all duration-panel hover:border-strong hover:shadow-sm"
                  >
                    {/* Top row: badges + time */}
                    <div className="flex items-center gap-2 mb-2">
                      <span data-testid="news-source" className={`px-2 py-1 rounded-full text-label font-medium border ${sourceColor(article.source)}`}>
                        {article.source}
                      </span>
                      <span data-testid="news-sentiment" className={`px-2 py-1 rounded-full text-label font-medium ${sentimentColor(article.sentiment)}`}>
                        {article.sentiment}
                      </span>
                      <span
                        data-testid="sentiment-indicator"
                        className={`sr-only ${article.sentiment === 'POSITIVE' ? 'text-gain' : article.sentiment === 'NEGATIVE' ? 'text-loss' : 'text-tertiary'}`}
                        aria-hidden="true"
                      >
                        {article.sentiment}
                      </span>
                      {signals.length > 0 && (
                        <span className="px-2 py-1 rounded-full text-label font-medium bg-accent-subtle text-accent-text">
                          {signals.length} signal{signals.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="ml-auto text-label text-tertiary">{timeAgo(article.publishedAt)}</span>
                    </div>

                    {/* Title */}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="news-title"
                      className="text-body-md font-medium text-primary hover:text-accent-text transition-colors inline-flex items-center gap-2"
                    >
                      {article.title}
                      <ExternalLink className="size-3 shrink-0 opacity-50" />
                    </a>

                    {/* Summary */}
                    <p data-testid="news-summary" className="text-label text-secondary mt-2 line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                    <span data-testid="news-timestamp" className="sr-only">{article.publishedAt}</span>

                    {/* Expand/collapse signals */}
                    {signals.length > 0 && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setExpandedId(expanded ? null : article.id)}
                          className="flex items-center gap-1 mt-3 text-label text-accent-text hover:text-accent-text transition-colors"
                        >
                          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          {expanded ? 'Hide signals' : `Show ${signals.length} signal${signals.length !== 1 ? 's' : ''}`}
                        </Button>

                        {expanded && (
                          <div className="mt-3 space-y-2 border-t border-subtle pt-3">
                            {signals.map(signal => (
                              <div
                                key={signal.id}
                                data-testid="trading-signal"
                                className="flex items-center gap-3 px-3 py-2 rounded-sm bg-surface border border-subtle"
                              >
                                {/* Direction arrow */}
                                <div data-testid="signal-type" className={`flex items-center gap-1 text-label font-semibold ${
                                  signal.direction === 'BUY' ? 'text-gain' : 'text-loss'
                                }`}>
                                  {signal.direction === 'BUY'
                                    ? <ArrowUpRight className="size-4" />
                                    : <ArrowDownRight className="size-4" />
                                  }
                                  {signal.direction}
                                </div>

                                {/* Market name */}
                                <span className="text-label text-primary truncate flex-1">{signal.marketName}</span>

                                {/* Outcome */}
                                <span className={`px-2 py-1 rounded text-caption font-semibold ${
                                  signal.outcome === 'YES' ? 'bg-gain-subtle text-gain' : 'bg-loss-subtle text-loss'
                                }`}>
                                  {signal.outcome}
                                </span>

                                {/* Confidence bar */}
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <div className={`h-2 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`}>
                                    <div
                                      className={`h-full rounded-full ${confidenceColor(signal.confidence)}`}
                                      style={{ width: `${signal.confidence}%` }}
                                    />
                                  </div>
                                  <span className="text-caption font-mono text-tertiary w-7 text-right">{signal.confidence}%</span>
                                </div>

                                {/* Trade button */}
                                <Link
                                  to={`/markets/${signal.marketId}`}
                                  className="px-2 py-1 rounded-sm text-label font-medium border border-accent/30 text-accent-text hover:bg-accent/10 transition-colors"
                                >
                                  Trade
                                </Link>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Bottom row: detail link */}
                    <div className="flex items-center justify-end mt-2">
                      <Link
                        to={`/news/${article.id}`}
                        className="text-label text-tertiary hover:text-accent-text transition-colors"
                      >
                        View details &rarr;
                      </Link>
                    </div>
                  </div>
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
              <span data-testid="page-indicator" className="text-body-sm font-mono text-secondary" aria-live="polite">{page} / {totalPages}</span>
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

        {/* Right column: Top Signals sidebar (1/3) — hidden when empty */}
        {(loadingSignals || topSignals.length > 0) && (
        <div className="space-y-4">
          <div className="bg-elevated border border-default rounded-xl p-4">
            <h2 className="text-body-md font-medium text-primary mb-4">Top Signals</h2>

            {loadingSignals && topSignals.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => <SignalSkeleton key={i} />)}
              </div>
            ) : (
              <div className="space-y-3">
                {topSignals.map(signal => (
                  <div
                    key={signal.id}
                    className={`rounded-sm border p-3 transition-all duration-panel ${
                      signal.confidence > 80
                        ? 'border-accent/30 shadow-glow-accent'
                        : 'border-subtle'
                    }`}
                  >
                    {/* Market + direction */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-label text-primary font-medium truncate flex-1">
                        {signal.marketName}
                      </span>
                      <span className={`flex items-center gap-1 text-label font-semibold ${
                        signal.direction === 'BUY' ? 'text-gain' : 'text-loss'
                      }`}>
                        {signal.direction === 'BUY'
                          ? <><ArrowUpRight className="size-3" /> BUY</>
                          : <><ArrowDownRight className="size-3" /> SELL</>
                        }
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-2 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-slow ${confidenceColor(signal.confidence)}`}
                          style={{ width: `${signal.confidence}%` }}
                        />
                      </div>
                      <span className="text-caption font-mono text-tertiary w-7 text-right">{signal.confidence}%</span>
                    </div>

                    {/* Reasoning */}
                    <p className="text-label text-tertiary line-clamp-1 mb-2">{signal.reasoning}</p>

                    {/* Trade button */}
                    <Link
                      to={`/markets/${signal.marketId}`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-sm text-label font-medium border border-accent/30 text-accent-text hover:bg-accent/10 transition-colors"
                    >
                      Trade
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
