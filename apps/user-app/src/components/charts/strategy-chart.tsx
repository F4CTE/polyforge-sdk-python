import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { TrendingUp, Loader2, AlertTriangle } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface TradeMarker {
  time: string;
  side: string;
  price: string;
}

interface PriceCandle {
  ts: number;
  label: string;
  close: number;
}

interface StrategyChartProps {
  /** Polymarket token ID for this chart */
  tokenId: string;
  /** Display label shown in the chart header (e.g. "Market A — YES") */
  label: string;
  /** Trade markers to overlay as green/red dots */
  trades: TradeMarker[];
  /** ISO date string for start of price history range */
  dateFrom?: string;
  /** ISO date string for end of price history range */
  dateTo?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatTickLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTooltipDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getTheme() {
  const s = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null;
  return {
    cyan:      s?.getPropertyValue('--color-pf-cyan-500').trim()        || '#06B6D4',
    bgElevated: s?.getPropertyValue('--color-pf-elevated').trim()       || '#111D2E',
    border:    s?.getPropertyValue('--color-pf-border').trim()          || '#1E3350',
    textMuted: s?.getPropertyValue('--color-pf-text-muted').trim()      || '#445E7A',
    textSec:   s?.getPropertyValue('--color-pf-text-secondary').trim()  || '#7A94B4',
  };
}

/* ─── Component ──────────────────────────────────────────────────────── */

interface StrategyChartPropsExtended extends StrategyChartProps {
  /** When true, chart polls for new candles every 30s (live mode) */
  live?: boolean;
}

/** Animation duration in ms for backtest replay */
const REPLAY_DURATION_MS = 2000;
/** Live poll interval in ms */
const LIVE_POLL_MS = 30_000;

export function StrategyChart({ tokenId, label, trades, dateFrom, dateTo, live = false }: StrategyChartPropsExtended) {
  const [allCandles, setAllCandles] = useState<PriceCandle[]>([]);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useRef(getTheme());
  const rafRef = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);

