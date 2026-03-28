import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Newspaper, ChevronDown, ChevronUp,
  ExternalLink, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
type SentimentFilter = 'ALL' | Sentiment;

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
    Reuters: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    CNN: 'bg-pf-danger/15 text-pf-danger border-pf-danger/30',
    CoinGecko: 'bg-pf-warning/15 text-pf-warning border-pf-warning/30',
    Bloomberg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'AP News': 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  };
  return map[source] ?? 'bg-pf-overlay text-pf-text-muted border-pf-border';
}

function sentimentColor(s: Sentiment): string {
  if (s === 'POSITIVE') return 'bg-pf-success/15 text-pf-success';
  if (s === 'NEGATIVE') return 'bg-pf-danger/15 text-pf-danger';
  return 'bg-pf-overlay text-pf-text-muted';
}

function confidenceColor(c: number): string {
  if (c > 70) return 'bg-pf-success';
  if (c >= 40) return 'bg-pf-warning';
  return 'bg-pf-danger';
}

function confidenceBarBg(c: number): string {
  if (c > 70) return 'bg-pf-success/15';
  if (c >= 40) return 'bg-pf-warning/15';
  return 'bg-pf-danger/15';
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
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 bg-pf-overlay rounded-full" />
        <div className="h-5 w-16 bg-pf-overlay rounded-full" />
        <div className="ml-auto h-3 w-16 bg-pf-overlay rounded" />
      </div>
      <div className="h-4 bg-pf-overlay rounded w-[85%]" />
      <div className="h-3 bg-pf-overlay rounded w-[70%]" />
      <div className="h-3 bg-pf-overlay rounded w-[50%]" />
    </div>
  );
}

