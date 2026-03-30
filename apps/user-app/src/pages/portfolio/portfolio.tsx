import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Wallet, BarChart3,
  RefreshCw, Loader2, AlertTriangle, Fuel, PieChart, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/theme-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Position {
  id: string;
  tokenId: string;
  marketTitle: string;
  marketId?: string;
  side: string;
  size: string;
  avgEntryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  realizedPnl?: string;
  resolutionStatus: string;
  outcome?: string;
  market?: { title?: string; category?: string | null } | null;
}

interface PortfolioResponse {
  totalUnrealizedPnl: string;
  totalRealizedPnl: string;
  positions: Position[];
}

interface PnlSnapshot {
  time: string;
  pnl: string;
}

interface PnlResponse {
  totalPnl: string;
  winRate: string;
  snapshots: PnlSnapshot[];
}

interface PaperPosition {
  tokenId: string;
  side: string;
  size: string;
  unrealizedPnl: string;
}

interface PaperSummary {
  pnl: string;
  positions: PaperPosition[];
  orderCount: number;
}

type Tab = 'live' | 'paper';
type Period = '7d' | '30d' | '90d' | 'allTime';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const PERIODS: { label: string; value: Period }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'allTime' },
];

function pnlColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'text-pf-success';
  if (n < 0) return 'text-pf-danger';
  return 'text-pf-text-muted';
}

function pnlBorderColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'border-l-pf-success';
  if (n < 0) return 'border-l-pf-danger';
  return 'border-l-pf-text-muted';
}

function formatPnl(val: string): string {
  const n = parseFloat(val);
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
}

function winRatePct(val: string): string {
  return `${(parseFloat(val) * 100).toFixed(1)}%`;
}

