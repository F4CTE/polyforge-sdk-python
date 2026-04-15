import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, ExternalLink, Newspaper, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

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

/* ─── Helpers ────────────────────────────────────────────────────────── */

function sourceColor(source: string): string {
  const map: Record<string, string> = {
    Reuters: 'bg-info/15 text-info border-info/30',
    CNN: 'bg-loss/15 text-loss border-loss/30',
    CoinGecko: 'bg-warning/15 text-warning border-warning/30',
    Bloomberg: 'bg-pf-purple-500/15 text-pf-purple-500 border-pf-purple-500/30',
    'AP News': 'bg-gain/15 text-gain border-gain/30',
  };
  return map[source] ?? 'bg-overlay text-tertiary border-default';
}

function sentimentColor(s: Sentiment): string {
  if (s === 'POSITIVE') return 'bg-gain/15 text-gain';
  if (s === 'NEGATIVE') return 'bg-loss/15 text-loss';
  return 'bg-overlay text-tertiary';
}

function confidenceColor(c: number): string {
  if (c > 70) return 'bg-gain';
  if (c >= 40) return 'bg-warning';
  return 'bg-loss';
}

function confidenceBarBg(c: number): string {
  if (c > 70) return 'bg-gain/15';
  if (c >= 40) return 'bg-warning/15';
  return 'bg-loss/15';
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 bg-overlay rounded w-[60%]" />
      <div className="h-4 bg-overlay rounded w-[40%]" />
      <div className="h-4 bg-overlay rounded w-[80%]" />
      <div className="h-4 bg-overlay rounded w-[65%]" />
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { id } = useParams();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/news/${id}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: NewsArticle) => {
        if (cancelled) return;
        const article: NewsArticle = {
          ...data,
          signals: (data.signals ?? []).map((s) => ({
            ...s,
            marketName: s.marketName ?? (s as NewsSignal & { market?: { title?: string } }).market?.title ?? 'Unknown market',
          })),
        };
        setArticle(article);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { toast.error('Failed to load article'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div data-testid="article-content" className="animate-fade-in p-6 max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        to="/news"
        className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-pf-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> News
      </Link>

      {loading && <DetailSkeleton />}

      {!loading && !article && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Newspaper className="size-10 text-tertiary mb-4" />
          <p className="text-primary font-medium text-lg">Article not found</p>
          <p className="text-sm text-tertiary mt-1">This article may have been removed or the link is incorrect.</p>
          <Link
            to="/news"
            className="mt-4 px-4 py-2 rounded-pf bg-elevated border border-default text-sm text-primary hover:border-strong transition-colors"
          >
            Back to News
          </Link>
        </div>
      )}

      {!loading && article && (
        <>
          {/* Article header */}
          <div className="bg-elevated border border-default rounded-pf-lg p-6 space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded-pf-full text-pf-label font-medium border ${sourceColor(article.source)}`}>
                {article.source}
              </span>
              <span className={`px-2 py-1 rounded-pf-full text-pf-label font-medium ${sentimentColor(article.sentiment)}`}>
                {article.sentiment}
              </span>
            </div>

            {/* Title */}
            <h1 data-testid="article-title" className="text-xl font-semibold text-primary leading-snug">{article.title}</h1>

            {/* Published date */}
            <p className="text-xs text-tertiary">{formatDate(article.publishedAt)}</p>

            {/* Summary */}
            <p className="text-sm text-secondary leading-relaxed">{article.summary}</p>

            {/* External link */}
            <a
              href={article.url?.startsWith('https://') ? article.url : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-pf-sm text-xs font-medium border border-accent/30 text-accent-text hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
            >
              <ExternalLink className="size-4" aria-hidden="true" /> Read full article
            </a>
          </div>

          {/* Signals table */}
          <div data-testid="signal-section" className="bg-elevated border border-default rounded-pf-lg p-6">
            <h2 className="text-sm font-medium text-primary mb-4">
              Signals ({article.signals.length})
            </h2>

            {article.signals.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-tertiary">No trading signals generated for this article.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" role="table" aria-label="Trading signals">
                  <thead>
                    <tr className="border-b border-subtle">
                      <th scope="col" className="text-left py-2 px-3 text-tertiary font-medium">Market</th>
                      <th scope="col" className="text-left py-2 px-3 text-tertiary font-medium">Direction</th>
                      <th scope="col" className="text-left py-2 px-3 text-tertiary font-medium">Outcome</th>
                      <th scope="col" className="text-left py-2 px-3 text-tertiary font-medium">Confidence</th>
                      <th scope="col" className="text-left py-2 px-3 text-tertiary font-medium">Reasoning</th>
                      <th scope="col" className="text-right py-2 px-3 text-tertiary font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {article.signals.map(signal => (
                      <tr key={signal.id} data-testid="trading-signal" className="border-b border-subtle last:border-b-0 hover:bg-surface/50 transition-colors">
                        <td className="py-3 px-3 text-primary font-medium">{signal.marketName}</td>
                        <td data-testid="signal-type" className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 font-semibold ${
                            signal.direction === 'BUY' ? 'text-gain' : 'text-loss'
                          }`}>
                            {signal.direction === 'BUY'
                              ? <ArrowUpRight className="size-4" />
                              : <ArrowDownRight className="size-4" />
                            }
                            {signal.direction}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-1 rounded text-pf-caption font-semibold ${
                            signal.outcome === 'YES' ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'
                          }`}>
                            {signal.outcome}
                          </span>
                        </td>
                        <td data-testid="signal-strength" className="py-3 px-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className={`h-2 rounded-pf-full flex-1 ${confidenceBarBg(signal.confidence)}`}>
                              <div
                                className={`h-full rounded-pf-full ${confidenceColor(signal.confidence)}`}
                                style={{ width: `${signal.confidence}%` }}
                              />
                            </div>
                            <span className="font-mono text-tertiary w-7 text-right">{signal.confidence}%</span>
                          </div>
                        </td>
                        <td data-testid="signal-reasoning" className="py-3 px-3 text-secondary max-w-[200px] truncate">{signal.reasoning}</td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            to={`/markets/${signal.marketId}`}
                            className="px-3 py-1 rounded-pf-sm text-pf-label font-medium border border-accent/30 text-accent-text hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
                          >
                            Trade
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
