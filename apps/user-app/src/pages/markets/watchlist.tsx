import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button, Input } from '@polyforge/ui';
import {
  Star,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Zap,
  X,
  Plus,
  Minus,
  Bell,
  BellRing,
  BellOff,
  Trash2,
  AlertCircle,
  Clock,
  BarChart2,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WatchlistMarket {
  id: string;
  title: string;
  slug: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  change24h: number;
  expiryDate: string;
  imageUrl?: string;
  isStarred: boolean;
}

interface QuickOrderState {
  outcome: 'YES' | 'NO';
  amount: number;
  submitting: boolean;
}

interface WatchlistAlert {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  condition: 'above' | 'below';
  threshold: number;
  triggered: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_MARKETS: WatchlistMarket[] = [
  {
    id: 'mkt-001',
    title: 'Will the Fed cut rates in Q2 2026?',
    slug: 'fed-cut-rates-q2-2026',
    category: 'Economics',
    yesPrice: 0.72,
    noPrice: 0.28,
    volume24h: 184500,
    liquidity: 620000,
    change24h: 0.043,
    expiryDate: '2026-06-30',
    isStarred: true,
  },
  {
    id: 'mkt-002',
    title: 'Will Bitcoin exceed $120k before July 2026?',
    slug: 'bitcoin-120k-before-july-2026',
    category: 'Crypto',
    yesPrice: 0.48,
    noPrice: 0.52,
    volume24h: 396000,
    liquidity: 1240000,
    change24h: -0.021,
    expiryDate: '2026-07-01',
    isStarred: true,
  },
  {
    id: 'mkt-003',
    title: 'Will the S&P 500 close above 6,000 in April 2026?',
    slug: 'sp500-6000-april-2026',
    category: 'Finance',
    yesPrice: 0.61,
    noPrice: 0.39,
    volume24h: 211000,
    liquidity: 780000,
    change24h: 0.015,
    expiryDate: '2026-04-30',
    isStarred: false,
  },
  {
    id: 'mkt-004',
    title: 'Will OpenAI release GPT-5 before May 2026?',
    slug: 'openai-gpt5-before-may-2026',
    category: 'AI',
    yesPrice: 0.55,
    noPrice: 0.45,
    volume24h: 143000,
    liquidity: 510000,
    change24h: 0.072,
    expiryDate: '2026-05-01',
    isStarred: true,
  },
  {
    id: 'mkt-005',
    title: 'Will the US unemployment rate exceed 5% in 2026?',
    slug: 'us-unemployment-5pct-2026',
    category: 'Economics',
    yesPrice: 0.33,
    noPrice: 0.67,
    volume24h: 87000,
    liquidity: 290000,
    change24h: -0.008,
    expiryDate: '2026-12-31',
    isStarred: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(p: number) {
  return (p * 100).toFixed(0) + '¢';
}

function formatDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatChange(c: number) {
  const sign = c >= 0 ? '+' : '';
  return `${sign}${(c * 100).toFixed(1)}pp`;
}

function formatThreshold(t: number) {
  return t.toFixed(2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function activeAlertCount(alerts: WatchlistAlert[]) {
  return alerts.filter((a) => !a.triggered).length;
}

function hasTriggeredAlert(alerts: WatchlistAlert[]) {
  return alerts.some((a) => a.triggered);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriceBadge({ price, variant }: { price: number; variant: 'yes' | 'no' }) {
  const base =
    variant === 'yes'
      ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
      : 'bg-pf-danger/10 text-pf-danger border-pf-danger/20';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-pf-sm border text-xs font-semibold tabular-nums ${base}`}
    >
      {formatPrice(price)}
    </span>
  );
}

function ChangeBadge({ change }: { change: number }) {
  const positive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
        positive ? 'text-pf-success' : 'text-pf-danger'
      }`}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {formatChange(change)}
    </span>
  );
}

interface AlertBellProps {
  alerts: WatchlistAlert[] | undefined;
  loading: boolean;
  onClick: () => void;
  active: boolean;
}

function AlertBell({ alerts, loading, onClick, active }: AlertBellProps) {
  const count = alerts ? activeAlertCount(alerts) : 0;
  const triggered = alerts ? hasTriggeredAlert(alerts) : false;

  let iconColor = 'text-pf-text-muted hover:text-pf-text-secondary';
  let Icon = Bell;

  if (active) {
    iconColor = 'text-pf-cyan-400';
    Icon = BellRing;
  } else if (triggered) {
    iconColor = 'text-pf-warning';
    Icon = BellRing;
  } else if (count > 0) {
    iconColor = 'text-pf-cyan-400';
    Icon = BellRing;
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={loading}
      aria-label="Manage price alerts"
      aria-pressed={active}
      className={`relative inline-flex items-center justify-center w-7 h-7 rounded-pf-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${iconColor} ${
        active ? 'bg-pf-cyan-400/10' : 'hover:bg-pf-surface'
      } ${loading ? 'opacity-50 cursor-wait' : ''}`}
    >
      <Icon className="w-4 h-4" />
      {count > 0 && !active && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-pf-full bg-pf-cyan-500 text-pf-micro font-bold text-pf-text-contrast leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Component() {
  const navigate = useNavigate();

  // ---- Watchlist state ---------------------------------------------------
  const [markets, setMarkets] = useState<WatchlistMarket[]>(MOCK_MARKETS);
  const [sortKey, setSortKey] = useState<keyof WatchlistMarket>('volume24h');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // ---- Quick-order state (v6.28.0) ----------------------------------------
  const [expandedQuickOrder, setExpandedQuickOrder] = useState<string | null>(null);
  const [quickOrderState, setQuickOrderState] = useState<Record<string, QuickOrderState>>({});

  // ---- Alerts state (v6.29.0) ---------------------------------------------
  const [expandedAlerts, setExpandedAlerts] = useState<string | null>(null);
  const [alertsByMarket, setAlertsByMarket] = useState<Record<string, WatchlistAlert[]>>({});
  const [loadingAlerts, setLoadingAlerts] = useState<Record<string, boolean>>({});

  // Alert form fields
  const [alertOutcome, setAlertOutcome] = useState<'YES' | 'NO'>('YES');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertThreshold, setAlertThreshold] = useState<number>(0.6);
  const [addingAlert, setAddingAlert] = useState(false);
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);

  // ---- Derived -------------------------------------------------------------
  const categories = ['All', ...Array.from(new Set(MOCK_MARKETS.map((m) => m.category)))];

  const displayedMarkets = markets
    .filter((m) => filterCategory === 'All' || m.category === filterCategory)
    .sort((a, b) => {
      const av = a[sortKey] as number | string | boolean;
      const bv = b[sortKey] as number | string | boolean;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return 0;
    });

  // ---- Handlers: watchlist ------------------------------------------------
  const handleSort = (key: keyof WatchlistMarket) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleRemoveStar = (id: string) => {
    setMarkets((prev) => prev.filter((m) => m.id !== id));
    toast.success('Removed from watchlist');
  };

  // ---- Handlers: quick-order (v6.28.0) ------------------------------------
  const openQuickOrder = (marketId: string) => {
    // Close alerts panel if open
    if (expandedAlerts === marketId) {
      setExpandedAlerts(null);
    } else if (expandedAlerts !== null) {
      setExpandedAlerts(null);
    }

    setExpandedQuickOrder((prev) => (prev === marketId ? null : marketId));
    if (!quickOrderState[marketId]) {
      setQuickOrderState((prev) => ({
        ...prev,
        [marketId]: { outcome: 'YES', amount: 50, submitting: false },
      }));
    }
  };

  const updateQuickOrder = (marketId: string, patch: Partial<QuickOrderState>) => {
    setQuickOrderState((prev) => ({
      ...prev,
      [marketId]: { ...prev[marketId], ...patch },
    }));
  };

  const submitQuickOrder = async (market: WatchlistMarket) => {
    const state = quickOrderState[market.id];
    if (!state || state.submitting) return;

    updateQuickOrder(market.id, { submitting: true });
    try {
      const res = await fetch(`/api/v1/markets/${market.id}/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: state.outcome, amount: state.amount }),
      });
      if (!res.ok) throw new Error('Order failed');
      toast.success(`Order placed — ${state.outcome} $${state.amount}`);
      setExpandedQuickOrder(null);
    } catch {
      toast.error('Failed to place order. Please try again.');
    } finally {
      updateQuickOrder(market.id, { submitting: false });
    }
  };

  // ---- Handlers: alerts (v6.29.0) -----------------------------------------
  const openAlertsPanel = useCallback(
    async (marketId: string) => {
      // Close quick-order if open
      if (expandedQuickOrder !== null) {
        setExpandedQuickOrder(null);
      }

      // Toggle — close if already open
      if (expandedAlerts === marketId) {
        setExpandedAlerts(null);
        return;
      }

      setExpandedAlerts(marketId);

      // Reset form defaults
      setAlertOutcome('YES');
      setAlertCondition('above');
      setAlertThreshold(0.6);

      // Load lazily — skip if already cached
      if (alertsByMarket[marketId] !== undefined) return;

      setLoadingAlerts((prev) => ({ ...prev, [marketId]: true }));
      try {
        const res = await fetch(`/api/v1/markets/${marketId}/alerts`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load alerts');
        const json = await res.json();
        setAlertsByMarket((prev) => ({ ...prev, [marketId]: json.data ?? [] }));
      } catch {
        toast.error('Could not load alerts for this market.');
        setAlertsByMarket((prev) => ({ ...prev, [marketId]: [] }));
      } finally {
        setLoadingAlerts((prev) => ({ ...prev, [marketId]: false }));
      }
    },
    [expandedAlerts, expandedQuickOrder, alertsByMarket],
  );

  const handleAddAlert = async (marketId: string) => {
    if (addingAlert) return;
    if (alertThreshold <= 0 || alertThreshold >= 1) {
      toast.error('Threshold must be between 0 and 1 (e.g. 0.65)');
      return;
    }

    setAddingAlert(true);
    try {
      const res = await fetch(`/api/v1/markets/${marketId}/alerts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: alertOutcome,
          condition: alertCondition,
          threshold: alertThreshold,
        }),
      });
      if (!res.ok) throw new Error('Failed to create alert');
      const json = await res.json();
      const newAlert: WatchlistAlert = json.data;
      setAlertsByMarket((prev) => ({
        ...prev,
        [marketId]: [...(prev[marketId] ?? []), newAlert],
      }));
      // Reset form
      setAlertOutcome('YES');
      setAlertCondition('above');
      setAlertThreshold(0.6);
      toast.success('Alert created');
    } catch {
      toast.error('Failed to create alert. Please try again.');
    } finally {
      setAddingAlert(false);
    }
  };

  const handleDeleteAlert = async (marketId: string, alertId: string) => {
    if (deletingAlertId) return;
    setDeletingAlertId(alertId);
    try {
      const res = await fetch(`/api/v1/markets/${marketId}/alerts/${alertId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete alert');
      setAlertsByMarket((prev) => ({
        ...prev,
        [marketId]: (prev[marketId] ?? []).filter((a) => a.id !== alertId),
      }));
      toast.success('Alert removed');
    } catch {
      toast.error('Failed to remove alert. Please try again.');
    } finally {
      setDeletingAlertId(null);
    }
  };

  // ---- Sort indicator helper -----------------------------------------------
  const SortIcon = ({ col }: { col: keyof WatchlistMarket }) =>
    sortKey === col ? (
      sortDir === 'desc' ? (
        <ChevronDown className="w-3 h-3 ml-0.5 inline-block text-pf-cyan-400" />
      ) : (
        <ChevronUp className="w-3 h-3 ml-0.5 inline-block text-pf-cyan-400" />
      )
    ) : (
      <ChevronDown className="w-3 h-3 ml-0.5 inline-block text-pf-text-muted opacity-40" />
    );

  // ---- Column count for colSpan --------------------------------------------
  // Columns: Star | Market | Category | YES | NO | 24h | Volume | Liq | Alerts | Trade
  const TOTAL_COLS = 10;

  // ---- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-pf-surface animate-fade-in">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-b border-pf-border bg-pf-elevated px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-pf-text flex items-center gap-2">
              <Star className="w-5 h-5 text-pf-cyan-400" aria-hidden="true" />
              Watchlist
            </h1>
            <p className="text-sm text-pf-text-muted mt-0.5">
              {displayedMarkets.length} market{displayedMarkets.length !== 1 ? 's' : ''} tracked
            </p>
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by category">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant="ghost"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-pf-sm border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                  filterCategory === cat
                    ? 'bg-pf-cyan-500 text-pf-text-contrast border-pf-cyan-500'
                    : 'bg-transparent text-pf-text-secondary border-pf-border hover:border-pf-border-strong hover:text-pf-text'
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Empty state                                                          */}
      {/* ------------------------------------------------------------------ */}
      {displayedMarkets.length === 0 && (
        <div className="max-w-screen-xl mx-auto px-6 py-24 flex flex-col items-center gap-4 text-center">
          <Star className="w-12 h-12 text-pf-text-muted opacity-30" aria-hidden="true" />
          <p className="text-pf-text-secondary text-lg font-medium">No markets in your watchlist</p>
          <p className="text-pf-text-muted text-sm max-w-xs">
            Browse markets and tap the star icon to add them here for quick access.
          </p>
          <Button
            onClick={() => navigate('/markets')}
            className="mt-2 px-4 py-2 bg-pf-cyan-500 text-pf-text-contrast text-sm font-semibold rounded-pf hover:brightness-110 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
          >
            Browse Markets
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Table                                                                */}
      {/* ------------------------------------------------------------------ */}
      {displayedMarkets.length > 0 && (
        <div className="max-w-screen-xl mx-auto px-6 py-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label="Watchlist markets">
            {/* Head */}
            <thead>
              <tr className="border-b border-pf-border">
                {/* Star */}
                <th className="w-8 pb-2" aria-label="Remove from watchlist" />

                {/* Market */}
                <th className="text-left pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider">
                  Market
                </th>

                {/* Category */}
                <th className="text-left pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider hidden md:table-cell">
                  Category
                </th>

                {/* YES */}
                <th
                  className="text-right pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('yesPrice')}
                  aria-sort={sortKey === 'yesPrice' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  YES <SortIcon col="yesPrice" />
                </th>

                {/* NO */}
                <th
                  className="text-right pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('noPrice')}
                  aria-sort={sortKey === 'noPrice' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  NO <SortIcon col="noPrice" />
                </th>

                {/* 24h */}
                <th
                  className="text-right pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hidden sm:table-cell"
                  onClick={() => handleSort('change24h')}
                  aria-sort={sortKey === 'change24h' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  24h <SortIcon col="change24h" />
                </th>

                {/* Volume */}
                <th
                  className="text-right pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hidden lg:table-cell"
                  onClick={() => handleSort('volume24h')}
                  aria-sort={sortKey === 'volume24h' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Vol 24h <SortIcon col="volume24h" />
                </th>

                {/* Liquidity */}
                <th
                  className="text-right pb-2 pr-4 text-xs font-medium text-pf-text-muted uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hidden xl:table-cell"
                  onClick={() => handleSort('liquidity')}
                  aria-sort={sortKey === 'liquidity' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Liquidity <SortIcon col="liquidity" />
                </th>

                {/* Alerts — v6.29.0 */}
                <th className="w-10 pb-2 text-center text-xs font-medium text-pf-text-muted uppercase tracking-wider">
                  <Bell className="w-3.5 h-3.5 inline-block" aria-hidden="true" />
                  <span className="sr-only">Alerts</span>
                </th>

                {/* Trade */}
                <th className="w-20 pb-2 text-right text-xs font-medium text-pf-text-muted uppercase tracking-wider">
                  Trade
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-pf-border/40">
              {displayedMarkets.map((market) => {
                const isQuickOrderOpen = expandedQuickOrder === market.id;
                const isAlertsOpen = expandedAlerts === market.id;
                const qo = quickOrderState[market.id];
                const marketAlerts = alertsByMarket[market.id];
                const alertsLoading = loadingAlerts[market.id] ?? false;

                return (
                  <>
                    {/* -------------------------------------------------------- */}
                    {/* Market row                                                */}
                    {/* -------------------------------------------------------- */}
                    <tr
                      key={market.id}
                      className={`group transition-colors duration-100 ${
                        isQuickOrderOpen || isAlertsOpen
                          ? 'bg-pf-elevated'
                          : 'hover:bg-pf-elevated/60'
                      }`}
                    >
                      {/* Star / remove */}
                      <td className="py-3 pr-2 w-8">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveStar(market.id)}
                          aria-label={`Remove ${market.title} from watchlist`}
                          className="text-pf-cyan-400 hover:text-pf-warning transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </Button>
                      </td>

                      {/* Title */}
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            onClick={() => navigate(`/markets/${market.slug}`)}
                            className="text-left text-pf-text font-medium hover:text-pf-cyan-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm leading-snug max-w-xs"
                          >
                            {market.title}
                          </Button>
                          <span className="flex items-center gap-1 text-xs text-pf-text-muted">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            Expires {formatDate(market.expiryDate)}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded-pf-sm bg-pf-surface border border-pf-border text-xs text-pf-text-secondary">
                          {market.category}
                        </span>
                      </td>

                      {/* YES price */}
                      <td className="py-3 pr-4 text-right">
                        <PriceBadge price={market.yesPrice} variant="yes" />
                      </td>

                      {/* NO price */}
                      <td className="py-3 pr-4 text-right">
                        <PriceBadge price={market.noPrice} variant="no" />
                      </td>

                      {/* 24h change */}
                      <td className="py-3 pr-4 text-right hidden sm:table-cell">
                        <ChangeBadge change={market.change24h} />
                      </td>

                      {/* Volume */}
                      <td className="py-3 pr-4 text-right text-pf-text-secondary tabular-nums hidden lg:table-cell">
                        {formatDollar(market.volume24h)}
                      </td>

                      {/* Liquidity */}
                      <td className="py-3 pr-4 text-right text-pf-text-secondary tabular-nums hidden xl:table-cell">
                        {formatDollar(market.liquidity)}
                      </td>

                      {/* Bell / Alerts — v6.29.0 */}
                      <td className="py-3 pr-2 text-center w-10">
                        <AlertBell
                          alerts={marketAlerts}
                          loading={alertsLoading}
                          onClick={() => openAlertsPanel(market.id)}
                          active={isAlertsOpen}
                        />
                      </td>

                      {/* Trade / Quick-order button */}
                      <td className="py-3 text-right w-20">
                        <Button
                          variant="ghost"
                          onClick={() => openQuickOrder(market.id)}
                          aria-pressed={isQuickOrderOpen}
                          aria-label={`Quick order for ${market.title}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pf text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                            isQuickOrderOpen
                              ? 'bg-pf-cyan-500/20 text-pf-cyan-400 border border-pf-cyan-500/40'
                              : 'bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-cyan-500/60 hover:text-pf-cyan-400'
                          }`}
                        >
                          <Zap className="w-3 h-3" aria-hidden="true" />
                          Trade
                        </Button>
                      </td>
                    </tr>

                    {/* -------------------------------------------------------- */}
                    {/* Inline quick-order panel (v6.28.0)                       */}
                    {/* -------------------------------------------------------- */}
                    {isQuickOrderOpen && qo && (
                      <tr key={`${market.id}-quickorder`} className="bg-pf-elevated">
                        <td colSpan={TOTAL_COLS} className="px-4 pb-4 pt-0">
                          <div className="border border-pf-border rounded-pf-lg p-4 bg-pf-surface">
                            {/* Panel header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-pf-cyan-400" aria-hidden="true" />
                                <span className="text-sm font-semibold text-pf-text">Quick Order</span>
                                <span className="text-xs text-pf-text-muted truncate max-w-xs hidden sm:block">
                                  — {market.title}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setExpandedQuickOrder(null)}
                                aria-label="Close quick order panel"
                                className="text-pf-text-muted hover:text-pf-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="flex flex-wrap items-end gap-4">
                              {/* Outcome toggle */}
                              <div className="flex flex-col gap-1">
                                <label className="text-xs text-pf-text-muted font-medium">Outcome</label>
                                <div
                                  className="flex rounded-pf border border-pf-border overflow-hidden"
                                  role="group"
                                  aria-label="Select outcome"
                                >
                                  {(['YES', 'NO'] as const).map((o) => (
                                    <Button
                                      key={o}
                                      variant="ghost"
                                      onClick={() => updateQuickOrder(market.id, { outcome: o })}
                                      aria-pressed={qo.outcome === o}
                                      className={`px-4 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                                        qo.outcome === o
                                          ? o === 'YES'
                                            ? 'bg-pf-success text-white'
                                            : 'bg-pf-danger text-white'
                                          : 'bg-pf-elevated text-pf-text-secondary hover:text-pf-text'
                                      }`}
                                    >
                                      {o}
                                    </Button>
                                  ))}
                                </div>
                              </div>

                              {/* Amount */}
                              <div className="flex flex-col gap-1">
                                <label className="text-xs text-pf-text-muted font-medium">Amount (USDC)</label>
                                <div className="flex items-center gap-1 border border-pf-border rounded-pf bg-pf-elevated px-1">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      updateQuickOrder(market.id, { amount: Math.max(1, qo.amount - 10) })
                                    }
                                    aria-label="Decrease amount"
                                    className="p-1 text-pf-text-muted hover:text-pf-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={qo.amount}
                                    onChange={(e) =>
                                      updateQuickOrder(market.id, {
                                        amount: Math.max(1, Number(e.target.value)),
                                      })
                                    }
                                    aria-label="Order amount in USDC"
                                    className="w-16 text-center bg-transparent text-pf-text text-sm font-semibold tabular-nums py-1.5 focus:outline-none"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      updateQuickOrder(market.id, { amount: qo.amount + 10 })
                                    }
                                    aria-label="Increase amount"
                                    className="p-1 text-pf-text-muted hover:text-pf-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* Quick-amount presets */}
                              <div className="flex items-end gap-1 pb-0.5">
                                {[10, 25, 50, 100].map((preset) => (
                                  <Button
                                    key={preset}
                                    variant="ghost"
                                    onClick={() => updateQuickOrder(market.id, { amount: preset })}
                                    className={`px-2 py-1.5 text-xs font-medium rounded-pf-sm border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                                      qo.amount === preset
                                        ? 'bg-pf-cyan-500/20 border-pf-cyan-500/40 text-pf-cyan-400'
                                        : 'bg-transparent border-pf-border text-pf-text-muted hover:text-pf-text hover:border-pf-border-strong'
                                    }`}
                                  >
                                    ${preset}
                                  </Button>
                                ))}
                              </div>

                              {/* Expected shares / price info */}
                              <div className="flex flex-col gap-0.5 text-xs text-pf-text-muted ml-auto hidden sm:flex">
                                <span>
                                  Price:{' '}
                                  <strong className="text-pf-text">
                                    {formatPrice(qo.outcome === 'YES' ? market.yesPrice : market.noPrice)}
                                  </strong>
                                </span>
                                <span>
                                  Est. shares:{' '}
                                  <strong className="text-pf-text tabular-nums">
                                    {(
                                      qo.amount /
                                      (qo.outcome === 'YES' ? market.yesPrice : market.noPrice)
                                    ).toFixed(1)}
                                  </strong>
                                </span>
                              </div>

                              {/* Submit */}
                              <Button
                                onClick={() => submitQuickOrder(market)}
                                disabled={qo.submitting}
                                className="px-5 py-2 bg-pf-cyan-500 text-pf-text-contrast text-sm font-semibold rounded-pf hover:brightness-110 disabled:opacity-50 disabled:cursor-wait transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 whitespace-nowrap"
                              >
                                {qo.submitting ? 'Placing…' : `Buy ${qo.outcome}`}
                              </Button>

                              {/* Full detail link */}
                              <Button
                                variant="ghost"
                                onClick={() => navigate(`/markets/${market.slug}`)}
                                className="inline-flex items-center gap-1 text-xs text-pf-text-muted hover:text-pf-cyan-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Full detail
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* -------------------------------------------------------- */}
                    {/* Inline alerts panel (v6.29.0)                            */}
                    {/* -------------------------------------------------------- */}
                    {isAlertsOpen && (
                      <tr key={`${market.id}-alerts`} className="bg-pf-elevated">
                        <td colSpan={TOTAL_COLS} className="px-4 pb-4 pt-0">
                          <div className="border border-pf-border rounded-pf-lg p-4 bg-pf-surface">
                            {/* Panel header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-pf-cyan-400" aria-hidden="true" />
                                <span className="text-sm font-semibold text-pf-text">Price Alerts</span>
                                <span className="text-xs text-pf-text-muted truncate max-w-xs hidden sm:block">
                                  — {market.title}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setExpandedAlerts(null)}
                                aria-label="Close price alerts panel"
                                className="text-pf-text-muted hover:text-pf-text transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* ---- Create new alert form ---- */}
                            <div className="mb-4">
                              <p className="text-xs font-medium text-pf-text-muted mb-2 uppercase tracking-wider">
                                Set new alert
                              </p>
                              <div className="flex flex-wrap items-end gap-3">
                                {/* Outcome toggle */}
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-pf-text-muted">Outcome</label>
                                  <div
                                    className="flex rounded-pf border border-pf-border overflow-hidden"
                                    role="group"
                                    aria-label="Alert outcome"
                                  >
                                    {(['YES', 'NO'] as const).map((o) => (
                                      <Button
                                        key={o}
                                        variant="ghost"
                                        onClick={() => setAlertOutcome(o)}
                                        aria-pressed={alertOutcome === o}
                                        className={`px-4 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                                          alertOutcome === o
                                            ? o === 'YES'
                                              ? 'bg-pf-success text-white'
                                              : 'bg-pf-danger text-white'
                                            : 'bg-pf-elevated text-pf-text-secondary hover:text-pf-text'
                                        }`}
                                      >
                                        {o}
                                      </Button>
                                    ))}
                                  </div>
                                </div>

                                {/* Condition toggle */}
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-pf-text-muted">Condition</label>
                                  <div
                                    className="flex rounded-pf border border-pf-border overflow-hidden"
                                    role="group"
                                    aria-label="Alert condition"
                                  >
                                    {(['above', 'below'] as const).map((c) => (
                                      <Button
                                        key={c}
                                        variant="ghost"
                                        onClick={() => setAlertCondition(c)}
                                        aria-pressed={alertCondition === c}
                                        className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 capitalize focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 ${
                                          alertCondition === c
                                            ? 'bg-pf-cyan-500/20 text-pf-cyan-400 border-r border-pf-cyan-500/30'
                                            : 'bg-pf-elevated text-pf-text-secondary hover:text-pf-text'
                                        }`}
                                      >
                                        {c}
                                      </Button>
                                    ))}
                                  </div>
                                </div>

                                {/* Threshold input */}
                                <div className="flex flex-col gap-1">
                                  <label
                                    htmlFor={`alert-threshold-${market.id}`}
                                    className="text-xs text-pf-text-muted"
                                  >
                                    Threshold (0–1)
                                  </label>
                                  <Input
                                    id={`alert-threshold-${market.id}`}
                                    type="number"
                                    min={0.01}
                                    max={0.99}
                                    step={0.01}
                                    value={alertThreshold}
                                    onChange={(e) => setAlertThreshold(Number(e.target.value))}
                                    className="w-24 px-3 py-1.5 bg-pf-elevated border border-pf-border rounded-pf text-sm text-pf-text tabular-nums focus:outline-none focus:border-pf-cyan-500/60 focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors duration-150"
                                  />
                                </div>

                                {/* Current price hint */}
                                <div className="flex flex-col gap-0.5 text-xs text-pf-text-muted pb-0.5 hidden sm:flex">
                                  <span>
                                    Current YES:{' '}
                                    <strong className="text-pf-success tabular-nums">
                                      {market.yesPrice.toFixed(2)}
                                    </strong>
                                  </span>
                                  <span>
                                    Current NO:{' '}
                                    <strong className="text-pf-danger tabular-nums">
                                      {market.noPrice.toFixed(2)}
                                    </strong>
                                  </span>
                                </div>

                                {/* Add button */}
                                <Button
                                  onClick={() => handleAddAlert(market.id)}
                                  disabled={addingAlert}
                                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-pf-cyan-500 text-pf-text-contrast text-sm font-semibold rounded-pf hover:brightness-110 disabled:opacity-50 disabled:cursor-wait transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 whitespace-nowrap"
                                >
                                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                  {addingAlert ? 'Adding…' : 'Add Alert'}
                                </Button>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-pf-border/60 my-3" />

                            {/* ---- Active alerts list ---- */}
                            <div>
                              <p className="text-xs font-medium text-pf-text-muted mb-2 uppercase tracking-wider">
                                Active alerts
                              </p>

                              {/* Loading skeleton */}
                              {alertsLoading && (
                                <div className="flex flex-col gap-2">
                                  {[1, 2].map((i) => (
                                    <div
                                      key={i}
                                      className="h-8 rounded-pf bg-pf-elevated animate-shimmer"
                                      aria-hidden="true"
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Empty */}
                              {!alertsLoading && (!marketAlerts || marketAlerts.length === 0) && (
                                <div className="flex items-center gap-2 py-3 text-sm text-pf-text-muted">
                                  <BellOff className="w-4 h-4 opacity-50" aria-hidden="true" />
                                  No alerts for this market
                                </div>
                              )}

                              {/* Alert rows */}
                              {!alertsLoading && marketAlerts && marketAlerts.length > 0 && (
                                <ul className="flex flex-col gap-1.5" role="list" aria-label="Price alerts">
                                  {marketAlerts.map((alert) => (
                                    <li
                                      key={alert.id}
                                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-pf border text-sm ${
                                        alert.triggered
                                          ? 'border-pf-warning/30 bg-pf-warning/5'
                                          : 'border-pf-border bg-pf-elevated'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {/* Status dot */}
                                        {alert.triggered ? (
                                          <AlertCircle
                                            className="w-3.5 h-3.5 text-pf-warning flex-shrink-0"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <span
                                            className="w-2 h-2 rounded-pf-full bg-pf-success flex-shrink-0 animate-pulse-dot"
                                            aria-hidden="true"
                                          />
                                        )}

                                        {/* Alert description */}
                                        <span className="text-pf-text truncate">
                                          <span
                                            className={`font-semibold ${
                                              alert.outcome === 'YES' ? 'text-pf-success' : 'text-pf-danger'
                                            }`}
                                          >
                                            {alert.outcome}
                                          </span>{' '}
                                          {alert.condition}{' '}
                                          <span className="font-semibold tabular-nums text-pf-text">
                                            {formatThreshold(alert.threshold)}
                                          </span>
                                        </span>

                                        {/* Triggered badge */}
                                        {alert.triggered && (
                                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-pf-sm bg-pf-warning/15 border border-pf-warning/30 text-xs font-medium text-pf-warning">
                                            Triggered
                                          </span>
                                        )}
                                      </div>

                                      {/* Delete */}
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleDeleteAlert(market.id, alert.id)}
                                        disabled={deletingAlertId === alert.id}
                                        aria-label={`Delete alert: ${alert.outcome} ${alert.condition} ${alert.threshold}`}
                                        className="flex-shrink-0 p-1 rounded-pf-sm text-pf-text-muted hover:text-pf-danger transition-colors duration-150 disabled:opacity-40 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Footer link to full market detail */}
                            <div className="mt-3 pt-3 border-t border-pf-border/40">
                              <Button
                                variant="ghost"
                                onClick={() => navigate(`/markets/${market.slug}`)}
                                className="inline-flex items-center gap-1 text-xs text-pf-text-muted hover:text-pf-cyan-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
                              >
                                <BarChart2 className="w-3 h-3" aria-hidden="true" />
                                View full market &amp; alerts
                                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer stats bar                                                     */}
      {/* ------------------------------------------------------------------ */}
      {displayedMarkets.length > 0 && (
        <div className="border-t border-pf-border bg-pf-elevated px-6 py-3 mt-4">
          <div className="max-w-screen-xl mx-auto flex items-center gap-6 flex-wrap text-xs text-pf-text-muted">
            <span>
              <strong className="text-pf-text">{displayedMarkets.length}</strong> markets
            </span>
            <span>
              Total volume 24h:{' '}
              <strong className="text-pf-text tabular-nums">
                {formatDollar(displayedMarkets.reduce((s, m) => s + m.volume24h, 0))}
              </strong>
            </span>
            <span>
              Total liquidity:{' '}
              <strong className="text-pf-text tabular-nums">
                {formatDollar(displayedMarkets.reduce((s, m) => s + m.liquidity, 0))}
              </strong>
            </span>
            <span className="ml-auto text-pf-text-muted/60">
              Prices refresh every 30 s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