function formatTokenId(tokenId: string): string {
  // Format token_superbowl_chiefs_no → Super Bowl Chiefs (NO)
  const parts = tokenId.replace('token_', '').split('_');
  return parts
    .map((part, i) => {
      if (part.length <= 2) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const colors: Record<string, string> = {
    crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    politics: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    sports: 'bg-green-500/15 text-green-400 border-green-500/30',
    entertainment: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    science: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };
  const key = category.toLowerCase();
  const cls = colors[key] ?? 'bg-pf-surface text-pf-text-muted border-pf-border';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {category}
    </span>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CardSkeleton() {
  return <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse h-20" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-10 bg-pf-overlay rounded animate-pulse" />
      ))}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  // Memoize CSS variable reads — avoids layout-triggering getComputedStyle on every render
  const { isDark } = useThemeStore();
  const themeColors = useMemo(() => {
    const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    return {
      textMuted: s?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A',
      bgElevated: s?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E',
      borderColor: s?.getPropertyValue('--color-pf-border').trim() || '#1E3350',
      textPrimary: s?.getPropertyValue('--color-pf-text').trim() || '#E8EDF5',
    };
  }, [isDark]);
  const { textMuted, bgElevated, borderColor, textPrimary } = themeColors;

  const [tab, setTab] = useState<Tab>('live');
  const [period, setPeriodState] = useState<Period>('7d');

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [pnl, setPnl] = useState<PnlResponse | null>(null);
  const [paper, setPaper] = useState<PaperSummary | null>(null);

  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [closingPosition, setClosingPosition] = useState<Record<string, boolean | undefined>>({});
  const [redeemingPosition, setRedeemingPosition] = useState<Record<string, boolean | undefined>>({});
  const [resettingPaper, setResettingPaper] = useState(false);

  const loadPortfolio = useCallback(async () => {
    setLoadingPortfolio(true);
    try {
      const res = await fetch('/api/v1/portfolio', { credentials: 'include' });
      if (res.ok) setPortfolio(await res.json());
    } catch { toast.error('Failed to load data'); }
    setLoadingPortfolio(false);
  }, []);

  const emptyPnl: PnlResponse = { snapshots: [], totalPnl: '0.00', winRate: '0' };

  const loadChart = useCallback(async (p: Period) => {
    setLoadingChart(true);
    try {
      const res = await fetch(`/api/v1/portfolio/pnl?period=${p}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPnl(data.snapshots?.length ? data : emptyPnl);
      } else {
        setPnl(emptyPnl);
      }
    } catch {
      setPnl(emptyPnl);
    }
    setLoadingChart(false);
  }, []);

  const loadPaper = useCallback(async () => {
    setLoadingPaper(true);
    try {
      const res = await fetch('/api/v1/paper/summary', { credentials: 'include' });
      if (res.ok) setPaper(await res.json());
    } catch { toast.error('Failed to load data'); }
    setLoadingPaper(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) {
      loadPortfolio();
      loadChart(period);
    }
    return () => { cancelled = true; };
  }, [loadPortfolio, loadChart, period]);

  function setPeriod(p: Period) {
    setPeriodState(p);
    // loadChart will be called by the useEffect watching period
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'paper' && !paper) loadPaper();
  }

  const exportCsv = () => {
    const link = document.createElement('a');
    link.href = '/api/v1/portfolio/export/csv';
    link.download = 'portfolio.csv';
    link.click();
  };

  async function closePosition(pos: Position) {
    setClosingPosition(prev => ({ ...prev, [pos.id]: true }));
    try {
      const res = await fetch('/api/v1/orders/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenId: pos.tokenId }),
      });
      if (res.ok) {
        loadPortfolio();
      } else if (res.status === 451) {
        toast.error('Trading is not available in your region');
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.code === 'GEO_BLOCKED') {
          toast.error('Trading is not available in your region');
        } else {
          toast.error(err.message ?? 'Failed to close position');
        }
      }
    } catch { toast.error('Failed to close position'); }
    setClosingPosition(prev => ({ ...prev, [pos.id]: false }));
  }

  async function redeemPosition(pos: Position) {
    setRedeemingPosition(prev => ({ ...prev, [pos.id]: true }));
    try {
      const res = await fetch('/api/v1/orders/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ positionId: pos.id }),
      });
      if (res.ok) {
        toast.success('Position redeemed');
        loadPortfolio();
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.code === 'GEO_BLOCKED') {
          toast.error('Redemption is not available in your region');
        } else {
          toast.error(err.message ?? 'Failed to redeem position');
        }
      }
    } catch { toast.error('Failed to redeem position'); }
    setRedeemingPosition(prev => ({ ...prev, [pos.id]: false }));
  }

  const [circuitBreakerTripped, setCircuitBreakerTripped] = useState(false);
  const [circuitBreakerTrippedAt, setCircuitBreakerTrippedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/settings/risk', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCircuitBreakerTripped(data.circuitBreakerTripped ?? false);
          setCircuitBreakerTrippedAt(data.circuitBreakerTrippedAt ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  async function resetPaper() {
    setShowResetConfirm(false);
    setResettingPaper(true);
    try {
      const res = await fetch('/api/v1/paper/reset', { method: 'POST', credentials: 'include' });
      if (res.ok) setPaper({ pnl: '0', positions: [], orderCount: 0 });
    } catch { toast.error('Failed to reset paper account'); }
    setResettingPaper(false);
  }

  // Chart data — memoized; show flat zero line when no snapshots
  const chartData = useMemo(() => {
    const snaps = pnl?.snapshots ?? [];
    if (snaps.length > 0) {
      return snaps.map(s => ({
        time: new Date(s.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: parseFloat(s.pnl),
      }));
    }
    // Generate 7 flat-zero points for empty state
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => ({
      time: new Date(now - (6 - i) * 86400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: 0,
    }));
  }, [pnl?.snapshots]);
  const isProfitable = parseFloat(pnl?.totalPnl ?? '0') >= 0;
  const chartColor = useMemo(() => {
    const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const success = s?.getPropertyValue('--color-pf-success').trim() || '#10B981';
    const danger = s?.getPropertyValue('--color-pf-danger').trim() || '#EF4444';
    return isProfitable ? success : danger;
  }, [isProfitable, isDark]);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-pf-text">Portfolio</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pf-success/10 text-pf-success text-xs font-medium border border-pf-success/20" title="Gas fees are sponsored — you pay zero network fees">
            <Fuel className="size-3" />
            Gasless
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:text-pf-text hover:border-pf-border-hover transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <div className="flex bg-pf-surface rounded-pf border border-pf-border-subtle" role="tablist" aria-label="Portfolio mode">
            <button
              type="button"
              onClick={() => handleTabChange('live')}
              role="tab"
              aria-selected={tab === 'live'}
              className={`px-4 py-1.5 text-sm font-medium rounded-pf transition-colors ${
                tab === 'live' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-secondary hover:text-pf-text'
              }`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('paper')}
              role="tab"
              aria-selected={tab === 'paper'}
              className={`px-4 py-1.5 text-sm font-medium rounded-pf transition-colors ${
                tab === 'paper' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-secondary hover:text-pf-text'
              }`}
            >
              Paper
            </button>
          </div>
        </div>
      </div>

      {/* Circuit Breaker Banner */}
      {circuitBreakerTripped && (
        <div className="flex items-start gap-3 p-4 rounded-pf-lg bg-pf-danger/10 border border-pf-danger/30">
          <ShieldAlert className="size-5 text-pf-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pf-danger">Circuit Breaker Active</p>
            <p className="text-xs text-pf-text-secondary mt-0.5">
              All strategies have been paused due to drawdown exceeding your risk threshold.
              {circuitBreakerTrippedAt && (
                <span> Triggered {new Date(circuitBreakerTrippedAt).toLocaleString()}.</span>
              )}
              {' '}
              <a href="/settings?tab=risk" className="underline text-pf-danger hover:text-pf-danger/80">Reset in Settings &rarr;</a>
            </p>
          </div>
        </div>
      )}

      {/* ═══ LIVE TAB ═══ */}
      {tab === 'live' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingPortfolio ? (
              [1, 2, 3, 4].map(i => <CardSkeleton key={i} />)
            ) : portfolio ? (
              <>
                <div className={`bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 ${pnlBorderColor(portfolio.totalUnrealizedPnl)}`}>
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Unrealized P&L</span>
                  <span className={`block mt-1 text-xl font-mono font-semibold ${pnlColor(portfolio.totalUnrealizedPnl)}`}>
                    {formatPnl(portfolio.totalUnrealizedPnl)}
                  </span>
                </div>
                <div className={`bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 ${pnlBorderColor(portfolio.totalRealizedPnl)}`}>
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Realized P&L</span>
                  <span className={`block mt-1 text-xl font-mono font-semibold ${pnlColor(portfolio.totalRealizedPnl)}`}>
                    {formatPnl(portfolio.totalRealizedPnl)}
                  </span>
                </div>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 border-l-pf-cyan-500">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Win Rate</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-pf-cyan-400">
                    {parseFloat(pnl?.winRate ?? '0') === 0 && (portfolio?.positions ?? []).length > 0
                      ? '—'
                      : winRatePct(pnl?.winRate ?? '0')}
                  </span>
                  {parseFloat(pnl?.winRate ?? '0') === 0 && (portfolio?.positions ?? []).length > 0 && (
                    <span className="text-[10px] text-pf-text-muted mt-0.5 block">No resolved trades yet</span>
                  )}
                </div>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 border-l-pf-text">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Open Positions</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-pf-text">
                    {portfolio.positions.length}
                  </span>
                </div>
              </>
            ) : (
              <div className="col-span-full bg-pf-elevated border border-pf-danger/20 rounded-pf-lg p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 text-pf-danger opacity-60" size={32} />
                <p className="text-sm font-medium text-pf-text mb-1">Failed to load portfolio</p>
                <p className="text-xs text-pf-text-muted mb-4">Something went wrong while fetching your data.</p>
                <button
                 type="button"
                  
                  onClick={loadPortfolio}
                  className="px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* P&L Chart */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
              <span className="text-sm font-medium text-pf-text">P&L Over Time</span>
              <div className="flex gap-1">
                {PERIODS.map(p => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-pf transition-colors ${
                      period === p.value
                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                        : 'text-pf-text-secondary hover:text-pf-text'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {loadingChart ? (
              <div className="h-64 animate-pulse bg-pf-overlay m-4 rounded" />
            ) : chartData.length > 0 ? (
              <div className="h-64 px-2 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time" tick={{ fill: textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: bgElevated, border: `1px solid ${borderColor}`, borderRadius: 6,
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                      }}
                      labelStyle={{ color: textPrimary }}
                      formatter={(value: number) => [`${value >= 0 ? '+' : ''}$${value.toFixed(2)}`, 'P&L']}
                    />
                    <Area
                      type="monotone" dataKey="pnl" stroke={chartColor} strokeWidth={1.5}
                      fill="url(#pnlGradient)" dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="size-10 text-pf-text-muted mb-3" />
                <p className="text-sm font-medium text-pf-text">No P&L data yet</p>
                <p className="text-xs text-pf-text-muted mt-1">P&L data will appear once your strategies generate trades.</p>
              </div>
            )}
          </div>

          {/* Positions table */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg">
            <div className="px-4 py-3 border-b border-pf-border-subtle">
              <span className="text-sm font-medium text-pf-text">Open Positions</span>
            </div>
            {loadingPortfolio ? (
              <TableSkeleton />
            ) : (portfolio?.positions ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wallet className="size-10 text-pf-text-muted mb-3" />
                <p className="text-sm font-medium text-pf-text">No open positions</p>
                <p className="text-xs text-pf-text-muted mt-1">Start a strategy to build positions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Open positions">
                  <thead>
                    <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                      <th scope="col" className="px-4 py-3 font-medium">Market</th>
                      <th scope="col" className="px-4 py-3 font-medium">Side</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Avg Entry</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Current</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Unreal. P&L</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pf-border-subtle">
                    {portfolio!.positions.map(pos => (
                      <tr key={pos.id} className="hover:bg-pf-surface/50 transition-colors">
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-pf-text line-clamp-1" title={pos.marketTitle}>{pos.marketTitle}</span>
                          <CategoryBadge category={(pos as any).marketCategory} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            pos.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                          }`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-pf-text">
                          {parseFloat(pos.size).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-pf-text">
                          {parseFloat(pos.avgEntryPrice).toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-pf-cyan-400">
                          {pos.currentPrice && parseFloat(pos.currentPrice) > 0 ? `$${parseFloat(pos.currentPrice).toFixed(3)}` : <span className="text-pf-text-muted">&mdash;</span>}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${pnlColor(pos.unrealizedPnl)}`}>
                          {formatPnl(pos.unrealizedPnl)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              pos.resolutionStatus === 'UNRESOLVED'
                                ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                                : 'bg-pf-overlay text-pf-text-muted'
                            }`}
                            {...(pos.resolutionStatus === 'UNRESOLVED' ? { title: 'Market has not yet resolved — position is still active' } : {})}
                          >
                            {pos.resolutionStatus === 'UNRESOLVED' ? 'OPEN' : pos.resolutionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                          {pos.resolutionStatus === 'UNRESOLVED' && (
                            <button
                              type="button"
                              onClick={() => closePosition(pos)}
                              disabled={closingPosition[pos.id]}
                              className="text-xs text-pf-danger hover:text-pf-danger disabled:opacity-50 transition-colors"
                            >
                              {closingPosition[pos.id] ? <Loader2 className="size-3 animate-spin" /> : 'Close'}
                            </button>
                          )}
                          {pos.resolutionStatus === 'RESOLVED' && (
                            <button
                              type="button"
                              onClick={() => redeemPosition(pos)}
                              disabled={redeemingPosition[pos.id]}
                              className="text-xs text-pf-success hover:text-pf-success disabled:opacity-50 transition-colors"
                            >
                              {redeemingPosition[pos.id] ? <Loader2 className="size-3 animate-spin" /> : 'Redeem'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Resolved Positions */}
          {(() => {
            const resolved = (portfolio?.positions ?? []).filter(
              p => p.resolutionStatus === 'RESOLVED'
            );
            if (resolved.length === 0) return null;
            return (
              <section className="mt-6">
                <h2 className="text-base font-semibold text-pf-text mb-3">Resolved Positions</h2>
                <div className="rounded-pf border border-pf-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pf-border bg-pf-surface-elevated">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-pf-text-muted">Market</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-pf-text-muted">Outcome</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-pf-text-muted">Realized P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolved.map((pos, i) => {
                        const pnl = parseFloat(pos.realizedPnl ?? pos.unrealizedPnl ?? '0');
                        const isWin = pnl > 0;
                        return (
                          <tr key={i} className="border-b border-pf-border-subtle last:border-0">
                            <td className="px-4 py-2.5 text-pf-text text-xs">{pos.market?.title ?? pos.marketTitle ?? pos.marketId}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-mono text-pf-text-secondary">{pos.outcome ?? '-'}</td>
                            <td className={`px-4 py-2.5 text-right text-xs font-mono font-semibold ${isWin ? 'text-pf-success' : 'text-pf-danger'}`}>
                              {isWin ? '+' : ''}{pnl.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })()}

          {/* Breakdown by market */}
          {!loadingPortfolio && (portfolio?.positions ?? []).length > 0 && (() => {
            const byMarket = (portfolio!.positions).reduce<Record<string, { title: string; pnl: number; count: number }>>((acc, pos) => {
              const key = pos.marketTitle ?? pos.tokenId;
              if (!acc[key]) acc[key] = { title: key, pnl: 0, count: 0 };
              acc[key].pnl += parseFloat(pos.unrealizedPnl || '0');
              acc[key].count++;
              return acc;
            }, {});
            const sorted = Object.values(byMarket).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
            return (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-pf-border-subtle">
                  <PieChart className="size-4 text-pf-text-muted" />
                  <span className="text-sm font-medium text-pf-text">Exposure by Market</span>
                </div>
                <div className="divide-y divide-pf-border-subtle">
                  {sorted.map((m) => {
                    const maxAbs = Math.max(...sorted.map(x => Math.abs(x.pnl)), 1);
                    const barPct = Math.round((Math.abs(m.pnl) / maxAbs) * 100);
                    return (
                      <div key={m.title} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-pf-text truncate" title={m.title}>{m.title}</p>
                          <div className="mt-1 h-1.5 rounded-full bg-pf-surface overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.pnl >= 0 ? 'bg-pf-success/60' : 'bg-pf-danger/60'}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-mono font-medium ${pnlColor(String(m.pnl))}`}>
                            {formatPnl(String(m.pnl))}
                          </span>
                          <p className="text-[10px] text-pf-text-muted">{m.count} position{m.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ═══ PAPER TAB ═══ */}
      {tab === 'paper' && (
        <>
          {loadingPaper ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
              </div>
              <TableSkeleton />
            </div>
          ) : paper ? (
            <>
              {/* Paper summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Paper P&L</span>
                  <span className={`block mt-1 text-xl font-mono font-semibold ${pnlColor(paper.pnl)}`}>
                    {formatPnl(paper.pnl)}
                  </span>
                </div>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Positions</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-pf-text">{paper.positions.length}</span>
                </div>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Total Orders</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-pf-text">{paper.orderCount}</span>
                </div>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={resettingPaper}
                    className="flex items-center gap-1.5 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`size-3.5 ${resettingPaper ? 'animate-spin' : ''}`} />
                    Reset Paper Account
                  </button>
                  {showResetConfirm && (
                    <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowResetConfirm(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowResetConfirm(false); }}>
                      <div role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" className="bg-pf-elevated border border-pf-border rounded-pf-lg p-6 max-w-sm mx-4 shadow-pf-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="size-5 text-pf-danger" />
                          <h2 id="reset-dialog-title" className="text-sm font-semibold text-pf-text">Reset Paper Account</h2>
                        </div>
                        <p className="text-sm text-pf-text-secondary mb-4">This will delete all paper positions and orders. This cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-surface cursor-pointer transition-colors">Cancel</button>
                          <button type="button" onClick={resetPaper} className="px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger text-white hover:bg-pf-danger/90 cursor-pointer transition-colors">Reset</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Paper positions */}
              {paper.positions.length === 0 ? (
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Wallet className="size-10 text-pf-text-muted mb-3" />
                    <p className="text-sm font-medium text-pf-text">No paper positions</p>
                    <p className="text-xs text-pf-text-muted mt-1">Start a strategy in Paper mode to simulate trades.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg">
                  <div className="px-4 py-3 border-b border-pf-border-subtle">
                    <span className="text-sm font-medium text-pf-text">Paper Positions</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" aria-label="Paper positions">
                      <thead>
                        <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                          <th scope="col" className="px-4 py-3 font-medium">Token</th>
                          <th scope="col" className="px-4 py-3 font-medium">Side</th>
                          <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                          <th scope="col" className="px-4 py-3 font-medium text-right">Unreal. P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pf-border-subtle">
                        {paper.positions.map(pos => (
                          <tr key={pos.tokenId} className="hover:bg-pf-surface/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-pf-text" title={pos.tokenId}>{formatTokenId(pos.tokenId)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                pos.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                              }`}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-pf-text">
                              {parseFloat(pos.size).toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${pnlColor(pos.unrealizedPnl)}`}>
                              {formatPnl(pos.unrealizedPnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
