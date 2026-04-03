import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { Button, Input, Select } from '@polyforge/ui';
import { wsManager, WebSocketManager } from '@/lib/websocket';
import { useAuthStore } from '@/stores/auth-store';
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
  Newspaper,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Users,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Bell,
  BellPlus,
  Trash2,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Line,
  Bar,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface MarketToken {
  id: string;
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

interface HistoryPoint {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
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

interface RelatedNewsSignal {
  id: string;
  articleId: string;
  articleTitle: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  reasoning: string;
}

interface RelatedNewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  signals?: Array<{ marketId: string; direction: string; confidence: number }>;
}

interface SentimentData {
  yesPercent: number;
  noPercent: number;
  totalVotes: number;
  userVote: { direction: 'YES' | 'NO'; confidence: number } | null;
}

interface PriceAlert {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  condition: 'above' | 'below';
  threshold: number; // 0.01 – 0.99
  triggered: boolean;
  createdAt: string;
}

type Resolution = '1m' | '1h' | '1d';

interface DepthLevel {
  price: number;
  bidCumSize: number | null;
  askCumSize: number | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatVolume(vol: string): string {
  const v = parseFloat(vol);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function totalLiquidity(tokens: MarketToken[] | undefined): string {
  if (!tokens) return '$0';
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

function depthColor(pct: number, side: 'ask' | 'bid'): string {
  // pct is 0-100
  if (side === 'ask') {
    if (pct > 66) return 'rgba(239,68,68,0.35)';  // deep red
    if (pct > 33) return 'rgba(239,68,68,0.20)';  // medium red
    return 'rgba(239,68,68,0.10)';                  // light red
  } else {
    if (pct > 66) return 'rgba(34,197,94,0.35)';  // deep green
    if (pct > 33) return 'rgba(34,197,94,0.20)';  // medium green
    return 'rgba(34,197,94,0.10)';                  // light green
  }
}

function buildDepthData(bids: OrderBookEntry[], asks: OrderBookEntry[]): DepthLevel[] {
  // Sort bids descending by price, compute cumulative from best bid outward
  const sortedBids = [...bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  // Sort asks ascending by price, compute cumulative from best ask outward
  const sortedAsks = [...asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  // Build bid cumulative map: lower prices accumulate more depth
  const bidPoints: { price: number; cumSize: number }[] = [];
  let bidCum = 0;
  for (const entry of sortedBids) {
    bidCum += parseFloat(entry.size);
    bidPoints.push({ price: parseFloat(entry.price), cumSize: bidCum });
  }
  // Bids display with the deepest cumulative at the lowest price — reverse so
  // chart reads left-to-right (lowest price = max depth on bid side)
  bidPoints.reverse();

  // Build ask cumulative map: higher prices accumulate more depth
  const askPoints: { price: number; cumSize: number }[] = [];
  let askCum = 0;
  for (const entry of sortedAsks) {
    askCum += parseFloat(entry.size);
    askPoints.push({ price: parseFloat(entry.price), cumSize: askCum });
  }

  // Merge all price points into a single sorted array
  const priceSet = new Map<number, DepthLevel>();

  for (const bp of bidPoints) {
    priceSet.set(bp.price, { price: bp.price, bidCumSize: bp.cumSize, askCumSize: null });
  }
  for (const ap of askPoints) {
    const existing = priceSet.get(ap.price);
    if (existing) {
      existing.askCumSize = ap.cumSize;
    } else {
      priceSet.set(ap.price, { price: ap.price, bidCumSize: null, askCumSize: ap.cumSize });
    }
  }

  return Array.from(priceSet.values()).sort((a, b) => a.price - b.price);
}

function formatDepthSize(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
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
  const { user } = useAuthStore();
  const isWalletConnected = user?.polymarketConnected === true;

  // Live prices updated via WebSocket PRICE_UPDATE events
  const [livePrices, setLivePrices] = useState<Record<string, string>>({});

  // Read CSS variables for Recharts (which needs raw color strings) — memoized to avoid layout thrashing
  const themeColors = useMemo(() => {
    const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    return {
      textMuted: s?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A',
      bgElevated: s?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E',
      borderColor: s?.getPropertyValue('--color-pf-border').trim() || '#1E3350',
      textSecondary: s?.getPropertyValue('--color-pf-text-secondary').trim() || '#7A94B4',
      cyan500: s?.getPropertyValue('--color-pf-cyan-500').trim() || '#06B6D4',
    };
  }, []);
  const { textMuted, bgElevated, borderColor, textSecondary, cyan500 } = themeColors;

  const [market, setMarket] = useState<Market | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);

  const [chartData, setChartData] = useState<{ time: string; close: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [resolution, setResolution] = useState<Resolution>('1h');

  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [orderBookView, setOrderBookView] = useState<'table' | 'chart'>('table');

  const [showRunStrategy, setShowRunStrategy] = useState(false);
  const [strategyOptions, setStrategyOptions] = useState<StrategyOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');

  // Conditional order dialog state
  const [showConditional, setShowConditional] = useState(false);
  const [condType, setCondType] = useState<'TAKE_PROFIT' | 'STOP_LOSS'>('TAKE_PROFIT');
  const [condOutcome, setCondOutcome] = useState<'YES' | 'NO'>('YES');
  const [condSize, setCondSize] = useState('');
  const [condTriggerPrice, setCondTriggerPrice] = useState('');
  const [condSubmitting, setCondSubmitting] = useState(false);

  const [relatedNews, setRelatedNews] = useState<RelatedNewsSignal[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);

  const [relatedNewsArticles, setRelatedNewsArticles] = useState<RelatedNewsArticle[]>([]);
  const [loadingNewsArticles, setLoadingNewsArticles] = useState(true);

  // Trade panel state
  const [tradeOutcome, setTradeOutcome] = useState<'YES' | 'NO'>('YES');
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [isMarketOrder, setIsMarketOrder] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [myOrders, setMyOrders] = useState<Array<{ id: string; side: string; outcome: string; size: string; price: string; status: string }>>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);

  // Price History chart state
  const [historyPeriod, setHistoryPeriod] = useState<'7d' | '30d' | 'allTime'>('7d');
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Kelly sizer state
  const [kellyConfidence, setKellyConfidence] = useState(65);
  const [portfolioBalance, setPortfolioBalance] = useState<number>(1000);

  // Price alerts state
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertOutcome, setAlertOutcome] = useState<'YES' | 'NO'>('YES');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertThreshold, setAlertThreshold] = useState(0.60);
  const [savingAlert, setSavingAlert] = useState(false);

  // LP Provide Liquidity state
  const [lpExpanded, setLpExpanded] = useState(false);
  const [lpTokenId, setLpTokenId] = useState('');
  const [lpSpread, setLpSpread] = useState('0.02');
  const [lpSize, setLpSize] = useState('10');
  const [lpSubmitting, setLpSubmitting] = useState(false);
  const [lpError, setLpError] = useState('');

  // Community Sentiment state
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selectedDir, setSelectedDir] = useState<'YES' | 'NO' | null>(null);
  const [confidence, setConfidence] = useState(75);
  const [editingVote, setEditingVote] = useState(false);

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
                  ? new Date(d.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  : res === '1h'
                    ? new Date(d.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              close: parseFloat(d.close),
            })),
          );
          setLoadingChart(false);
        })
        .catch(() => { toast.error('Failed to load chart data'); setChartData([]); setLoadingChart(false); });
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
    const yesToken = (market.tokens ?? []).find((t) => t.outcome?.toUpperCase() === 'YES');
    if (yesToken) {
      loadChart(yesToken.id, resolution);
      loadBook(yesToken.id);
    }
    return () => { cancelled = true; };
  }, [market, resolution, loadChart, loadBook]);

  // Auto-refresh order book every 30s
  useEffect(() => {
    if (!market) return;
    const yesToken = (market.tokens ?? []).find((t) => t.outcome?.toUpperCase() === 'YES');
    if (!yesToken) return;
    const interval = setInterval(() => { loadBook(yesToken.id); }, 30_000);
    return () => clearInterval(interval);
  }, [market, loadBook]);

  // Load related news signals
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingNews(true);
    fetch(`/api/v1/news/signals?marketId=${id}&limit=3`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { data: RelatedNewsSignal[] }) => {
        if (!cancelled) { setRelatedNews(data?.data ?? []); setLoadingNews(false); }
      })
      .catch(() => { if (!cancelled) setLoadingNews(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Load related news articles
  useEffect(() => {
    if (!market?.id) return;
    let cancelled = false;
    setLoadingNewsArticles(true);
    fetch(`/api/v1/news?marketId=${market.id}&limit=5`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { data: RelatedNewsArticle[] }) => {
        if (!cancelled) { setRelatedNewsArticles(data?.data ?? []); setLoadingNewsArticles(false); }
      })
      .catch(() => { if (!cancelled) { toast.error('Failed to load related news'); setLoadingNewsArticles(false); } });
    return () => { cancelled = true; };
  }, [market?.id]);

  // Load price history for the new chart
  useEffect(() => {
    if (!market?.id) return;
    let cancelled = false;
    setLoadingHistory(true);
    fetch(`/api/v1/markets/${market.id}/history?period=${historyPeriod}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((result: { data: HistoryPoint[] }) => {
        if (!cancelled) {
          setHistoryData(result?.data ?? []);
          setLoadingHistory(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setHistoryData([]); setLoadingHistory(false); }
      });
    return () => { cancelled = true; };
  }, [market?.id, historyPeriod]);

  // When resolution changes
  function onResolutionChange(res: Resolution) {
    setResolution(res);
    const yesToken = (market?.tokens ?? []).find((t) => t.outcome?.toUpperCase() === 'YES');
    if (yesToken) loadChart(yesToken.id, res);
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

  function openConditional(type: 'TAKE_PROFIT' | 'STOP_LOSS', outcome: 'YES' | 'NO') {
    setCondType(type);
    setCondOutcome(outcome);
    setCondSize('');
    setCondTriggerPrice('');
    setShowConditional(true);
  }

  async function submitConditional() {
    if (!market || !condSize || !condTriggerPrice) return;
    setCondSubmitting(true);
    const token = (market.tokens ?? []).find((t) => t.outcome?.toUpperCase() === condOutcome);
    if (!token) { setCondSubmitting(false); return; }
    try {
      const res = await fetch('/api/v1/orders/conditional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          marketId: market.id,
          tokenId: token.id,
          type: condType,
          side: 'BUY',
          outcome: condOutcome,
          size: condSize,
          triggerPrice: condTriggerPrice,
        }),
      });
      if (res.ok) {
        toast.success(`${condType === 'TAKE_PROFIT' ? 'Take Profit' : 'Stop Loss'} order created`);
        setShowConditional(false);
      } else {
        toast.error('Failed to create conditional order');
      }
    } catch {
      toast.error('Failed to create conditional order');
    }
    setCondSubmitting(false);
  }

  // Trade panel: load my orders
  const loadMyOrders = useCallback(async () => {
    if (!id) return;
    setLoadingMyOrders(true);
    try {
      const res = await fetch(`/api/v1/orders?marketId=${id}&status=PENDING,LIVE,SUBMITTED&limit=20`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data.data || data || []);
      }
    } catch {} finally {
      setLoadingMyOrders(false);
    }
  }, [id]);

  useEffect(() => { loadMyOrders(); }, [loadMyOrders]);

  // Fetch portfolio balance for Kelly sizer
  useEffect(() => {
    fetch('/api/v1/portfolio', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.balance) setPortfolioBalance(parseFloat(d.balance)); })
      .catch(() => {});
  }, []);

  // Load price alerts for this market
  const loadAlerts = useCallback(async () => {
    if (!market?.id) return;
    setLoadingAlerts(true);
    try {
      const r = await fetch(`/api/v1/markets/${market.id}/alerts`, { credentials: 'include' });
      if (r.ok) {
        const data: { data: PriceAlert[] } = await r.json();
        setAlerts(data.data ?? []);
      }
    } catch {} finally {
      setLoadingAlerts(false);
    }
  }, [market?.id]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);


  // Real-time order updates via WebSocket
  useEffect(() => {
    const handler = (msg: { type: string; orderId?: string; data?: Record<string, unknown> }) => {
      if (!WebSocketManager.isOrderEvent(msg)) return;
      loadMyOrders();
      const orderId = msg.orderId ?? (msg.data?.orderId as string | undefined);
      const id = orderId?.slice(0, 8);
      if (msg.type === 'ORDER_FILLED') toast.success(`Order filled${id ? ` · ${id}…` : ''}`);
      if (msg.type === 'ORDER_CANCELLED') toast.info('Order cancelled');
      if (msg.type === 'ORDER_FAILED') toast.error('Order failed');
    };
    wsManager.addListener(handler);
    return () => wsManager.removeListener(handler);
  }, [loadMyOrders]);

  // Real-time price updates via WebSocket
  useEffect(() => {
    if (!market) return;
    const tokenIds = (market.tokens ?? []).map((t) => t.id);
    if (tokenIds.length > 0) wsManager.subscribePrices(tokenIds);

    const priceHandler = (msg: { type: string; tokenId?: string; price?: number; data?: Record<string, unknown> }) => {
      if (!WebSocketManager.isPriceUpdate(msg)) return;
      const tokenId = msg.tokenId ?? (msg.data?.tokenId as string | undefined);
      const price = msg.price ?? (msg.data?.price as number | undefined);
      if (!tokenId || price === undefined) return;
      setLivePrices((prev) => ({ ...prev, [tokenId]: String(price) }));
    };
    wsManager.addListener(priceHandler);

    return () => {
      wsManager.removeListener(priceHandler);
      if (tokenIds.length > 0) wsManager.unsubscribePrices(tokenIds);
    };
  }, [market]);

  // Price alert notifications via WebSocket
  useEffect(() => {
    const notifHandler = (msg: { type: string; data?: any }) => {
      if (msg.type !== 'NOTIFICATION') return;
      const payload = (msg as any).data ?? msg;
      if (payload?.type === 'PRICE_ALERT') {
        toast.info(payload.message ?? 'Price alert triggered', { duration: 6000 });
        // Remove the triggered alert from local state
        if (payload.alertId) {
          setAlerts((prev) => prev.filter((a) => a.id !== payload.alertId));
        }
      }
    };
    wsManager.addListener(notifHandler);
    return () => wsManager.removeListener(notifHandler);
  }, []);

  // Trade panel: pre-fill price when market loads
  useEffect(() => {
    if (!market) return;
    const token = (market.tokens ?? []).find((t) => t.outcome?.toUpperCase() === tradeOutcome);
    if (token?.price && !tradePrice) {
      setTradePrice(token.price);
    }
  }, [market, tradeOutcome]);

  // LP: pre-select first token when market loads
  useEffect(() => {
    if (!market || lpTokenId) return;
    const first = (market.tokens ?? [])[0];
    if (first) setLpTokenId(first.id);
  }, [market, lpTokenId]);

  // Load community sentiment
  useEffect(() => {
    if (!market?.id) return;
    let cancelled = false;
    setLoadingSentiment(true);
    fetch(`/api/v1/markets/${market.id}/sentiment`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data: SentimentData | null) => {
        if (!cancelled) {
          setSentiment(data);
          setLoadingSentiment(false);
        }
      })
      .catch(() => { if (!cancelled) setLoadingSentiment(false); });
    return () => { cancelled = true; };
  }, [market?.id]);

  const submitVote = async () => {
    if (!market?.id || !selectedDir) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/v1/markets/${market.id}/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ direction: selectedDir, confidence }),
      });
      if (res.ok) {
        const updated: SentimentData = await res.json();
        setSentiment(updated);
        setEditingVote(false);
        toast.success('Vote recorded!');
      } else {
        toast.error('Failed to submit vote');
      }
    } catch {
      toast.error('Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  const submitLp = async () => {
    if (!lpTokenId || !lpSpread || !lpSize) return;
    setLpSubmitting(true);
    setLpError('');
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch('/api/v1/lp/provide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          tokenId: lpTokenId,
          spread: parseFloat(lpSpread),
          size: parseFloat(lpSize),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { message?: string }).message || 'Failed to provide liquidity');
      }
      toast.success('Liquidity provided successfully');
      setLpExpanded(false);
      setLpSpread('0.02');
      setLpSize('10');
    } catch (e: unknown) {
      setLpError(e instanceof Error ? e.message : 'Failed to provide liquidity');
    } finally {
      setLpSubmitting(false);
    }
  };

  const placeOrder = async () => {
    if (!tradeAmount || (!isMarketOrder && !tradePrice)) return;
    setPlacingOrder(true);
    setTradeError('');
    setTradeSuccess('');
    try {
      const token = market?.tokens?.find((t) =>
        t.outcome?.toUpperCase() === tradeOutcome
      );
      if (!token) throw new Error('Token not found for ' + tradeOutcome);

      const res = await fetch('/api/v1/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tokenId: token.id,
          side: tradeSide,
          outcome: tradeOutcome,
          size: parseFloat(tradeAmount),
          price: isMarketOrder ? (tradeSide === 'BUY' ? 0.999 : 0.001) : parseFloat(tradePrice),
          orderType: isMarketOrder ? 'FOK' : 'GTC',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Order failed');
      setTradeSuccess(`Order placed (${data.orderId.slice(0, 8)}...)`);
      setTradeAmount('');
      loadMyOrders();
    } catch (err: unknown) {
      setTradeError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setPlacingOrder(false);
    }
  };

  const cancelMyOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) loadMyOrders();
    } catch {}
  };

  const estPrice = isMarketOrder ? (tradeSide === 'BUY' ? 0.999 : 0.001) : parseFloat(tradePrice) || 0;
  const estShares = estPrice > 0 ? parseFloat(tradeAmount || '0') / estPrice : 0;
  const estCost = parseFloat(tradeAmount || '0');
  const estPayout = estShares * 1.0;

  const yesToken = (market?.tokens ?? []).find((t) => t.outcome?.toUpperCase() === 'YES');
  const noToken = (market?.tokens ?? []).find((t) => t.outcome?.toUpperCase() === 'NO');
  const yesPrice = (yesToken && livePrices[yesToken.id]) ? livePrices[yesToken.id] : (yesToken?.price ?? null);
  const noPrice = (noToken && livePrices[noToken.id]) ? livePrices[noToken.id] : (noToken?.price ?? null);
  const days = market ? daysUntil(market.endDate) : 0;

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Back */}
      <Link
        to="/markets"
        className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Markets
      </Link>

      {loadingMarket && <DetailSkeleton />}

      {!loadingMarket && !market && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-pf-text font-medium text-lg">Market not found</p>
          <p className="text-sm text-pf-text-muted mt-1">
            This market may have been removed or the link is incorrect.
          </p>
          <Button
            type="button"
            onClick={() => navigate('/markets')}
            className="mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors"
          >
            Back to Markets
          </Button>
        </div>
      )}

      {!loadingMarket && market ? (
        <>
          {/* Market header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-pf-full bg-pf-cyan-500/15 text-pf-cyan-400 text-xs font-medium">
                  {market.category}
                </span>
                {days >= 0 && days <= 7 && (
                  <span className="px-2 py-0.5 rounded-pf-full bg-pf-warning/15 text-pf-warning text-xs font-medium">
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

            {/* Price pills + TP/SL + Run Strategy */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-shrink-0">
              <div className="flex gap-2">
                <div className="flex flex-col items-center px-4 py-2 rounded-pf-md bg-pf-success/10 border border-pf-success/20">
                  <span className="text-[10px] uppercase tracking-wide text-pf-success/70">YES</span>
                  <span className="text-lg font-mono font-semibold text-pf-success">
                    {yesPrice ?? '\u2014'}
                  </span>
                  <div className="flex gap-1 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openConditional('TAKE_PROFIT', 'YES')}
                      aria-label="Set take profit for YES"
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-success/20 text-pf-success hover:bg-pf-success/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                    >
                      TP
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openConditional('STOP_LOSS', 'YES')}
                      aria-label="Set stop loss for YES"
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-danger/20 text-pf-danger hover:bg-pf-danger/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                    >
                      SL
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-center px-4 py-2 rounded-pf-md bg-pf-danger/10 border border-pf-danger/20">
                  <span className="text-[10px] uppercase tracking-wide text-pf-danger/70">NO</span>
                  <span className="text-lg font-mono font-semibold text-pf-danger">
                    {noPrice ?? '\u2014'}
                  </span>
                  <div className="flex gap-1 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openConditional('TAKE_PROFIT', 'NO')}
                      aria-label="Set take profit for NO"
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-success/20 text-pf-success hover:bg-pf-success/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                    >
                      TP
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openConditional('STOP_LOSS', 'NO')}
                      aria-label="Set stop loss for NO"
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-pf-danger/20 text-pf-danger hover:bg-pf-danger/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                    >
                      SL
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="success"
                onClick={() => setShowRunStrategy(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-success text-white text-sm font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-success/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-base"
              >
                <Play className="size-4" /> Run Strategy
              </Button>
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

          {/* Price History Chart */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-pf-border">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-pf-text">Price History</span>
                {yesPrice && (
                  <span className="px-2 py-0.5 rounded-pf-full bg-pf-success/10 border border-pf-success/20 text-[11px] font-mono text-pf-success">
                    YES {yesPrice}
                  </span>
                )}
                {noPrice && (
                  <span className="px-2 py-0.5 rounded-pf-full bg-pf-danger/10 border border-pf-danger/20 text-[11px] font-mono text-pf-danger">
                    NO {noPrice}
                  </span>
                )}
              </div>
              {/* Period tabs */}
              <div className="flex gap-1">
                {(['7d', '30d', 'allTime'] as const).map((p) => (
                  <Button
                    type="button"
                    variant="ghost"
                    key={p}
                    onClick={() => setHistoryPeriod(p)}
                    aria-pressed={historyPeriod === p}
                    className={`px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 ${
                      historyPeriod === p
                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                        : 'bg-pf-elevated text-pf-text-muted hover:text-pf-text-secondary'
                    }`}
                  >
                    {p === 'allTime' ? 'All' : p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Chart body */}
            <div className="px-4 py-3">
              {loadingHistory ? (
                <div className="h-52 flex items-center justify-center">
                  <div className="h-full w-full bg-pf-overlay rounded-pf animate-pulse" />
                </div>
              ) : historyData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-pf-text-muted text-sm">
                  <TrendingUp className="size-8 opacity-20 mb-2" />
                  No price history available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={208}>
                  <ComposedChart data={historyData.map((d) => ({
                    ...d,
                    label: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={borderColor} strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: textMuted }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    {/* Left Y-axis: prices 0–1 */}
                    <YAxis
                      yAxisId="price"
                      domain={[0, 1]}
                      tick={{ fontSize: 10, fill: textMuted }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v.toFixed(2)}
                      width={36}
                    />
                    {/* Right Y-axis: volume */}
                    <YAxis
                      yAxisId="volume"
                      orientation="right"
                      tick={{ fontSize: 10, fill: textMuted }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`}
                      width={44}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const yes = payload.find((p) => p.dataKey === 'yesPrice')?.value as number | undefined;
                        const no = payload.find((p) => p.dataKey === 'noPrice')?.value as number | undefined;
                        const vol = payload.find((p) => p.dataKey === 'volume')?.value as number | undefined;
                        return (
                          <div className="bg-pf-surface border border-pf-border rounded px-3 py-2 text-xs">
                            <p className="text-pf-text-secondary mb-1">{label}</p>
                            {yes !== undefined && <p className="text-pf-cyan-400">YES: {Math.round(yes * 100)}¢</p>}
                            {no !== undefined && <p className="text-pf-text-muted">NO: {Math.round(no * 100)}¢</p>}
                            {vol !== undefined && (
                              <p className="text-pf-text-secondary mt-0.5">
                                Vol: ${vol >= 1000 ? `${(vol / 1000).toFixed(1)}K` : vol.toFixed(0)}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, color: textSecondary, paddingTop: 4 }}
                      formatter={(value: string) => value === 'yesPrice' ? 'YES' : value === 'noPrice' ? 'NO' : 'Volume'}
                    />
                    {/* Volume bars */}
                    <Bar yAxisId="volume" dataKey="volume" fill="#06b6d4" opacity={0.15} name="volume" />
                    {/* YES price line */}
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="yesPrice"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: '#06b6d4' }}
                      name="yesPrice"
                    />
                    {/* NO price line */}
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="noPrice"
                      stroke="#6b7280"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={false}
                      activeDot={{ r: 3, fill: '#6b7280' }}
                      name="noPrice"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart + Order Book */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart */}
            <div className="lg:col-span-2 bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-pf-text">Price History &mdash; YES</span>
                <div className="flex gap-1">
                  {(['1m', '1h', '1d'] as Resolution[]).map((r) => (
                    <Button
                      type="button"
                      variant="ghost"
                      key={r}
                      onClick={() => onResolutionChange(r)}
                      aria-pressed={resolution === r}
                      className={`px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 ${
                        resolution === r
                          ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                          : 'text-pf-text-muted hover:text-pf-text-secondary'
                      }`}
                    >
                      {r}
                    </Button>
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
                    No price data available for this resolution
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const yesToken = (market?.tokens ?? []).find((t) => t.outcome?.toUpperCase() === 'YES');
                        if (yesToken) loadChart(yesToken.id, resolution);
                      }}
                      className="mt-2 px-3 py-1 rounded-pf text-xs bg-pf-overlay hover:bg-pf-border transition-colors"
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Order Book + Trade Panel */}
            <div className="space-y-4">
            {/* Order Book */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-pf-text">Order Book</span>
                <div className="flex items-center gap-2">
                  {orderBook && (
                    <span className="font-mono text-[11px] text-pf-text-muted">
                      spread {orderBook.spread}
                    </span>
                  )}
                  {/* Table / Chart toggle */}
                  <div className="flex rounded-pf-sm overflow-hidden border border-pf-border" role="group" aria-label="Order book view">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOrderBookView('table')}
                      aria-pressed={orderBookView === 'table'}
                      className={`px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 ${
                        orderBookView === 'table'
                          ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                          : 'bg-transparent text-pf-text-muted hover:text-pf-text-secondary'
                      }`}
                    >
                      Table
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOrderBookView('chart')}
                      aria-pressed={orderBookView === 'chart'}
                      className={`px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 border-l border-pf-border ${
                        orderBookView === 'chart'
                          ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                          : 'bg-transparent text-pf-text-muted hover:text-pf-text-secondary'
                      }`}
                    >
                      Chart
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const yesToken = (market?.tokens ?? []).find((t) => t.outcome === 'YES');
                      if (yesToken) loadBook(yesToken.id);
                    }}
                    className="p-1 rounded text-pf-text-muted hover:text-pf-text hover:bg-pf-overlay transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                    aria-label="Refresh order book"
                    title="Refresh book"
                  >
                    <RefreshCw size={12} />
                  </Button>
                </div>
              </div>

              {/* Bid/Ask depth ratio bar — shown in both views */}
              {orderBook && !loadingBook && (() => {
                const totalBid = orderBook.bids.reduce((s, e) => s + parseFloat(e.size), 0);
                const totalAsk = orderBook.asks.reduce((s, e) => s + parseFloat(e.size), 0);
                const total = totalBid + totalAsk;
                const bidPct = total > 0 ? (totalBid / total) * 100 : 50;
                const askPct = 100 - bidPct;
                return (
                  <div className="mb-3">
                    <div className="flex h-1.5 rounded-pf-full overflow-hidden">
                      <div className="bg-pf-success/50" style={{ width: `${bidPct}%` }} title={`Bids: ${bidPct.toFixed(0)}%`} />
                      <div className="bg-pf-danger/50 flex-1" title={`Asks: ${askPct.toFixed(0)}%`} />
                    </div>
                    <div className="flex justify-between text-[10px] text-pf-text-muted mt-0.5">
                      <span>Bid {bidPct.toFixed(0)}%</span>
                      <span>Ask {askPct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}

              {loadingBook ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-6 bg-pf-overlay rounded animate-pulse" />
                  ))}
                </div>
              ) : orderBook ? (
                orderBookView === 'table' ? (
                  /* ── Table view (existing) ── */
                  <div className="space-y-0">
                    {/* Asks (reversed) */}
                    <div className="space-y-px">
                      {orderBook.asks
                        .slice(0, 8)
                        .reverse()
                        .map((ask, idx, arr) => (
                          <div key={`ask-${idx}`} className="relative flex items-center h-6 px-2 text-xs">
                            <div
                              className="absolute inset-y-0 right-0 rounded-sm"
                              style={{ width: `${bookDepth(orderBook.asks.slice(0, 8), arr.length - 1 - idx)}%`, backgroundColor: depthColor(bookDepth(orderBook.asks.slice(0, 8), arr.length - 1 - idx), 'ask') }}
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
                            className="absolute inset-y-0 right-0 rounded-sm"
                            style={{ width: `${bookDepth(orderBook.bids.slice(0, 8), idx)}%`, backgroundColor: depthColor(bookDepth(orderBook.bids.slice(0, 8), idx), 'bid') }}
                          />
                          <span className="relative font-mono text-pf-success w-16">{bid.price}</span>
                          <span className="relative font-mono text-pf-text-muted ml-auto">{bid.size}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ── Depth chart view ── */
                  (() => {
                    const depthData = buildDepthData(orderBook.bids, orderBook.asks);
                    const midPrice = parseFloat(orderBook.midpoint);
                    const isEmpty = orderBook.bids.length === 0 && orderBook.asks.length === 0;
                    if (isEmpty) {
                      return (
                        <div className="h-52 bg-pf-overlay rounded-pf animate-pulse" />
                      );
                    }
                    return (
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={depthData}
                            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                          >
                            <defs>
                              <linearGradient id="bidDepthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-pf-success)" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="var(--color-pf-success)" stopOpacity={0.05} />
                              </linearGradient>
                              <linearGradient id="askDepthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-pf-danger)" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="var(--color-pf-danger)" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="price"
                              type="number"
                              domain={[0, 1]}
                              tick={{ fontSize: 10, fill: textMuted }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v: number) => v.toFixed(2)}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: textMuted }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatDepthSize}
                              width={36}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload as DepthLevel;
                                const bestBidPrice = orderBook.bids.length > 0
                                  ? Math.max(...orderBook.bids.map(b => parseFloat(b.price)))
                                  : null;
                                const bestAskPrice = orderBook.asks.length > 0
                                  ? Math.min(...orderBook.asks.map(a => parseFloat(a.price)))
                                  : null;
                                const spread = bestBidPrice !== null && bestAskPrice !== null
                                  ? (bestAskPrice - bestBidPrice).toFixed(4)
                                  : null;
                                return (
                                  <div className="bg-pf-surface border border-pf-border rounded px-3 py-2 text-xs shadow-pf-md">
                                    <p className="text-pf-text-secondary mb-1 font-mono">
                                      Price: {d.price.toFixed(4)}
                                    </p>
                                    {d.bidCumSize !== null && (
                                      <p className="text-pf-success">
                                        Bid depth: {formatDepthSize(d.bidCumSize)} USDC
                                      </p>
                                    )}
                                    {d.askCumSize !== null && (
                                      <p className="text-pf-danger">
                                        Ask depth: {formatDepthSize(d.askCumSize)} USDC
                                      </p>
                                    )}
                                    {spread !== null && Math.abs(d.price - midPrice) < 0.01 && (
                                      <p className="text-pf-text-muted mt-0.5">
                                        Spread: {spread}
                                      </p>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            {/* Bid area */}
                            <Area
                              type="stepAfter"
                              dataKey="bidCumSize"
                              stroke="var(--color-pf-success)"
                              strokeWidth={1.5}
                              fill="url(#bidDepthGrad)"
                              dot={false}
                              connectNulls={false}
                              activeDot={{ r: 3, fill: 'var(--color-pf-success)', stroke: 'none' }}
                              isAnimationActive={false}
                            />
                            {/* Ask area */}
                            <Area
                              type="stepBefore"
                              dataKey="askCumSize"
                              stroke="var(--color-pf-danger)"
                              strokeWidth={1.5}
                              fill="url(#askDepthGrad)"
                              dot={false}
                              connectNulls={false}
                              activeDot={{ r: 3, fill: 'var(--color-pf-danger)', stroke: 'none' }}
                              isAnimationActive={false}
                            />
                            {/* Mid-price reference line */}
                            {!isNaN(midPrice) && (
                              <ReferenceLine
                                x={midPrice}
                                stroke={textSecondary}
                                strokeDasharray="3 3"
                                strokeWidth={1}
                                label={{
                                  value: midPrice.toFixed(3),
                                  position: 'top',
                                  fontSize: 9,
                                  fill: textSecondary,
                                }}
                              />
                            )}
                          </AreaChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 mt-1">
                          <div className="flex items-center gap-1">
                            <span className="inline-block size-2 rounded-pf-full bg-pf-success" aria-hidden="true" />
                            <span className="text-[10px] text-pf-text-muted">Bids</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="inline-block size-2 rounded-pf-full bg-pf-danger" aria-hidden="true" />
                            <span className="text-[10px] text-pf-text-muted">Asks</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-3 border-t border-dashed border-pf-text-secondary" aria-hidden="true" />
                            <span className="text-[10px] text-pf-text-muted">Mid</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )
              ) : (
                <div className="py-8 text-center text-sm text-pf-text-muted">No book data</div>
              )}
            </div>

            {/* Trade Panel */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <span className="text-sm font-medium text-pf-text">Trade</span>

              {/* Wallet not connected — prompt user */}
              {!isWalletConnected && (
                <div className="mt-3 flex flex-col items-center gap-2 py-5 px-3 rounded-pf bg-pf-overlay border border-pf-border text-center">
                  <svg className="size-8 text-pf-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L2 7h20l-6-4z"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/></svg>
                  <p className="text-sm font-medium text-pf-text">Connect your wallet to trade</p>
                  <p className="text-xs text-pf-text-muted">Link your Polymarket account to place orders</p>
                  <Link
                    to="/settings/trading-account"
                    className="mt-1 px-4 py-2 rounded-pf bg-pf-cyan-500 text-pf-text-contrast text-xs font-semibold hover:bg-pf-cyan-400 transition-colors"
                  >
                    Connect Wallet
                  </Link>
                </div>
              )}

              {/* Trade form — hidden when wallet not connected */}
              {isWalletConnected && <>

              {/* Outcome toggle */}
              <div className="flex gap-1 mt-3">
                {(['YES', 'NO'] as const).map((o) => (
                  <Button
                    type="button"
                    variant="ghost"
                    key={o}
                    onClick={() => {
                      setTradeOutcome(o);
                      const token = (market?.tokens ?? []).find((t) => t.outcome?.toUpperCase() === o);
                      if (token?.price) setTradePrice(token.price);
                    }}
                    className={`flex-1 py-1.5 rounded-pf-sm text-xs font-semibold transition-colors ${
                      tradeOutcome === o
                        ? o === 'YES'
                          ? 'bg-pf-success/10 text-pf-success border border-pf-success/30'
                          : 'bg-pf-danger/10 text-pf-danger border border-pf-danger/30'
                        : 'bg-pf-surface text-pf-text-muted border border-pf-border hover:border-pf-border-strong'
                    }`}
                  >
                    {o}
                  </Button>
                ))}
              </div>

              {/* Side toggle */}
              <div className="flex gap-1 mt-2">
                {(['BUY', 'SELL'] as const).map((s) => (
                  <Button
                    type="button"
                    variant="ghost"
                    key={s}
                    onClick={() => setTradeSide(s)}
                    className={`flex-1 py-1.5 rounded-pf-sm text-xs font-semibold transition-colors ${
                      tradeSide === s
                        ? s === 'BUY'
                          ? 'bg-pf-cyan-500/10 text-pf-cyan-400 border border-pf-cyan-500/30'
                          : 'bg-pf-danger/10 text-pf-danger border border-pf-danger/30'
                        : 'bg-pf-surface text-pf-text-muted border border-pf-border hover:border-pf-border-strong'
                    }`}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              {/* Price input */}
              <div className="mt-3">
                <label htmlFor="trade-price" className="block text-xs font-medium text-pf-text-secondary mb-1">Price</label>
                <Input
                  id="trade-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.99"
                  value={tradePrice}
                  onChange={(e) => setTradePrice(e.target.value)}
                  disabled={isMarketOrder}
                  placeholder="0.65"
                  className="w-full h-11 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm font-mono text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 disabled:opacity-40"
                />
              </div>

              <label htmlFor="trade-market-order" className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  id="trade-market-order"
                  type="checkbox"
                  checked={isMarketOrder}
                  onChange={(e) => setIsMarketOrder(e.target.checked)}
                  className="rounded border-pf-border bg-pf-surface text-pf-cyan-500 focus:ring-pf-cyan-500/30"
                />
                <span className="text-xs text-pf-text-secondary">Market Order</span>
              </label>

              {/* Kelly Position Sizer */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-pf-text-secondary mb-1">
                  Kelly Sizer <span className="text-pf-text-muted">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="51"
                    max="99"
                    step="1"
                    value={kellyConfidence}
                    onChange={(e) => {
                      const conf = parseInt(e.target.value) / 100;
                      setKellyConfidence(parseInt(e.target.value));
                      const price = parseFloat(tradePrice || '0.5');
                      if (price <= 0 || price >= 1) return;
                      const b = tradeSide === 'BUY' ? (1 - price) / price : price / (1 - price);
                      const p = tradeSide === 'BUY' ? conf : 1 - conf;
                      const q = 1 - p;
                      const f = Math.max(0, (p * b - q) / b);
                      // Assume $1000 bankroll (user's portfolio balance if available)
                      const suggested = Math.round(f * (portfolioBalance || 1000));
                      setTradeAmount(String(Math.min(suggested, portfolioBalance || 1000)));
                    }}
                    className="flex-1 h-1.5 rounded-pf-full bg-pf-border accent-pf-cyan-500"
                  />
                  <span className="text-xs font-mono text-pf-cyan-400 w-8 text-right">{kellyConfidence}%</span>
                </div>
                <p className="text-[10px] text-pf-text-muted mt-0.5">
                  Drag to set your confidence &rarr; Kelly suggests a size
                </p>
              </div>

              <div className="mt-3">
                <label htmlFor="trade-amount" className="block text-xs font-medium text-pf-text-secondary mb-1">Amount</label>
                <div className="relative">
                  <Input
                    id="trade-amount"
                    type="number"
                    step="1"
                    min="1"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    placeholder="10"
                    className="w-full h-11 px-3 pr-14 rounded-pf bg-pf-surface border border-pf-border text-sm font-mono text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-pf-text-muted">USDC</span>
                </div>
              </div>

              {/* Estimated values */}
              {parseFloat(tradeAmount || '0') > 0 && estPrice > 0 && (
                <div className="mt-3 space-y-1 bg-pf-surface rounded-pf-sm p-2.5 border border-pf-border-subtle">
                  <div className="flex justify-between text-xs">
                    <span className="text-pf-text-muted">Est. Shares</span>
                    <span className="font-mono text-pf-text">{estShares.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-pf-text-muted">Cost</span>
                    <span className="font-mono text-pf-text">${estCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-pf-text-muted">Potential Payout</span>
                    <span className="font-mono text-pf-success">${estPayout.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Place order button */}
              <Button
                type="button"
                onClick={placeOrder}
                disabled={placingOrder || !tradeAmount || parseFloat(tradeAmount || '0') <= 0 || (!isMarketOrder && (!tradePrice || parseFloat(tradePrice || '0') <= 0))}
                className={`w-full mt-3 py-3 min-h-[44px] rounded-pf text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 ${
                  tradeSide === 'BUY'
                    ? 'bg-pf-cyan-500 hover:bg-pf-cyan-600'
                    : 'bg-pf-danger hover:bg-pf-danger/90'
                }`}
              >
                {placingOrder ? 'Placing...' : `Place ${tradeSide} ${tradeOutcome} Order`}
              </Button>

              {/* Success / Error messages */}
              {tradeSuccess && (
                <p className="mt-2 text-xs text-pf-success">{tradeSuccess}</p>
              )}
              {tradeError && (
                <p className="mt-2 text-xs text-pf-danger">{tradeError}</p>
              )}

              {/* My Open Orders */}
              <div className="mt-4 pt-3 border-t border-pf-border-subtle">
                <span className="text-xs font-medium text-pf-text-secondary">My Open Orders</span>
                {loadingMyOrders ? (
                  <div className="mt-2 space-y-1">
                    {Array.from({ length: 2 }, (_, i) => (
                      <div key={i} className="h-6 bg-pf-overlay rounded animate-pulse" />
                    ))}
                  </div>
                ) : myOrders.length === 0 ? (
                  <p className="mt-2 text-xs text-pf-text-muted">No open orders</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {myOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-pf-sm bg-pf-surface border border-pf-border-subtle text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`font-semibold ${order.side === 'BUY' ? 'text-pf-cyan-400' : 'text-pf-danger'}`}>
                            {order.side}
                          </span>
                          <span className={`font-medium ${order.outcome === 'YES' ? 'text-pf-success' : 'text-pf-danger'}`}>
                            {order.outcome}
                          </span>
                          <span className="font-mono text-pf-text-muted truncate">
                            {order.size}@{order.price}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => cancelMyOrder(order.id)}
                          className="shrink-0 p-0.5 rounded text-pf-text-muted hover:text-pf-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                          title="Cancel order"
                          aria-label="Cancel order"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </>}
            </div>

            {/* Provide Liquidity */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLpExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-pf-text hover:bg-pf-surface/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:rounded-pf"
                aria-expanded={lpExpanded}
              >
                <div className="flex items-center gap-2">
                  <Droplets className="size-4 text-pf-text-muted" aria-hidden="true" />
                  Provide Liquidity
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-pf-text-muted transition-transform duration-200 ${lpExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </Button>

              {lpExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-pf-border-subtle pt-3">
                  {/* Token selector */}
                  <div>
                    <label htmlFor="lp-token" className="block text-xs font-medium text-pf-text-secondary mb-1">
                      Token
                    </label>
                    <Select
                      id="lp-token"
                      value={lpTokenId}
                      onChange={(e) => setLpTokenId(e.target.value)}
                      className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
                    >
                      {(market?.tokens ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.outcome}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Spread input */}
                  <div>
                    <label htmlFor="lp-spread" className="block text-xs font-medium text-pf-text-secondary mb-1">
                      Spread
                    </label>
                    <Input
                      id="lp-spread"
                      type="number"
                      step="0.001"
                      min="0.001"
                      max="0.5"
                      value={lpSpread}
                      onChange={(e) => setLpSpread(e.target.value)}
                      placeholder="0.02"
                      className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm font-mono text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                    />
                  </div>

                  {/* Size input */}
                  <div>
                    <label htmlFor="lp-size" className="block text-xs font-medium text-pf-text-secondary mb-1">
                      Size (USDC)
                    </label>
                    <Input
                      id="lp-size"
                      type="number"
                      step="1"
                      min="1"
                      value={lpSize}
                      onChange={(e) => setLpSize(e.target.value)}
                      placeholder="10"
                      className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm font-mono text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                    />
                  </div>

                  {lpError && (
                    <p className="text-xs text-pf-danger">{lpError}</p>
                  )}

                  <Button
                    type="button"
                    onClick={submitLp}
                    disabled={lpSubmitting || !lpTokenId || !lpSpread || !lpSize}
                    className="w-full py-2.5 rounded-pf bg-pf-cyan-500/15 border border-pf-cyan-500/30 text-sm font-semibold text-pf-cyan-400 hover:bg-pf-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                  >
                    {lpSubmitting ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              )}
            </div>

            {/* Community Sentiment */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-pf-text-muted" aria-hidden="true" />
                  <span className="text-sm font-medium text-pf-text">Community Sentiment</span>
                </div>
                {sentiment && sentiment.totalVotes > 0 && (
                  <span className="text-[11px] text-pf-text-muted">{sentiment.totalVotes} votes</span>
                )}
              </div>

              {/* Loading skeleton */}
              {loadingSentiment ? (
                <div className="space-y-3">
                  <div className="h-4 bg-pf-overlay rounded-pf-full animate-pulse" />
                  <div className="flex gap-2">
                    <div className="flex-1 h-10 bg-pf-overlay rounded-pf animate-pulse" />
                    <div className="flex-1 h-10 bg-pf-overlay rounded-pf animate-pulse" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Sentiment bar — shown when votes exist */}
                  {sentiment && sentiment.totalVotes > 0 ? (
                    <div className="mb-3">
                      {/* Labels + bar */}
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-pf-success">YES {sentiment.yesPercent}%</span>
                        <span className="font-semibold text-pf-danger">{sentiment.noPercent}% NO</span>
                      </div>
                      <div className="h-4 rounded-pf-full overflow-hidden flex">
                        <div
                          className="bg-pf-success transition-all duration-700 ease-out"
                          style={{ width: `${sentiment.yesPercent}%` }}
                          title={`YES ${sentiment.yesPercent}%`}
                        />
                        <div
                          className="bg-pf-danger flex-1 transition-all duration-700 ease-out"
                          title={`NO ${sentiment.noPercent}%`}
                        />
                      </div>
                      <p className="text-[11px] text-pf-text-muted mt-1.5 text-center">
                        {sentiment.yesPercent > 55
                          ? 'Community leans YES'
                          : sentiment.noPercent > 55
                            ? 'Community leans NO'
                            : 'Evenly split'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-pf-text-muted text-center py-2 mb-3">
                      Be the first to share your prediction
                    </p>
                  )}

                  {/* Already voted — show their vote + edit link */}
                  {sentiment?.userVote && !editingVote ? (
                    <div className="rounded-pf bg-pf-surface border border-pf-border-subtle p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {sentiment.userVote.direction === 'YES'
                          ? <ThumbsUp className="size-3.5 text-pf-success" />
                          : <ThumbsDown className="size-3.5 text-pf-danger" />
                        }
                        <span className="text-xs text-pf-text-secondary">
                          Your vote:{' '}
                          <span className={sentiment.userVote.direction === 'YES' ? 'text-pf-success font-semibold' : 'text-pf-danger font-semibold'}>
                            {sentiment.userVote.direction}
                          </span>
                          {' '}({sentiment.userVote.confidence}% confident)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setSelectedDir(sentiment.userVote!.direction);
                          setConfidence(sentiment.userVote!.confidence);
                          setEditingVote(true);
                        }}
                        className="flex items-center gap-1 text-[11px] text-pf-text-muted hover:text-pf-cyan-400 transition-colors"
                      >
                        <Edit2 className="size-3" /> Edit
                      </Button>
                    </div>
                  ) : (
                    /* Vote form */
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-pf-text-secondary">What's your read?</p>

                      {/* YES / NO toggle */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedDir('YES')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-pf border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-success/40 ${
                            selectedDir === 'YES'
                              ? 'bg-pf-success/15 border-pf-success text-pf-success'
                              : 'border-pf-success text-pf-success hover:bg-pf-success/10'
                          }`}
                        >
                          <ThumbsUp className="size-3.5" /> YES
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedDir('NO')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-pf border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger/40 ${
                            selectedDir === 'NO'
                              ? 'bg-pf-danger/15 border-pf-danger text-pf-danger'
                              : 'border-pf-danger text-pf-danger hover:bg-pf-danger/10'
                          }`}
                        >
                          <ThumbsDown className="size-3.5" /> NO
                        </Button>
                      </div>

                      {/* Confidence slider */}
                      {selectedDir && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-pf-text-secondary font-medium">How confident?</span>
                            <span className="font-mono text-pf-cyan-400">{confidence}% confident</span>
                          </div>
                          <input
                            type="range"
                            min={50}
                            max={99}
                            step={1}
                            value={confidence}
                            onChange={(e) => setConfidence(parseInt(e.target.value))}
                            className="w-full h-1.5 rounded-pf-full bg-pf-border accent-pf-cyan-500"
                          />
                          <p className="text-[10px] text-pf-text-muted mt-0.5">
                            {confidence <= 64 ? 'Just a guess' : confidence <= 79 ? 'Fairly confident' : 'Very confident'}
                          </p>
                        </div>
                      )}

                      {/* Submit */}
                      <Button
                        type="button"
                        disabled={!selectedDir || voting}
                        onClick={submitVote}
                        className="w-full py-2.5 rounded-pf bg-pf-cyan-500/15 border border-pf-cyan-500/30 text-sm font-semibold text-pf-cyan-400 hover:bg-pf-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                      >
                        {voting ? 'Submitting...' : 'Submit Vote'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Price Alerts Widget */}
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-pf-text-muted" aria-hidden="true" />
                  <span className="text-sm font-medium text-pf-text">Price Alerts</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAlertForm((v) => !v)}
                  aria-expanded={showAlertForm}
                  aria-label={showAlertForm ? 'Cancel new alert' : 'Add price alert'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-pf-sm text-xs font-medium bg-pf-cyan-500/10 border border-pf-cyan-500/25 text-pf-cyan-400 hover:bg-pf-cyan-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                >
                  {showAlertForm ? (
                    <X className="size-3" />
                  ) : (
                    <><BellPlus className="size-3" /> Add</>
                  )}
                </Button>
              </div>

              {/* Inline form */}
              {showAlertForm && (
                <div className="px-4 pt-3 pb-2 border-b border-pf-border-subtle space-y-3">
                  {/* Outcome toggle */}
                  <div>
                    <p className="text-xs font-medium text-pf-text-secondary mb-1.5">Outcome</p>
                    <div className="flex gap-1.5">
                      {(['YES', 'NO'] as const).map((o) => (
                        <Button
                          type="button"
                          variant="ghost"
                          key={o}
                          onClick={() => setAlertOutcome(o)}
                          className={`flex-1 py-1.5 rounded-pf-sm text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                            alertOutcome === o
                              ? o === 'YES'
                                ? 'bg-pf-success/10 text-pf-success border border-pf-success/30'
                                : 'bg-pf-danger/10 text-pf-danger border border-pf-danger/30'
                              : 'bg-pf-surface text-pf-text-muted border border-pf-border hover:border-pf-border-strong'
                          }`}
                        >
                          {o}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Condition toggle */}
                  <div>
                    <p className="text-xs font-medium text-pf-text-secondary mb-1.5">Condition</p>
                    <div className="flex gap-1.5">
                      {(['above', 'below'] as const).map((c) => (
                        <Button
                          type="button"
                          variant="ghost"
                          key={c}
                          onClick={() => setAlertCondition(c)}
                          className={`flex-1 py-1.5 rounded-pf-sm text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                            alertCondition === c
                              ? 'bg-pf-cyan-500/10 text-pf-cyan-400 border border-pf-cyan-500/30'
                              : 'bg-pf-surface text-pf-text-muted border border-pf-border hover:border-pf-border-strong'
                          }`}
                        >
                          {c}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Threshold slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-pf-text-secondary">Threshold</p>
                      <span className="font-mono text-xs text-pf-cyan-400">{alertThreshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.99"
                      step="0.01"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(parseFloat(e.target.value))}
                      aria-label="Alert threshold"
                      className="w-full h-1.5 rounded-pf-full bg-pf-border accent-pf-cyan-500"
                    />
                    <div className="flex justify-between text-[10px] text-pf-text-muted mt-0.5">
                      <span>0.01</span>
                      <span>0.99</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowAlertForm(false)}
                      className="flex-1 py-2 rounded-pf-sm text-xs text-pf-text-secondary hover:text-pf-text border border-pf-border hover:border-pf-border-strong transition-colors"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={savingAlert}
                      onClick={async () => {
                        if (!market?.id) return;
                        setSavingAlert(true);
                        try {
                          const r = await fetch(`/api/v1/markets/${market.id}/alerts`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              outcome: alertOutcome,
                              condition: alertCondition,
                              threshold: alertThreshold,
                            }),
                          });
                          if (r.ok) {
                            toast.success('Alert created');
                            setShowAlertForm(false);
                            setAlertOutcome('YES');
                            setAlertCondition('above');
                            setAlertThreshold(0.60);
                            await loadAlerts();
                          } else {
                            toast.error('Failed to create alert');
                          }
                        } catch {
                          toast.error('Failed to create alert');
                        } finally {
                          setSavingAlert(false);
                        }
                      }}
                      className="flex-1 py-2 rounded-pf-sm text-xs font-semibold bg-pf-cyan-500/15 border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                    >
                      {savingAlert ? 'Saving...' : 'Save Alert'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Alert list */}
              <div className="px-4 py-3">
                {loadingAlerts ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }, (_, i) => (
                      <div key={i} className="h-8 bg-pf-overlay rounded-pf-sm animate-pulse" />
                    ))}
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <Bell className="size-6 text-pf-text-muted opacity-30 mb-2" aria-hidden="true" />
                    <p className="text-xs text-pf-text-muted">No alerts set</p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAlertForm(true)}
                      className="mt-1.5 text-[11px] text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors"
                    >
                      Add your first alert
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {alerts.map((alert) => (
                      <li
                        key={alert.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-pf-sm bg-pf-surface border border-pf-border-subtle text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Outcome dot */}
                          <span
                            className={`size-1.5 rounded-pf-full shrink-0 ${alert.outcome === 'YES' ? 'bg-pf-success' : 'bg-pf-danger'}`}
                            aria-hidden="true"
                          />
                          <span className="font-mono text-pf-text truncate">
                            {alert.outcome} {alert.condition} {alert.threshold.toFixed(2)}
                          </span>
                          {alert.triggered && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-pf-full text-[10px] font-medium bg-pf-warning/15 text-pf-warning border border-pf-warning/20">
                              Triggered
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete alert: ${alert.outcome} ${alert.condition} ${alert.threshold.toFixed(2)}`}
                          onClick={async () => {
                            try {
                              const r = await fetch(`/api/v1/markets/${market?.id}/alerts/${alert.id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });
                              if (r.ok) {
                                setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                                toast.success('Alert removed');
                              } else {
                                toast.error('Failed to remove alert');
                              }
                            } catch {
                              toast.error('Failed to remove alert');
                            }
                          }}
                          className="shrink-0 p-1 rounded text-pf-text-muted hover:text-pf-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            </div>{/* end right column wrapper */}
          </div>

          {/* Strategies on this market */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
            <h2 className="text-sm font-medium text-pf-text mb-4">Strategies on This Market</h2>
            <div className="flex flex-col items-center py-6 text-center">
              <Zap className="size-6 text-pf-text-muted mb-2" />
              <p className="text-sm text-pf-text-muted">No strategies running on this market yet.</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowRunStrategy(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:border-pf-border-strong transition-colors"
              >
                <Play className="size-3" /> Run Strategy
              </Button>
            </div>
          </div>

          {/* Related News */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2">
                <Newspaper className="size-4 text-pf-text-muted" aria-hidden="true" />
                <h2 className="text-sm font-medium text-pf-text">Related News</h2>
              </div>
              <Link
                to={`/news?market=${id}`}
                className="text-[11px] text-pf-text-muted hover:text-pf-cyan-400 transition-colors"
              >
                See all &rarr;
              </Link>
            </div>

            {loadingNewsArticles ? (
              <div className="divide-y divide-pf-border">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3 animate-pulse">
                    <div className="size-2 rounded-pf-full bg-pf-overlay shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-pf-overlay rounded w-[80%]" />
                      <div className="h-2.5 bg-pf-overlay rounded w-[50%]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : relatedNewsArticles.length === 0 ? (
              <p className="px-6 py-5 text-xs text-pf-text-muted text-center">No related news found</p>
            ) : (
              <div className="divide-y divide-pf-border">
                {relatedNewsArticles.map(article => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 py-3 hover:bg-pf-surface transition-colors"
                  >
                    {/* Sentiment dot */}
                    <span
                      className={`size-2 rounded-pf-full shrink-0 ${
                        article.sentiment === 'POSITIVE'
                          ? 'bg-pf-success'
                          : article.sentiment === 'NEGATIVE'
                            ? 'bg-pf-danger'
                            : 'bg-pf-text-muted'
                      }`}
                      aria-label={article.sentiment}
                    />

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-pf-text truncate leading-snug">{article.title}</p>
                      <p className="text-[11px] text-pf-text-muted mt-0.5">
                        {article.source} &middot; {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Signal count badge */}
                    {(article.signals?.length ?? 0) > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-pf-full text-[10px] font-medium bg-pf-cyan-500/15 text-pf-cyan-400">
                        {article.signals!.length} signal{article.signals!.length !== 1 ? 's' : ''}
                      </span>
                    )}

                    <ExternalLink className="size-3 shrink-0 text-pf-text-muted opacity-50" aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {market.description && (
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6">
              <h2 className="text-sm font-medium text-pf-text mb-2">About</h2>
              <p className="text-sm text-pf-text-secondary leading-relaxed">{market.description}</p>
            </div>
          )}

          {/* Conditional Order Dialog (TP/SL) */}
          {showConditional && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-pf-backdrop backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Set Conditional Order">
              <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-sm p-6 shadow-pf-lg">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-pf-text">
                    {condType === 'TAKE_PROFIT' ? 'Set Take Profit' : 'Set Stop Loss'} &mdash; {condOutcome}
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowConditional(false)}
                    aria-label="Close dialog"
                    className="p-1 rounded text-pf-text-muted hover:text-pf-text transition-colors"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="cond-trigger-price-dialog" className="block text-xs font-medium text-pf-text-secondary mb-1.5">Trigger Price</label>
                    <Input
                      id="cond-trigger-price-dialog"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="0.99"
                      value={condTriggerPrice}
                      onChange={(e) => setCondTriggerPrice(e.target.value)}
                      placeholder="e.g. 0.75"
                      className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label htmlFor="cond-size-dialog" className="block text-xs font-medium text-pf-text-secondary mb-1.5">Size (shares)</label>
                    <Input
                      id="cond-size-dialog"
                      type="number"
                      step="1"
                      min="1"
                      value={condSize}
                      onChange={(e) => setCondSize(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-3 border-t border-pf-border-subtle">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowConditional(false)}
                      className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant={condType === 'TAKE_PROFIT' ? 'success' : 'danger'}
                      onClick={submitConditional}
                      disabled={!condSize || !condTriggerPrice || condSubmitting}
                      className={`flex items-center gap-2 px-4 py-2 rounded-pf text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity ${
                        condType === 'TAKE_PROFIT' ? 'bg-pf-success' : 'bg-pf-danger'
                      }`}
                    >
                      {condType === 'TAKE_PROFIT' ? 'Set TP' : 'Set SL'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Run Strategy Dialog */}
          {showRunStrategy && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-pf-backdrop backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Run Strategy">
              <div className="animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-md p-6 shadow-pf-lg">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-pf-text">Run Strategy on This Market</h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowRunStrategy(false)}
                    aria-label="Close dialog"
                    className="p-1 rounded text-pf-text-muted hover:text-pf-text transition-colors"
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="run-strategy-select" className="block text-xs font-medium text-pf-text-secondary mb-1.5">
                      Select Strategy
                    </label>
                    <Select
                      id="run-strategy-select"
                      value={selectedStrategyId}
                      onChange={(e) => setSelectedStrategyId(e.target.value)}
                      className="w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
                    >
                      <option value="">Choose a strategy...</option>
                      {strategyOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
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
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowRunStrategy(false)}
                      className="px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      onClick={onStartStrategy}
                      disabled={!selectedStrategyId}
                      className="flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-success text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      <Play className="size-3.5" /> Start Strategy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