  const fetchCandles = useCallback((append = false) => {
    if (!tokenId) return;
    if (!append) { setLoading(true); setError(null); }

    const params = new URLSearchParams({ resolution: '1h', limit: '200' });
    if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
    if (dateTo)   params.set('to',   new Date(dateTo).toISOString());

    fetch(`/api/v1/markets/${tokenId}/price-history?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((body: { data?: { time: string; close: string }[] }) => {
        const data = body?.data ?? [];
        const parsed = data.map(c => ({
          ts: new Date(c.time).getTime(),
          label: formatTickLabel(new Date(c.time).getTime()),
          close: parseFloat(c.close),
        }));
        setAllCandles(prev => {
          if (!append) return parsed;
          // Merge: keep existing, append only genuinely new candles
          const lastTs = prev.at(-1)?.ts ?? 0;
          const fresh = parsed.filter(c => c.ts > lastTs);
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      })
      .catch(() => { if (!append) setError('Failed to load price data'); })
      .finally(() => { if (!append) setLoading(false); });
  }, [tokenId, dateFrom, dateTo]);

  // Initial fetch
  useEffect(() => { fetchCandles(false); }, [fetchCandles]);

  // Live polling
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => fetchCandles(true), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [live, fetchCandles]);

  // Replay animation for backtest (non-live) mode
  useEffect(() => {
    if (live || allCandles.length === 0) {
      // Live mode or empty: show all immediately
      setDisplayedCount(allCandles.length);
      return;
    }

    // Cancel any in-progress animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    animStartRef.current = null;
    setDisplayedCount(0);

    const total = allCandles.length;

    const step = (now: number) => {
      if (!animStartRef.current) animStartRef.current = now;
      const elapsed = now - animStartRef.current;
      const progress = Math.min(elapsed / REPLAY_DURATION_MS, 1);
      // Ease-out curve so it starts fast and slows near the end
      const eased = 1 - Math.pow(1 - progress, 2);
      const count = Math.max(1, Math.ceil(eased * total));
      setDisplayedCount(count);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [allCandles, live]);

  const candles = live ? allCandles : allCandles.slice(0, displayedCount);
  const playheadTs = candles.at(-1)?.ts ?? 0;
  const fullDomainMin = allCandles[0]?.ts ?? 0;
  const fullDomainMax = allCandles.at(-1)?.ts ?? 0;

  const { cyan, bgElevated, border, textMuted } = theme.current;

  // Trade markers — only show those the playhead has reached
  const visibleBuyDots  = trades.filter(t => t.side === 'BUY'  && new Date(t.time).getTime() <= playheadTs);
  const visibleSellDots = trades.filter(t => t.side === 'SELL' && new Date(t.time).getTime() <= playheadTs);
  const buyDots  = trades.filter(t => t.side === 'BUY');
  const sellDots = trades.filter(t => t.side === 'SELL');

  const gradId = `cg-${tokenId.slice(0, 8)}`;

  return (
    <div className="rounded-pf-sm bg-pf-elevated border border-pf-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-pf-border">
        <span className="text-pf-caption font-medium text-pf-text-secondary uppercase tracking-wider truncate max-w-[70%]">
          {label}
        </span>
        {!loading && !error && allCandles.length > 0 && (
          <span className="text-pf-caption font-mono text-pf-text-muted">
            {(candles.at(-1) ?? allCandles.at(-1))?.close.toFixed(3)}
            {live && <span className="ml-1 text-pf-cyan-400 animate-pulse">●</span>}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="h-[140px] w-full">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-4 animate-spin text-pf-cyan-400 opacity-60" />
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center gap-1 text-pf-text-muted">
            <AlertTriangle className="size-4 opacity-40" />
            <span className="text-pf-caption">{error}</span>
          </div>
        )}
        {!loading && !error && allCandles.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-1 text-pf-text-muted">
            <TrendingUp className="size-4 opacity-20" />
            <span className="text-pf-caption">No price data</span>
          </div>
        )}
        {!loading && !error && allCandles.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={candles} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={cyan} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={cyan} stopOpacity={0}    />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={[fullDomainMin, fullDomainMax]}
                tickFormatter={formatTickLabel}
                tick={{ fontSize: 9, fill: textMuted }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 9, fill: textMuted }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(2)}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: bgElevated,
                  border: `1px solid ${border}`,
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '4px 8px',
                }}
                labelFormatter={(ts: number) => formatTooltipDate(ts)}
                labelStyle={{ color: '#7A94B4', marginBottom: 2 }}
                itemStyle={{ color: cyan }}
                formatter={(v: number) => [v.toFixed(3), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={cyan}
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: cyan, strokeWidth: 0 }}
                isAnimationActive={false}
              />

              {/* BUY markers — revealed as playhead advances */}
              {visibleBuyDots.map((t, i) => (
                <ReferenceDot
                  key={`buy-${i}`}
                  x={new Date(t.time).getTime()}
                  y={parseFloat(t.price)}
                  r={4}
                  fill="#22C55E"
                  stroke="#0F172A"
                  strokeWidth={1}
                  isFront
                />
              ))}

              {/* SELL markers — revealed as playhead advances */}
              {visibleSellDots.map((t, i) => (
                <ReferenceDot
                  key={`sell-${i}`}
                  x={new Date(t.time).getTime()}
                  y={parseFloat(t.price)}
                  r={4}
                  fill="#EF4444"
                  stroke="#0F172A"
                  strokeWidth={1}
                  isFront
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend — only if there are trade markers */}
      {trades.length > 0 && !loading && !error && allCandles.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1 border-t border-pf-border">
          {buyDots.length > 0 && (
            <span className="flex items-center gap-1 text-pf-micro text-pf-text-muted">
              <span className="size-2 rounded-pf-full bg-pf-success inline-block" />
              {visibleBuyDots.length}/{buyDots.length} BUY
            </span>
          )}
          {sellDots.length > 0 && (
            <span className="flex items-center gap-1 text-pf-micro text-pf-text-muted">
              <span className="size-2 rounded-pf-full bg-pf-danger inline-block" />
              {visibleSellDots.length}/{sellDots.length} SELL
            </span>
          )}
        </div>
      )}
    </div>
  );
}
