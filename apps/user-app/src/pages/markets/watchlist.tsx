import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ChevronUp,
  ChevronDown,
  X,
  LayoutList,
  Tag,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { wsManager } from '@/lib/websocket';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface WatchedMarket {
  id: string;
  title: string;
  category?: string;
  image?: string;
  closed: boolean;
  volume24h: string;
  tokens?: Array<{ id: string; outcome: string; price: string }>;
  watchlistId: string;
  addedAt: string;
  priceChange24h?: number;
}

type SortBy = 'name' | 'yesPrice' | 'change' | 'volume' | 'addedAt';
type SortDir = 'asc' | 'desc';

interface QuickOrderState {
  marketId: string | null;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  amount: string;
  price: string;
  orderType: 'market' | 'limit';
  submitting: boolean;
}

const DEFAULT_QUICK_ORDER: QuickOrderState = {
  marketId: null,
  outcome: 'YES',
  side: 'BUY',
  amount: '',
  price: '',
  orderType: 'market',
  submitting: false,
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatVolume(vol: string | number): string {
  const v = typeof vol === 'string' ? parseFloat(vol) : vol;
  if (isNaN(v)) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ─── Sortable column header ─────────────────────────────────────────── */

function SortHeader({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  col: SortBy;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (col: SortBy) => void;
  className?: string;
}) {
  const active = sortBy === col;
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-pf-text transition-colors ${
        active ? 'text-pf-cyan-400' : 'text-pf-text-secondary'
      } ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : (
          <ChevronDown className="size-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [markets, setMarkets] = useState<WatchedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const prevPrices = useRef<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<SortBy>('addedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [quickOrder, setQuickOrder] = useState<QuickOrderState>(DEFAULT_QUICK_ORDER);

  const fetchWatchlist = () => {
    setLoading(true);
    fetch('/api/v1/watchlist', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(setMarkets)
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  /* ── Optimistic remove with toast ─────────────────────────────────── */

  const removeFromWatchlist = async (marketId: string) => {
    // Optimistic update
    setMarkets(prev => prev.filter(m => m.id !== marketId));
    setRemovingIds(prev => new Set([...prev, marketId]));

    try {
      const res = await fetch(`/api/v1/watchlist/${marketId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('Market removed from watchlist');
    } catch {
      // Revert on failure
      fetchWatchlist();
      toast.error('Failed to remove market — please try again');
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
    }
  };

  /* ── Quick Order handlers ──────────────────────────────────────────── */

  const toggleQuickOrder = (marketId: string) => {
    setQuickOrder(prev =>
      prev.marketId === marketId
        ? DEFAULT_QUICK_ORDER
        : { ...DEFAULT_QUICK_ORDER, marketId },
    );
  };

  const placeOrder = async () => {
    if (!quickOrder.marketId) return;

    const amt = parseFloat(quickOrder.amount);
    if (isNaN(amt) || amt <= 0) return;

    if (quickOrder.orderType === 'limit') {
      const lp = parseFloat(quickOrder.price);
      if (isNaN(lp) || lp < 0.01 || lp > 0.99) return;
    }

    setQuickOrder(prev => ({ ...prev, submitting: true }));

    try {
      const body: Record<string, unknown> = {
        marketId: quickOrder.marketId,
        outcome: quickOrder.outcome,
        side: quickOrder.side,
        amount: quickOrder.amount,
        orderType: quickOrder.orderType,
      };
      if (quickOrder.orderType === 'limit') {
        body.price = quickOrder.price;
      }

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? 'Order failed');
      }

      toast.success('Order placed!');
      setQuickOrder(DEFAULT_QUICK_ORDER);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Order failed — please try again');
      setQuickOrder(prev => ({ ...prev, submitting: false }));
    }
  };

  /* ── Live price WebSocket ──────────────────────────────────────────── */

  useEffect(() => {
    if (!markets.length) return;
    const tokenIds: string[] = [];
    markets.forEach(m => {
      m.tokens?.forEach(t => tokenIds.push(t.id));
    });
    if (!tokenIds.length) return;
    wsManager.subscribePrices(tokenIds);
    const handler = (msg: Record<string, unknown>) => {
      if (msg.type !== 'PRICE_UPDATE') return;
      const d =
        msg.data && typeof msg.data === 'object'
          ? (msg.data as Record<string, unknown>)
          : msg;
      const tokenId = d.tokenId as string;
      const price =
        typeof d.price === 'number' ? d.price : parseFloat(String(d.price ?? '0'));
      if (!tokenId || isNaN(price)) return;
      setLivePrices(prev => {
        prevPrices.current[tokenId] = prev[tokenId] ?? price;
        return { ...prev, [tokenId]: price };
      });
    };
    wsManager.addListener(handler);
    return () => {
      wsManager.removeListener(handler);
      wsManager.unsubscribePrices(tokenIds);
    };
  }, [markets]);

  /* ── Price helpers ─────────────────────────────────────────────────── */

  const yesPrice = (
    m: WatchedMarket,
  ): { price: number; live: boolean; prev: number | null } | null => {
    const yes = m.tokens?.find(t => t.outcome?.toUpperCase() === 'YES');
    if (!yes) return null;
    const live = livePrices[yes.id];
    if (live !== undefined) {
      return { price: live, live: true, prev: prevPrices.current[yes.id] ?? null };
    }
    return { price: parseFloat(yes.price), live: false, prev: null };
  };

  const noPrice = (m: WatchedMarket): number | null => {
    const no = m.tokens?.find(t => t.outcome?.toUpperCase() === 'NO');
    if (!no) return null;
    const live = livePrices[no.id];
    return live !== undefined ? live : parseFloat(no.price) || null;
  };

  /* ── Sort logic ────────────────────────────────────────────────────── */

  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...markets];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      switch (sortBy) {
        case 'name':
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case 'yesPrice': {
          const ap = a.tokens?.find(t => t.outcome?.toUpperCase() === 'YES');
          const bp = b.tokens?.find(t => t.outcome?.toUpperCase() === 'YES');
          av = ap ? (livePrices[ap.id] ?? parseFloat(ap.price) ?? 0) : 0;
          bv = bp ? (livePrices[bp.id] ?? parseFloat(bp.price) ?? 0) : 0;
          break;
        }
        case 'change':
          av = a.priceChange24h ?? 0;
          bv = b.priceChange24h ?? 0;
          break;
        case 'volume':
          av = parseFloat(a.volume24h ?? '0') || 0;
          bv = parseFloat(b.volume24h ?? '0') || 0;
          break;
        case 'addedAt':
          av = new Date(a.addedAt).getTime();
          bv = new Date(b.addedAt).getTime();
          break;
      }

      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return arr;
  }, [markets, sortBy, sortDir, livePrices]);

  /* ── Summary bar stats ─────────────────────────────────────────────── */

  const posCount = markets.filter(m => (m.priceChange24h ?? 0) > 0).length;
  const negCount = markets.filter(m => (m.priceChange24h ?? 0) < 0).length;

  /* ── Group-by-category ─────────────────────────────────────────────── */

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, WatchedMarket[]>();
    sorted.forEach(m => {
      const cat = m.category ?? 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [groupByCategory, sorted]);

  /* ── Row renderer ──────────────────────────────────────────────────── */

  const renderRow = (m: WatchedMarket) => {
    const priceInfo = yesPrice(m);
    const noPriceVal = noPrice(m);
    const priceDelta =
      priceInfo?.live && priceInfo.prev !== null
        ? priceInfo.price - priceInfo.prev
        : null;
    const deltaUp = priceDelta !== null && priceDelta > 0;
    const deltaDown = priceDelta !== null && priceDelta < 0;

    const change24h = m.priceChange24h;
    const changeColor =
      change24h === undefined || change24h === null
        ? 'text-pf-text-muted'
        : change24h > 0
        ? 'text-pf-success'
        : change24h < 0
        ? 'text-pf-danger'
        : 'text-pf-text-muted';

    const isExpanded = quickOrder.marketId === m.id;

    // ── Est. shares calculation ───────────────────────────────────────
    const currentYesPrice = priceInfo?.price ?? null;
    const currentNoPrice = noPriceVal;
    const currentPrice =
      quickOrder.outcome === 'YES' ? currentYesPrice : currentNoPrice;

    let estShares: string | null = null;
    const amtNum = parseFloat(quickOrder.amount);
    if (!isNaN(amtNum) && amtNum > 0 && isExpanded) {
      if (quickOrder.orderType === 'market' && currentPrice && currentPrice > 0) {
        estShares = (amtNum / currentPrice).toFixed(1);
      } else if (quickOrder.orderType === 'limit') {
        const lp = parseFloat(quickOrder.price);
        if (!isNaN(lp) && lp > 0) {
          estShares = (amtNum / lp).toFixed(1);
        }
      }
    }

    // ── Validation ────────────────────────────────────────────────────
    const amtError =
      isExpanded && quickOrder.amount !== '' && (isNaN(amtNum) || amtNum <= 0)
        ? 'Amount must be greater than 0'
        : null;

    const lpNum = parseFloat(quickOrder.price);
    const priceError =
      isExpanded &&
      quickOrder.orderType === 'limit' &&
      quickOrder.price !== '' &&
      (isNaN(lpNum) || lpNum < 0.01 || lpNum > 0.99)
        ? 'Limit price must be between 0.01 and 0.99'
        : null;

    const canSubmit =
      !quickOrder.submitting &&
      amtNum > 0 &&
      !amtError &&
      !priceError &&
      (quickOrder.orderType === 'market' ||
        (quickOrder.price !== '' && !priceError));

    return (
      <Fragment key={m.id}>
        <tr
          className={`group hover:bg-pf-elevated/40 transition-colors border-b ${
            isExpanded ? 'border-pf-border' : 'border-pf-border-subtle last:border-0'
          }`}
        >
          {/* Market title */}
          <td className="px-4 py-3 max-w-[260px]">
            <Link
              to={`/markets/${m.id}`}
              className="text-sm text-pf-text font-medium hover:text-pf-cyan-400 transition-colors line-clamp-2 leading-snug"
            >
              {m.title}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              {m.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-pf-border bg-pf-surface-elevated text-pf-text-muted">
                  {m.category}
                </span>
              )}
              <span
                className={`text-[10px] ${m.closed ? 'text-pf-danger' : 'text-pf-success'}`}
              >
                {m.closed ? 'Closed' : 'Live'}
              </span>
            </div>
          </td>

          {/* YES Price */}
          <td className="px-4 py-3 text-right">
            {priceInfo !== null ? (
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={`text-sm font-mono font-semibold transition-colors ${
                    deltaUp
                      ? 'text-pf-success'
                      : deltaDown
                      ? 'text-pf-danger'
                      : 'text-pf-text'
                  }`}
                >
                  {(priceInfo.price * 100).toFixed(0)}¢
                </span>
                {priceDelta !== null && Math.abs(priceDelta) >= 0.001 && (
                  <span
                    className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                      deltaUp
                        ? 'bg-pf-success/10 text-pf-success'
                        : 'bg-pf-danger/10 text-pf-danger'
                    }`}
                  >
                    {deltaUp ? '▲' : '▼'}
                    {Math.abs(priceDelta * 100).toFixed(1)}¢
                  </span>
                )}
                {priceInfo.live && (
                  <span className="text-[9px] text-pf-cyan-400">● LIVE</span>
                )}
              </div>
            ) : (
              <span className="text-sm text-pf-text-muted">—</span>
            )}
          </td>

          {/* NO Price */}
          <td className="px-4 py-3 text-right">
            {noPriceVal !== null ? (
              <span className="text-sm font-mono text-pf-danger">
                {(noPriceVal * 100).toFixed(0)}¢
              </span>
            ) : (
              <span className="text-sm text-pf-text-muted">—</span>
            )}
          </td>

          {/* 24h Change */}
          <td className="px-4 py-3 text-right">
            {change24h !== undefined && change24h !== null ? (
              <span className={`text-sm font-mono font-medium flex items-center justify-end gap-1 ${changeColor}`}>
                {change24h > 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : change24h < 0 ? (
                  <TrendingDown className="size-3.5" />
                ) : null}
                {change24h > 0 ? '+' : ''}
                {(change24h * 100).toFixed(1)}%
              </span>
            ) : (
              <span className="text-sm text-pf-text-muted">—</span>
            )}
          </td>

          {/* 24h Volume */}
          <td className="px-4 py-3 text-right">
            <span className="text-sm font-mono text-pf-text">
              {formatVolume(m.volume24h)}
            </span>
          </td>

          {/* Added */}
          <td className="px-4 py-3 text-right">
            <span className="text-xs text-pf-text-muted">
              {relativeDate(m.addedAt)}
            </span>
          </td>

          {/* Quick-Trade trigger */}
          <td className="px-4 py-3 text-right">
            {!m.closed ? (
              <button
                type="button"
                onClick={() => toggleQuickOrder(m.id)}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-pf-sm border font-medium transition-colors ${
                  isExpanded
                    ? 'bg-pf-cyan-500/10 text-pf-cyan-400 border-pf-cyan-500/40'
                    : 'bg-transparent text-pf-text-muted border-pf-border hover:text-pf-cyan-400 hover:border-pf-cyan-500/40'
                }`}
                title="Quick trade this market"
                aria-expanded={isExpanded}
                aria-label={`Quick trade ${m.title}`}
              >
                <Zap className="size-3" />
                Trade
              </button>
            ) : (
              <span className="text-xs text-pf-text-muted">—</span>
            )}
          </td>

          {/* Remove */}
          <td className="px-4 py-3 text-right">
            <button
              type="button"
              onClick={() => removeFromWatchlist(m.id)}
              disabled={removingIds.has(m.id)}
              className="p-1.5 rounded-pf text-pf-text-muted hover:text-pf-danger transition-colors disabled:opacity-40"
              title="Remove from watchlist"
              aria-label={`Remove ${m.title} from watchlist`}
            >
              <X className="size-3.5" />
            </button>
          </td>
        </tr>

        {/* ── Inline Quick Order Panel ──────────────────────────────── */}
        {isExpanded && (
          <tr className="border-b border-pf-border-subtle last:border-0">
            <td colSpan={8} className="px-0 py-0">
              <div className="mx-4 my-3 rounded-pf-lg border border-pf-border bg-pf-surface p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-pf-text uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="size-3.5 text-pf-cyan-400" />
                    Quick Order
                    <span className="font-normal text-pf-text-muted normal-case tracking-normal truncate max-w-[320px]">
                      — {m.title}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickOrder(DEFAULT_QUICK_ORDER)}
                    className="p-1 rounded-pf text-pf-text-muted hover:text-pf-text transition-colors"
                    aria-label="Close quick order panel"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Left column: controls */}
                  <div className="space-y-3">
                    {/* Outcome + Side toggles */}
                    <div className="flex items-center gap-4">
                      {/* Outcome */}
                      <div className="flex items-center gap-1">
                        {(['YES', 'NO'] as const).map(o => (
                          <button
                            key={o}
                            type="button"
                            onClick={() =>
                              setQuickOrder(prev => ({ ...prev, outcome: o }))
                            }
                            className={`px-3 py-1 rounded-pf-sm text-xs font-semibold transition-colors ${
                              quickOrder.outcome === o
                                ? o === 'YES'
                                  ? 'bg-pf-success/20 text-pf-success border border-pf-success/40'
                                  : 'bg-pf-danger/20 text-pf-danger border border-pf-danger/40'
                                : 'bg-pf-surface-elevated text-pf-text-muted border border-pf-border hover:border-pf-border-hover'
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>

                      {/* Side */}
                      <div className="flex items-center gap-1">
                        {(['BUY', 'SELL'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              setQuickOrder(prev => ({ ...prev, side: s }))
                            }
                            className={`px-3 py-1 rounded-pf-sm text-xs font-semibold transition-colors ${
                              quickOrder.side === s
                                ? 'bg-pf-cyan-500/20 text-pf-cyan-400 border border-pf-cyan-500/40'
                                : 'bg-pf-surface-elevated text-pf-text-muted border border-pf-border hover:border-pf-border-hover'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Order type */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-pf-text-secondary">Order type:</span>
                      {(['market', 'limit'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setQuickOrder(prev => ({
                              ...prev,
                              orderType: t,
                              price: '',
                            }))
                          }
                          className={`px-2.5 py-0.5 rounded-pf-sm text-xs font-medium transition-colors capitalize ${
                            quickOrder.orderType === t
                              ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border border-pf-cyan-500/30'
                              : 'bg-pf-surface-elevated text-pf-text-muted border border-pf-border hover:border-pf-border-hover'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Amount input */}
                    <div>
                      <label className="text-xs text-pf-text-secondary block mb-1">
                        Amount (USDC)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0.00"
                        value={quickOrder.amount}
                        onChange={e =>
                          setQuickOrder(prev => ({ ...prev, amount: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-pf bg-pf-surface-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/60 focus:ring-1 focus:ring-pf-cyan-500/30 transition-colors"
                      />
                      {amtError && (
                        <p className="mt-1 text-[11px] text-pf-danger">{amtError}</p>
                      )}
                    </div>

                    {/* Limit price input */}
                    {quickOrder.orderType === 'limit' && (
                      <div>
                        <label className="text-xs text-pf-text-secondary block mb-1">
                          Limit price (0.01 – 0.99)
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          max="0.99"
                          step="0.01"
                          placeholder="0.50"
                          value={quickOrder.price}
                          onChange={e =>
                            setQuickOrder(prev => ({ ...prev, price: e.target.value }))
                          }
                          className="w-full px-3 py-1.5 rounded-pf bg-pf-surface-elevated border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/60 focus:ring-1 focus:ring-pf-cyan-500/30 transition-colors"
                        />
                        {priceError && (
                          <p className="mt-1 text-[11px] text-pf-danger">{priceError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right column: summary + submit */}
                  <div className="flex flex-col justify-between gap-3">
                    {/* Market prices + est. shares */}
                    <div className="rounded-pf bg-pf-surface-elevated border border-pf-border-subtle p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-pf-text-muted">Current YES</span>
                        <span className="font-mono text-pf-text">
                          {currentYesPrice !== null
                            ? `${(currentYesPrice * 100).toFixed(0)}¢`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-pf-text-muted">Current NO</span>
                        <span className="font-mono text-pf-text">
                          {currentNoPrice !== null
                            ? `${(currentNoPrice * 100).toFixed(0)}¢`
                            : '—'}
                        </span>
                      </div>
                      {estShares !== null && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-pf-border-subtle">
                          <span className="text-pf-text-muted">Est. shares</span>
                          <span className="font-mono text-pf-text-muted">
                            ~{estShares} shares
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Place Order button */}
                    <button
                      type="button"
                      onClick={placeOrder}
                      disabled={!canSubmit}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-pf bg-pf-cyan-500 text-pf-bg font-semibold text-sm hover:bg-pf-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {quickOrder.submitting ? (
                        <span className="flex items-center gap-1.5">
                          <span className="size-3.5 rounded-full border-2 border-pf-bg/30 border-t-pf-bg animate-spin" />
                          Placing...
                        </span>
                      ) : (
                        <>
                          <Zap className="size-3.5" />
                          Place Order
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  /* ── Table header shared ───────────────────────────────────────────── */

  const tableHead = (
    <thead>
      <tr className="bg-pf-surface text-left text-xs uppercase tracking-wider">
        <SortHeader
          label="Market"
          col="name"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
        <SortHeader
          label="YES"
          col="yesPrice"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          className="text-right"
        />
        <th
          scope="col"
          className="px-4 py-3 font-medium text-pf-text-secondary text-right"
        >
          NO
        </th>
        <SortHeader
          label="24h Change"
          col="change"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          className="text-right"
        />
        <SortHeader
          label="24h Volume"
          col="volume"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          className="text-right"
        />
        <SortHeader
          label="Added"
          col="addedAt"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          className="text-right"
        />
        <th
          scope="col"
          className="px-4 py-3 font-medium text-pf-text-secondary text-right"
        >
          <span className="inline-flex items-center gap-1">
            <Zap className="size-3 text-pf-text-muted" />
            Trade
          </span>
        </th>
        <th
          scope="col"
          className="px-4 py-3 font-medium text-pf-text-secondary w-10"
        />
      </tr>
    </thead>
  );

  /* ── Render ────────────────────────────────────────────────────────── */

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-pf-text">My Watchlist</h1>
            <p className="text-sm text-pf-text-secondary mt-0.5">
              {markets.length} {markets.length === 1 ? 'market' : 'markets'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Group by category toggle */}
            <button
              type="button"
              onClick={() => setGroupByCategory(g => !g)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pf border text-xs font-medium transition-colors ${
                groupByCategory
                  ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                  : 'bg-pf-surface text-pf-text-secondary border-pf-border hover:border-pf-border-hover'
              }`}
              title="Toggle group by category"
            >
              <Tag className="size-3.5" />
              Group by Category
            </button>
            <Link
              to="/markets"
              className="text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors"
            >
              Browse Markets →
            </Link>
          </div>
        </div>

        {/* Summary bar */}
        {!loading && markets.length > 0 && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-pf bg-pf-surface border border-pf-border-subtle text-xs text-pf-text-secondary">
            <span className="flex items-center gap-1.5">
              <LayoutList className="size-3.5 text-pf-text-muted" />
              <span className="font-medium text-pf-text">{markets.length}</span> markets watched
            </span>
            <span className="text-pf-border">|</span>
            <span className="flex items-center gap-1.5 text-pf-success">
              <TrendingUp className="size-3.5" />
              <span className="font-medium">{posCount}</span> with positive movement
            </span>
            <span className="text-pf-border">|</span>
            <span className="flex items-center gap-1.5 text-pf-danger">
              <TrendingDown className="size-3.5" />
              <span className="font-medium">{negCount}</span> with negative movement
            </span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12 text-pf-text-muted text-sm">
            Loading watchlist...
          </div>
        )}

        {/* Empty state */}
        {!loading && markets.length === 0 && (
          <div className="text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-pf-text-muted mx-auto mb-3"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <p className="text-pf-text-secondary text-sm">No markets in your watchlist</p>
            <p className="text-pf-text-muted text-xs mt-1">Star any market to add it here</p>
            <Link
              to="/markets"
              className="mt-4 inline-block text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors"
            >
              Browse Markets →
            </Link>
          </div>
        )}

        {/* Table — flat or grouped */}
        {!loading && markets.length > 0 && (
          <>
            {/* Flat list */}
            {!groupByCategory && (
              <div className="border border-pf-border rounded-pf-lg overflow-hidden">
                <table className="w-full text-sm" aria-label="Watchlist markets">
                  {tableHead}
                  <tbody>{sorted.map(renderRow)}</tbody>
                </table>
              </div>
            )}

            {/* Grouped by category */}
            {groupByCategory && grouped && (
              <div className="space-y-6">
                {grouped.map(([category, items]) => (
                  <div key={category}>
                    {/* Category section header */}
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="size-3.5 text-pf-text-muted" />
                      <span className="text-xs font-semibold text-pf-text-secondary uppercase tracking-wider">
                        {category}
                      </span>
                      <span className="text-xs text-pf-text-muted">({items.length})</span>
                      <div className="flex-1 h-px bg-pf-border-subtle ml-1" />
                    </div>
                    <div className="border border-pf-border rounded-pf-lg overflow-hidden">
                      <table className="w-full text-sm" aria-label={`${category} markets`}>
                        {tableHead}
                        <tbody>{items.map(renderRow)}</tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
