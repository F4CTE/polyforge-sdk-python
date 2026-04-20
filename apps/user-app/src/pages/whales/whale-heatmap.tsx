import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { Button, CardSkeleton, SkeletonLine } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface MarketHeat {
  marketId: string;
  marketTitle: string;
  category: string;
  totalVolume: number;
  tradeCount: number;
  uniqueWhales: number;
  netSentiment: number;
}

interface HeatmapResponse {
  data: MarketHeat[];
  period: string;
}

type Period = '1h' | '4h' | '24h' | '7d';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const PERIODS: { label: string; value: Period }[] = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
];

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function heatColor(volume: number, maxVolume: number): string {
  const intensity = maxVolume > 0 ? volume / maxVolume : 0;
  if (intensity >= 0.8) return 'bg-accent/30 border-accent/50';
  if (intensity >= 0.6) return 'bg-accent/20 border-accent/35';
  if (intensity >= 0.4) return 'bg-accent/12 border-accent/25';
  if (intensity >= 0.2) return 'bg-accent/8 border-accent/15';
  return 'bg-overlay border-default';
}

function sentimentColor(net: number): string {
  if (net > 0.3) return 'text-gain';
  if (net < -0.3) return 'text-loss';
  return 'text-secondary';
}

function sentimentLabel(net: number): string {
  if (net > 0.3) return 'Bullish';
  if (net < -0.3) return 'Bearish';
  return 'Neutral';
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function HeatmapSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, i) => (
        <CardSkeleton key={i}>
          <SkeletonLine h="h-4" w="w-[70%]" />
          <SkeletonLine w="w-[50%]" />
          <SkeletonLine w="w-[40%]" />
        </CardSkeleton>
      ))}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [data, setData] = useState<MarketHeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('24h');

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/whales/heatmap?period=${p}`, { credentials: 'include' });
      if (res.ok) {
        const json: HeatmapResponse = await res.json();
        setData(json.data ?? []);
      }
    } catch {
      toast.error('Failed to load heatmap data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const maxVolume = data.reduce((max, m) => Math.max(max, m.totalVolume), 0);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Back + Header */}
      <Link
        to="/whales"
        className="flex items-center gap-2 text-body-sm text-secondary hover:text-accent-text transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to Whale Feed
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame className="size-6 text-accent-text" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-primary">Whale Activity Heatmap</h1>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 rounded-pf border border-default overflow-hidden">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              type="button"
              variant="ghost"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-2 text-label font-medium transition-colors ${
                period === p.value
                  ? 'bg-accent-subtle text-accent-text'
                  : 'text-secondary hover:text-primary'
              }`}
              aria-pressed={period === p.value}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-body-sm text-secondary">
        Markets sized by whale capital inflow over the last {period}. Brighter = more activity.
      </p>

      {/* Heatmap grid */}
      {loading ? (
        <HeatmapSkeleton />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Flame className="size-10 text-tertiary mb-4" />
          <p className="text-primary font-medium">No whale activity in this period</p>
          <p className="text-body-sm text-tertiary mt-1">Try expanding the time range.</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          role="list"
          aria-label="Whale activity by market"
        >
          {data.map(market => (
            <div
              key={market.marketId}
              role="listitem"
              className={`rounded-pf border p-4 transition-all hover:scale-[1.02] hover:shadow-sm ${heatColor(market.totalVolume, maxVolume)}`}
            >
              <p className="text-body-sm font-medium text-primary truncate mb-2" title={market.marketTitle}>
                {market.marketTitle}
              </p>
              <span className="inline-block px-2 py-0.5 rounded-full text-caption bg-overlay text-tertiary mb-3">
                {market.category}
              </span>

              <div className="space-y-1.5 text-label">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Volume</span>
                  <span className="font-mono font-semibold text-primary">{fmtVolume(market.totalVolume)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Trades</span>
                  <span className="font-mono text-primary">{market.tradeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Whales</span>
                  <span className="font-mono text-primary">{market.uniqueWhales}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Sentiment</span>
                  <span className={`font-mono font-semibold ${sentimentColor(market.netSentiment)}`}>
                    {sentimentLabel(market.netSentiment)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