function SignalSkeleton() {
  return (
    <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-3 space-y-2 animate-shimmer">
      <div className="h-3.5 bg-pf-overlay rounded w-[60%]" />
      <div className="h-3 bg-pf-overlay rounded w-[40%]" />
      <div className="h-2 bg-pf-overlay rounded w-full" />
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

  const [topSignals, setTopSignals] = useState<TopSignal[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(true);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Load articles ─── */
  const loadArticles = useCallback(async (p: number, src: string, sent: SentimentFilter, minConf: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '10' });
      if (src !== 'All') params.set('source', src);
      if (sent !== 'ALL') params.set('sentiment', sent);
      if (minConf > 0) params.set('minConfidence', String(minConf));
      if (marketFilter) params.set('market', marketFilter);
      const res = await fetch(`/api/v1/news?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json: NewsFeedResponse = await res.json();
        // Normalise: signals may include nested market object — flatten marketName
        const articles = (json.data ?? []).map(a => ({
          ...a,
          signals: (a.signals ?? []).map((s: any) => ({
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
        const signals: TopSignal[] = ((json.data ?? json) as any[]).map((s: any) => ({
          ...s,
          marketName: s.marketName ?? s.market?.title ?? 'Unknown market',
        }));
        setTopSignals(signals);
      }
    } catch { toast.error('Failed to load signals') }
    setLoadingSignals(false);
  }, []);

  useEffect(() => { loadArticles(page, source, sentiment, minConfidence); }, [page, source, sentiment, minConfidence, loadArticles]);
  useEffect(() => { loadTopSignals(); }, [loadTopSignals]);

  // Auto-refresh top signals every 30 seconds
  useEffect(() => {
    refreshRef.current = setInterval(() => { loadTopSignals(); }, 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadTopSignals]);

  function changeSource(s: string) { setSource(s); setPage(1); }
  function changeSentiment(s: SentimentFilter) { setSentiment(s); setPage(1); }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="size-6 text-pf-cyan-400" />
          <h1 className="text-2xl font-semibold text-pf-text">AI News &amp; Signals</h1>
        </div>
        <span className="text-sm text-pf-text-muted">{loading ? '...' : total} articles</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Source dropdown */}
        <select
          value={source}
          onChange={e => changeSource(e.target.value)}
          className="px-3 py-1.5 rounded-pf-sm text-xs bg-pf-elevated text-pf-text-secondary border border-pf-border hover:border-pf-border-strong transition-colors"
        >
          {SOURCES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Sentiment tabs */}
        <div className="flex gap-1.5">
          {SENTIMENT_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => changeSentiment(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                sentiment === tab.value
                  ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                  : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Min confidence slider */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-pf-text-muted">Min Confidence:</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minConfidence}
            onMouseUp={e => { setMinConfidence(Number((e.target as HTMLInputElement).value)); setPage(1); }}
            onChange={e => { /* visual update only — commit on mouseUp */ }}
            className="w-24 accent-pf-cyan-500"
          />
          <span className="text-xs font-mono text-pf-text-secondary w-8 text-right">{minConfidence}%</span>
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
              <Newspaper className="size-10 text-pf-text-muted mb-4" />
              <p className="text-pf-text font-medium">No news articles found</p>
              <p className="text-sm text-pf-text-muted mt-1">Adjust filters or check back later.</p>
            </div>
          ) : (
            <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
              {articles.map(article => {
                const expanded = expandedId === article.id;
                const signals = article.signals ?? [];
                return (
                  <div
                    key={article.id}
                    className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm"
                  >
                    {/* Top row: badges + time */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${sourceColor(article.source)}`}>
                        {article.source}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sentimentColor(article.sentiment)}`}>
                        {article.sentiment}
                      </span>
                      {signals.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-pf-cyan-500/15 text-pf-cyan-400">
                          {signals.length} signal{signals.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-pf-text-muted">{timeAgo(article.publishedAt)}</span>
                    </div>

                    {/* Title */}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-pf-text hover:text-pf-cyan-400 transition-colors inline-flex items-center gap-1.5"
                    >
                      {article.title}
                      <ExternalLink className="size-3 shrink-0 opacity-50" />
                    </a>

                    {/* Summary */}
                    <p className="text-xs text-pf-text-secondary mt-1.5 line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>

                    {/* Expand/collapse signals */}
                    {signals.length > 0 && (
                      <>
                        <button
                          onClick={() => setExpandedId(expanded ? null : article.id)}
                          className="flex items-center gap-1 mt-3 text-xs text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors"
                        >
                          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          {expanded ? 'Hide signals' : `Show ${signals.length} signal${signals.length !== 1 ? 's' : ''}`}
                        </button>

                        {expanded && (
                          <div className="mt-3 space-y-2 border-t border-pf-border-subtle pt-3">
                            {signals.map(signal => (
                              <div
                                key={signal.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-pf-sm bg-pf-surface border border-pf-border-subtle"
                              >
                                {/* Direction arrow */}
                                <div className={`flex items-center gap-1 text-xs font-semibold ${
                                  signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'
                                }`}>
                                  {signal.direction === 'BUY'
                                    ? <ArrowUpRight className="size-3.5" />
                                    : <ArrowDownRight className="size-3.5" />
                                  }
                                  {signal.direction}
                                </div>

                                {/* Market name */}
                                <span className="text-xs text-pf-text truncate flex-1">{signal.marketName}</span>

                                {/* Outcome */}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  signal.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'
                                }`}>
                                  {signal.outcome}
                                </span>

                                {/* Confidence bar */}
                                <div className="flex items-center gap-1.5 min-w-[80px]">
                                  <div className={`h-1.5 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`}>
                                    <div
                                      className={`h-full rounded-full ${confidenceColor(signal.confidence)}`}
                                      style={{ width: `${signal.confidence}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-pf-text-muted w-7 text-right">{signal.confidence}%</span>
                                </div>

                                {/* Trade button */}
                                <Link
                                  to={`/markets/${signal.marketId}`}
                                  className="px-2 py-1 rounded-pf-sm text-[11px] font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors"
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
                        className="text-[11px] text-pf-text-muted hover:text-pf-cyan-400 transition-colors"
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
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
              <button
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

        {/* Right column: Top Signals sidebar (1/3) — hidden when empty */}
        {(loadingSignals || topSignals.length > 0) && (
        <div className="space-y-4">
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
            <h2 className="text-sm font-medium text-pf-text mb-4">Top Signals</h2>

            {loadingSignals && topSignals.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => <SignalSkeleton key={i} />)}
              </div>
            ) : (
              <div className="space-y-3">
                {topSignals.map(signal => (
                  <div
                    key={signal.id}
                    className={`rounded-pf-sm border p-3 transition-all duration-200 ${
                      signal.confidence > 80
                        ? 'border-pf-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.08)]'
                        : 'border-pf-border-subtle'
                    }`}
                  >
                    {/* Market + direction */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-pf-text font-medium truncate flex-1">
                        {signal.marketName}
                      </span>
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${
                        signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'
                      }`}>
                        {signal.direction === 'BUY'
                          ? <><ArrowUpRight className="size-3" /> BUY</>
                          : <><ArrowDownRight className="size-3" /> SELL</>
                        }
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`h-1.5 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${confidenceColor(signal.confidence)}`}
                          style={{ width: `${signal.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-pf-text-muted w-7 text-right">{signal.confidence}%</span>
                    </div>

                    {/* Reasoning */}
                    <p className="text-[11px] text-pf-text-muted line-clamp-1 mb-2">{signal.reasoning}</p>

                    {/* Trade button */}
                    <Link
                      to={`/markets/${signal.marketId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pf-sm text-[11px] font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 transition-colors"
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
