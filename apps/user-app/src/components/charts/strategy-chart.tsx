import { useState, useEffect, useRef } from 'react';
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

export function StrategyChart({ tokenId, label, trades, dateFrom, dateTo }: StrategyChartProps) {
  const [candles, setCandles] = useState<PriceCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useRef(getTheme());

  useEffect(() => {
    if (!tokenId) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ resolution: '1h', limit: '200' });
    if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
    if (dateTo)   params.set('to',   new Date(dateTo).toISOString());

    fetch(`/api/v1/markets/${tokenId}/price-history?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((body: { data?: { time: string; close: string }[] }) => {
        const data = body?.data ?? [];
        setCandles(
          data.map(c => ({
            ts: new Date(c.time).getTime(),
            label: formatTickLabel(new Date(c.time).getTime()),
            close: parseFloat(c.close),
          }))
        );
      })
      .catch(() => setError('Failed to load price data'))
      .finally(() => setLoading(false));
  }, [tokenId, dateFrom, dateTo]);

  const { cyan, bgElevated, border, textMuted } = theme.current;

  // Trade markers — map to nearest candle timestamp
  const buyDots  = trades.filter(t => t.side === 'BUY');
  const sellDots = trades.filter(t => t.side === 'SELL');

  const gradId = `cg-${tokenId.slice(0, 8)}`;

  return (
    <div className="rounded-pf-sm bg-pf-elevated border border-pf-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-pf-border">
        <span className="text-[10px] font-medium text-pf-text-secondary uppercase tracking-wider truncate max-w-[70%]">
          {label}
        </span>
        {!loading && !error && candles.length > 0 && (
          <span className="text-[10px] font-mono text-pf-text-muted">
            {candles[candles.length - 1]?.close.toFixed(3)}
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
            <span className="text-[10px]">{error}</span>
          </div>
        )}
        {!loading && !error && candles.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-1 text-pf-text-muted">
            <TrendingUp className="size-4 opacity-20" />
            <span className="text-[10px]">No price data</span>
          </div>
        )}
        {!loading && !error && candles.length > 0 && (
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
                domain={['dataMin', 'dataMax']}
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

              {/* BUY markers — green dots */}
              {buyDots.map((t, i) => (
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

              {/* SELL markers — red dots */}
              {sellDots.map((t, i) => (
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
      {trades.length > 0 && !loading && !error && candles.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1 border-t border-pf-border">
          {buyDots.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-pf-text-muted">
              <span className="size-2 rounded-full bg-pf-success inline-block" />
              {buyDots.length} BUY
            </span>
          )}
          {sellDots.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-pf-text-muted">
              <span className="size-2 rounded-full bg-pf-danger inline-block" />
              {sellDots.length} SELL
            </span>
          )}
        </div>
      )}
    </div>
  );
}
