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
    Reuters: 'bg-pf-info/15 text-pf-info border-pf-info/30',
    CNN: 'bg-pf-danger/15 text-pf-danger border-pf-danger/30',
    CoinGecko: 'bg-pf-warning/15 text-pf-warning border-pf-warning/30',
    Bloomberg: 'bg-pf-purple-500/15 text-pf-purple-500 border-pf-purple-500/30',
    'AP News': 'bg-pf-success/15 text-pf-success border-pf-success/30',
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
      <div className="h-7 bg-pf-overlay rounded w-[60%]" />
      <div className="h-4 bg-pf-overlay rounded w-[40%]" />
      <div className="h-4 bg-pf-overlay rounded w-[80%]" />
      <div className="h-4 bg-pf-overlay rounded w-[65%]" />
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
      .then((data: NewsArticle) => { if (!cancelled) { setArticle(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { toast.error('Failed to load article'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="animate-fade-in p-6 max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        to="/news"
        className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> News
      </Link>

      {loading && <DetailSkeleton />}

      {!loading && !article && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Newspaper className="size-10 text-pf-text-muted mb-4" />
          <p className="text-pf-text font-medium text-lg">Article not found</p>
          <p className="text-sm text-pf-text-muted mt-1">This article may have been removed or the link is incorrect.</p>
          <Link
            to="/news"
            className="mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors"
          >
            Back to News
          </Link>
        </div>
      )}

      {!loading && article && (
        <>
          {/* Article header */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${sourceColor(article.source)}`}>
                {article.source}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sentimentColor(article.sentiment)}`}>
                {article.sentiment}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-pf-text leading-snug">{article.title}</h1>

            {/* Published date */}
            <p className="text-xs text-pf-text-muted">{formatDate(article.publishedAt)}</p>

            {/* Summary */}
            <p className="text-sm text-pf-text-secondary leading-relaxed">{article.summary}</p>

            {/* External link */}
            <a
              href={article.url?.startsWith('https://') ? article.url : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" /> Read full article
            </a>
          </div>

          {/* Signals table */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
            <h2 className="text-sm font-medium text-pf-text mb-4">
              Signals ({article.signals.length})
            </h2>

            {article.signals.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-pf-text-muted">No trading signals generated for this article.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" role="table" aria-label="Trading signals">
                  <thead>
                    <tr className="border-b border-pf-border-subtle">
                      <th className="text-left py-2 px-3 text-pf-text-muted font-medium">Market</th>
                      <th className="text-left py-2 px-3 text-pf-text-muted font-medium">Direction</th>
                      <th className="text-left py-2 px-3 text-pf-text-muted font-medium">Outcome</th>
                      <th className="text-left py-2 px-3 text-pf-text-muted font-medium">Confidence</th>
                      <th className="text-left py-2 px-3 text-pf-text-muted font-medium">Reasoning</th>
                      <th className="text-right py-2 px-3 text-pf-text-muted font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {article.signals.map(signal => (
                      <tr key={signal.id} className="border-b border-pf-border-subtle last:border-b-0 hover:bg-pf-surface/50 transition-colors">
                        <td className="py-2.5 px-3 text-pf-text font-medium">{signal.marketName}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 font-semibold ${
                            signal.direction === 'BUY' ? 'text-pf-success' : 'text-pf-danger'
                          }`}>
                            {signal.direction === 'BUY'
                              ? <ArrowUpRight className="size-3.5" />
                              : <ArrowDownRight className="size-3.5" />
                            }
                            {signal.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            signal.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'
                          }`}>
                            {signal.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className={`h-1.5 rounded-full flex-1 ${confidenceBarBg(signal.confidence)}`}>
                              <div
                                className={`h-full rounded-full ${confidenceColor(signal.confidence)}`}
                                style={{ width: `${signal.confidence}%` }}
                              />
                            </div>
                            <span className="font-mono text-pf-text-muted w-7 text-right">{signal.confidence}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-pf-text-secondary max-w-[200px] truncate">{signal.reasoning}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/markets/${signal.marketId}`}
                            className="px-2.5 py-1 rounded-pf-sm text-[11px] font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors"
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
