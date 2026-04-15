import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Suggestion {
  type?: string;
  priority?: string;
  description?: string;
}

interface PortfolioReview {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  suggestions: (Suggestion | string)[];
  generatedAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function riskPillClass(level: string): string {
  if (level === 'low') return 'bg-gain/15 text-gain border border-gain/30';
  if (level === 'medium') return 'bg-warning/15 text-warning border border-warning/30';
  return 'bg-loss/15 text-loss border border-loss/30';
}

function suggestionText(s: Suggestion | string): string {
  if (typeof s === 'string') return s;
  return s.description ?? '';
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ─── Loading Skeleton ───────────────────────────────────────────────── */

function ReviewSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Score skeleton */}
      <div className="bg-elevated border border-default rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-overlay rounded w-28 animate-pulse" />
          <div className="h-7 bg-overlay rounded-full w-16 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-overlay rounded w-full animate-pulse" />
          <div className="h-3 bg-overlay rounded w-[90%] animate-pulse" />
          <div className="h-3 bg-overlay rounded w-[75%] animate-pulse" />
          <div className="h-3 bg-overlay rounded w-[80%] animate-pulse" />
        </div>
      </div>
      {/* Suggestions skeleton */}
      <div className="bg-elevated border border-default rounded-xl p-6 space-y-2">
        <div className="h-4 bg-overlay rounded w-28 animate-pulse mb-4" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="h-3 w-3 bg-overlay rounded-full mt-1 shrink-0 animate-pulse" />
            <div className="h-3 bg-overlay rounded flex-1 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [data, setData] = useState<PortfolioReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch('/api/v1/ai/portfolio-review', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load portfolio review');
      const d: PortfolioReview = await res.json();
      setData(d);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-tertiary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-primary">AI Portfolio Optimizer</h1>
        </div>
        <Button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-pf bg-elevated border border-default text-xs text-secondary hover:border-strong hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="Refresh analysis"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
      </div>

      {loading && <ReviewSkeleton />}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-elevated border border-default rounded-xl">
          <Sparkles className="size-10 text-tertiary mb-4 opacity-40" aria-hidden="true" />
          <p className="text-primary font-medium">Failed to load review</p>
          <p className="text-sm text-tertiary mt-1">{error}</p>
          <Button
            type="button"
            onClick={load}
            className="mt-4 px-4 py-2 rounded-pf bg-elevated border border-default text-sm text-primary hover:border-strong transition-colors"
          >
            Try Again
          </Button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Review card */}
          <div className="bg-elevated border border-default rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-medium text-primary uppercase tracking-wide">Portfolio Review</h2>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${riskPillClass(data.riskLevel)}`}
                  aria-label={`Risk level: ${data.riskLevel}`}
                >
                  {data.riskLevel} risk
                </span>
              </div>
            </div>
            <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
              {data.summary}
            </p>
            {data.generatedAt && (
              <p className="text-label text-tertiary pt-1 border-t border-subtle">
                Generated {formatGeneratedAt(data.generatedAt)}
              </p>
            )}
          </div>

          {/* Suggestions */}
          {data.suggestions.length > 0 && (
            <div className="bg-elevated border border-default rounded-xl p-6">
              <h2 className="text-sm font-medium text-primary uppercase tracking-wide mb-4">Suggestions</h2>
              <ul className="space-y-3" aria-label="Portfolio suggestions">
                {data.suggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-secondary">
                    <span
                      className="mt-2 size-2 rounded-full bg-accent shrink-0"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">{suggestionText(suggestion)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
