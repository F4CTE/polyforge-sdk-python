import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface SentimentRow {
  marketId: string;
  marketTitle: string;
  score: number;
  label: string;
  signalCount: number;
  bullishCount: number;
  bearishCount: number;
  lastUpdated: string;
}

type LabelFilter = '' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';

function LabelPill({ label }: { label: string }) {
  if (label === 'BULLISH') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pf-success/10 text-pf-success">
        <TrendingUp size={11} aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (label === 'BEARISH') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pf-danger/10 text-pf-danger">
        <TrendingDown size={11} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pf-base text-pf-text-secondary border border-pf-border">
      <Minus size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

function scoreColor(score: number): string {
  if (score > 0.1) return 'text-pf-success';
  if (score < -0.1) return 'text-pf-danger';
  return 'text-pf-text-secondary';
}

export function Component() {
  const [rows, setRows] = useState<SentimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await adminApi.sentimentOverview();
      setRows(res ?? []);
    } catch {
      toast.error('Failed to load sentiment data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = labelFilter
    ? rows.filter((r) => r.label === labelFilter)
    : rows;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pf-text">Market Sentiment</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-pf-sm border border-pf-border overflow-hidden">
            {(['', 'BULLISH', 'BEARISH', 'NEUTRAL'] as LabelFilter[]).map((val) => (
              <button
                key={val === '' ? 'all' : val}
                type="button"
                onClick={() => setLabelFilter(val)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500 ${
                  labelFilter === val
                    ? 'bg-pf-cyan-500/10 text-pf-cyan-500'
                    : 'text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text'
                }`}
                aria-pressed={labelFilter === val}
              >
                {val === '' ? 'All' : val}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh sentiment data"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-elevated hover:text-pf-text disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Market sentiment overview</caption>
            <thead>
              <tr className="border-b border-pf-border">
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Market</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Score</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Label</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Bullish</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Bearish</th>
                <th scope="col" className="text-right px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Total</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-pf-text-tertiary uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-pf-surface rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <TrendingUp className="mx-auto mb-3 text-pf-text-tertiary opacity-40" size={40} aria-hidden="true" />
                    <p className="text-pf-text-secondary font-medium">No sentiment data found</p>
                    <p className="text-pf-text-tertiary text-xs mt-1">
                      {labelFilter ? `No ${labelFilter} markets at this time` : 'Sentiment signals will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.marketId} className="border-b border-pf-border last:border-0 hover:bg-pf-base transition-colors">
                    <td className="px-4 py-3 text-pf-text font-medium max-w-[280px] truncate">{row.marketTitle}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${scoreColor(row.score)}`}>
                      {row.score > 0 ? '+' : ''}{row.score.toFixed(3)}
                    </td>
                    <td className="px-4 py-3">
                      <LabelPill label={row.label} />
                    </td>
                    <td className="px-4 py-3 text-right text-pf-success font-mono">{row.bullishCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-pf-danger font-mono">{row.bearishCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-pf-text-secondary font-mono">{row.signalCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-pf-text-tertiary">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
