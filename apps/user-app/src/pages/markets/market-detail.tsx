import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Play,
  Plus,
  BarChart3,
  Clock,
  Droplets,
  TrendingUp,
  Zap,
  X,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface MarketToken {
  tokenId: string;
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
}

interface PriceCandle {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface PriceHistory {
  tokenId: string;
  resolution: string;
  hasGaps: boolean;
  data: PriceCandle[];
}

interface OrderBookEntry {
  price: string;
  size: string;
}

interface OrderBook {
  tokenId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: string;
  midpoint: string;
  timestamp: number;
}

interface StrategyOption {
  id: string;
  name: string;
}

type Resolution = '1m' | '1h' | '1d';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatVolume(vol: string): string {
  const v = parseFloat(vol);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function totalLiquidity(tokens: MarketToken[]): string {
  const v = tokens.reduce((sum, t) => sum + parseFloat(t.liquidity || '0'), 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function chartRange(res: Resolution): number {
  if (res === '1m') return 6 * 60 * 60 * 1000;
  if (res === '1h') return 7 * 24 * 60 * 60 * 1000;
  return 90 * 24 * 60 * 60 * 1000;
}

function chartLimit(res: Resolution): number {
  return res === '1d' ? 90 : 200;
}

function bookDepth(entries: OrderBookEntry[], index: number): number {
  const total = entries.reduce((s, e) => s + parseFloat(e.size), 0);
  if (total === 0) return 0;
  const cumSize = entries.slice(0, index + 1).reduce((s, e) => s + parseFloat(e.size), 0);
  return Math.round((cumSize / total) * 100);
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 bg-pf-overlay rounded w-[60%]" />
      <div className="h-4 bg-pf-overlay rounded w-[40%]" />
      <div className="h-4 bg-pf-overlay rounded w-[80%]" />
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Read CSS variables for Recharts (which needs raw color strings)
  const styles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const textMuted = styles?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A';
  const bgElevated = styles?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E';
  const borderColor = styles?.getPropertyValue('--color-pf-border').trim() || '#1E3350';
  const textSecondary = styles?.getPropertyValue('--color-pf-text-secondary').trim() || '#7A94B4';
  const cyan500 = styles?.getPropertyValue('--color-pf-cyan-500').trim() || '#06B6D4';

  const [market, setMarket] = useState<Market | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);

  const [chartData, setChartData] = useState<{ time: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [resolution, setResolution] = useState<Resolution>('1h');

  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);

  const [showRunStrategy, setShowRunStrategy] = useState(false);
  const [strategyOptions, setStrategyOptions] = useState<StrategyOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');

  // Load market
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingMarket(true);
    fetch(`/api/v1/markets/${id}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((m: Market) => {
        if (!cancelled) {
          setMarket(m);
          setLoadingMarket(false);
        }
      })
      .catch(() => { if (!cancelled) { toast.error('Failed to load market'); setLoadingMarket(false); } });
    return () => { cancelled = true; };
  }, [id]);

  // Load chart
  const loadChart = useCallback(
    (tokenId: string, res: Resolution) => {
      setLoadingChart(true);
      const from = new Date(Date.now() - chartRange(res)).toISOString();
      const params = new URLSearchParams({
        resolution: res,
        limit: String(chartLimit(res)),
        from,
      });
      fetch(`/api/v1/markets/${tokenId}/price-history?${params}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((h: PriceHistory) => {
          setChartData(
            h.data.map((d) => ({
              time:
                res === '1m'
                  ? new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : res === '1h'
                    ? new Date(d.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : new Date(d.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
              close: parseFloat(d.close),
            })),
          );
          setLoadingChart(false);
        })
        .catch(() => { toast.error('Failed to load chart data'); setLoadingChart(false); });
    },
    [],
  );

  // Load order book
  const loadBook = useCallback((tokenId: string) => {
    setLoadingBook(true);
    fetch(`/api/v1/markets/${tokenId}/book`, { credentials: 'include' })
      .then((r) => r.json())
      .then((b: OrderBook) => {
        setOrderBook(b);
        setLoadingBook(false);
      })
      .catch(() => { toast.error('Failed to load order book'); setLoadingBook(false); });
  }, []);

  // When market loads, fetch chart + book
  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    const yesToken = market.tokens.find((t) => t.outcome === 'YES');
    if (yesToken) {
      loadChart(yesToken.tokenId, resolution);
      loadBook(yesToken.tokenId);
    }
    return () => { cancelled = true; };
  }, [market, resolution, loadChart, loadBook]);

  // When resolution changes
  function onResolutionChange(res: Resolution) {
    setResolution(res);
    const yesToken = market?.tokens.find((t) => t.outcome === 'YES');
    if (yesToken) loadChart(yesToken.tokenId, res);
  }

  // Load strategy options when dialog opens
  useEffect(() => {
    if (!showRunStrategy) return;
    fetch('/api/v1/strategies?limit=100', { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { data: { id: string; name: string }[] }) => {
        setStrategyOptions(res.data.map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => { toast.error('Failed to load strategies'); });
  }, [showRunStrategy]);

  function onStartStrategy() {
    if (!selectedStrategyId) return;
    fetch(`/api/v1/strategies/${selectedStrategyId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mode: 'paper' }),
    }).then(() => {
      setShowRunStrategy(false);
      setSelectedStrategyId('');
    });
  }

  const yesPrice = market?.tokens.find((t) => t.outcome === 'YES')?.price ?? null;
  const noPrice = market?.tokens.find((t) => t.outcome === 'NO')?.price ?? null;
  const days = market ? daysUntil(market.endDate) : 0;

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Back */}
      <Link
        to="/markets"
        className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Markets
      </Link>

      {loadingMarket && <DetailSkeleton />}

      {!loadingMarket && !market && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-pf-text font-medium text-lg">Market not found</p>
          <p className="text-sm text-pf-text-muted mt-1">
            This market may have been removed or the link is incorrect.
          </p>
          <button
            onClick={() => navigate('/markets')}
            className="mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors"
          >
            Back to Markets
          </button>
        </div>
      )}

      {!loadingMarket && market && (
        <>
          {/* Market header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-pf-cyan-500/15 text-pf-cyan-400 text-xs font-medium">
                  {market.category}
                </span>
                {days >= 0 && days <= 7 && (
                  <span className="px-2 py-0.5 rounded-full bg-pf-warning/15 text-pf-warning text-xs font-medium">
                    Closing soon
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-semibold text-pf-text leading-snug">
                {market.title}
              </h1>
              <p className="text-sm text-pf-text-secondary">
                Closes {formatDate(market.endDate)}
                {days > 0 && (
                  <span className="text-pf-text-muted"> &middot; {days} days remaining</span>
                )}
              </p>
            </div>

            {/* Price pills + Run Strategy */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-2">
                <div className="flex flex-col items-center px-4 py-2 rounded-pf-md bg-pf-success/10 border border-pf-success/20">
                  <span className="text-[10px] uppercase tracking-wide text-pf-success/70">YES</span>
                  <span className="text-lg font-mono font-semibold text-pf-success">
                    {yesPrice ?? '\u2014'}
                  </span>
                </div>
                <div className="flex flex-col items-center px-4 py-2 rounded-pf-md bg-pf-danger/10 border border-pf-danger/20">
                  <span className="text-[10px] uppercase tracking-wide text-pf-danger/70">NO</span>
                  <span className="text-lg font-mono font-semibold text-pf-danger">
                    {noPrice ?? '\u2014'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowRunStrategy(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-success text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Play className="size-4" /> Run Strategy
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <BarChart3 className="size-4 text-pf-text-muted" />, label: '24h Volume', value: formatVolume(market.volume24h) },
              { icon: <Droplets className="size-4 text-pf-text-muted" />, label: 'Liquidity', value: totalLiquidity(market.tokens) },
              { icon: <Clock className="size-4 text-pf-text-muted" />, label: 'End Date', value: formatDate(market.endDate) },
            ].map((stat) => (
              <div key={stat.label} className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-xs text-pf-text-muted">{stat.label}</span>
                </div>
                <span className="text-sm font-mono font-medium text-pf-text">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Chart + Order Book */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart */}
            <div className="lg:col-span-2 bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-pf-text">Price History &mdash; YES</span>
                <div className="flex gap-1">
                  {(['1m', '1h', '1d'] as Resolution[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => onResolutionChange(r)}
                      className={`px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors ${
                        resolution === r
                          ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                          : 'text-pf-text-muted hover:text-pf-text-secondary'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72">
                {loadingChart ? (
                  <div className="h-full bg-pf-overlay rounded-pf animate-pulse" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={cyan500} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={cyan500} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: textMuted }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 1]}
                        tick={{ fontSize: 10, fill: textMuted }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v.toFixed(2)}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          background: bgElevated,
                          border: `1px solid ${borderColor}`,
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                        labelStyle={{ color: textSecondary }}
                        itemStyle={{ color: cyan500 }}
                        formatter={(value: number) => [value.toFixed(3), 'YES']}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke={cyan500}
                        strokeWidth={1.5}
                        fill="url(#cyanGrad)"
                        dot={false}
                        activeDot={{ r: 3, fill: cyan500 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-pf-text-muted text-sm">
                    <TrendingUp className="size-8 opacity-20 mb-2" />
                    Price chart coming soon
                  </div>
                )}
              </div>
            </div>

            {/* Order Book */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-pf-text">Order Book</span>
                {orderBook && (
                  <span className="font-mono text-[11px] text-pf-text-muted">
                    spread {orderBook.spread}
                  </span>
                )}
              </div>

              {loadingBook ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-6 bg-pf-overlay rounded animate-pulse" />
                  ))}
                </div>
              ) : orderBook ? (
                <div className="space-y-0">
                  {/* Asks (reversed) */}
                  <div className="space-y-px">
                    {orderBook.asks
                      .slice(0, 8)
                      .reverse()
                      .map((ask, idx, arr) => (
                        <div key={`ask-${idx}`} className="relative flex items-center h-6 px-2 text-xs">
                          <div
                            className="absolute inset-y-0 right-0 bg-pf-danger/8 rounded-sm"
                            style={{ width: `${bookDepth(orderBook.asks.slice(0, 8), arr.length - 1 - idx)}%` }}
                          />
                          <span className="relative font-mono text-pf-danger w-16">{ask.price}</span>
                          <span className="relative font-mono text-pf-text-muted ml-auto">{ask.size}</span>
                        </div>
                      ))}
                  </div>

                  {/* Midpoint */}
                  <div className="flex items-center gap-2 px-2 py-1.5 border-y border-pf-border-subtle my-1">
                    <span className="font-mono text-sm text-pf-text font-medium">{orderBook.midpoint}</span>
                    <span className="text-[11px] text-pf-text-muted">mid</span>
                  </div>

                  {/* Bids */}
                  <div className="space-y-px">
                    {orderBook.bids.slice(0, 8).map((bid, idx) => (
                      <div key={`bid-${idx}`} className="relative flex items-center h-6 px-2 text-xs">
                        <div
                          className="absolute inset-y-0 right-0 bg-pf-success/8 rounded-sm"
                          style={{ width: `${bookDepth(orderBook.bids.slice(0, 8), idx)}%` }}
                        />
                        <span className="relative font-mono text-pf-success w-16">{bid.price}</span>
                        <span className="relative font-mono text-pf-text-muted ml-auto">{bid.size}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-pf-text-muted">No book data</div>
              )}
            </div>
          </div>

          {/* Strategies on this market */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
            <h3 className="text-sm font-medium text-pf-text mb-4">Strategies on This Market</h3>
            <div className="flex flex-col items-center py-6 text-center">
              <Zap className="size-6 text-pf-text-muted mb-2" />
              <p className="text-sm text-pf-text-muted">No strategies running on this market yet.</p>
              <button
                onClick={() => setShowRunStrategy(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:border-pf-border-strong transition-colors"
              >
                <Play className="size-3" /> Run Strategy
              </button>
            </div>
          </div>

          {/* Description */}
          {market.description && (
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
              <h3 className="text-sm font-medium text-pf-text mb-2">About</h3>
              <p className="text-sm text-pf-text-secondary leading-relaxed">{market.description}</p>
            </div>
          )}

          {/* Run Strategy Dialog */}
          {showRunStrategy && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Run Strategy">
              <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-md p-6 shadow-pf-lg">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-pf-text">Run Strategy on This Market</h2>
                  <button
                    onClick={() => setShowRunStrategy(false)}
                    aria-label="Close dialog"
                    className="p-1 rounded text-pf-text-muted hover:text-pf-text transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-pf-text-secondary mb-1.5">
                      Select Strategy
                    </label>
                    <select
                      value={selectedStrategyId}
                      onChange={(e) => setSelectedStrategyId(e.target.value)}
                      className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
                    >
                      <option value="">Choose a strategy...</option>
                      {strategyOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-center text-xs text-pf-text-muted">or</div>

                  <Link
                    to="/strategies/new"
                    onClick={() => setShowRunStrategy(false)}
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-pf border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong transition-colors"
                  >
                    <Plus className="size-4" /> Create New Strategy
                  </Link>

                  <div className="flex gap-2 justify-end pt-3 border-t border-pf-border-subtle">
                    <button
                      onClick={() => setShowRunStrategy(false)}
                      className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onStartStrategy}
                      disabled={!selectedStrategyId}
                      className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-success text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      <Play className="size-3.5" /> Start Strategy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
