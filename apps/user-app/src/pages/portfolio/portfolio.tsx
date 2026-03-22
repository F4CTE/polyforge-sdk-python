import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Target, BarChart3,
  ChevronLeft, ChevronRight, RefreshCw, X, Loader2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Position {
  id: string;
  tokenId: string;
  marketTitle: string;
  side: string;
  size: string;
  avgEntryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  resolutionStatus: string;
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
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-pf-text-muted';
}

function pnlBorderColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'border-l-emerald-400';
  if (n < 0) return 'border-l-red-400';
  return 'border-l-pf-text-muted';
}

function formatPnl(val: string): string {
  const n = parseFloat(val);
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
}

function winRatePct(val: string): string {
  return `${(parseFloat(val) * 100).toFixed(1)}%`;
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
  // Read CSS variables for Recharts (which needs raw color strings)
  const styles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const textMuted = styles?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A';
  const bgElevated = styles?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E';
  const borderColor = styles?.getPropertyValue('--color-pf-border').trim() || '#1E3350';
  const textPrimary = styles?.getPropertyValue('--color-pf-text').trim() || '#E8EDF5';

  const [tab, setTab] = useState<Tab>('live');
  const [period, setPeriodState] = useState<Period>('7d');

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [pnl, setPnl] = useState<PnlResponse | null>(null);
  const [paper, setPaper] = useState<PaperSummary | null>(null);

  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [closingPosition, setClosingPosition] = useState<Record<string, boolean>>({});
  const [resettingPaper, setResettingPaper] = useState(false);

  const loadPortfolio = useCallback(async () => {
    setLoadingPortfolio(true);
    try {
      const res = await fetch('/api/v1/portfolio', { credentials: 'include' });
      if (res.ok) setPortfolio(await res.json());
    } catch { toast.error('Failed to load data'); }
    setLoadingPortfolio(false);
  }, []);

  const loadChart = useCallback(async (p: Period) => {
    setLoadingChart(true);
    try {
      const res = await fetch(`/api/v1/portfolio/pnl?period=${p}`, { credentials: 'include' });
      if (res.ok) setPnl(await res.json());
    } catch { toast.error('Failed to load data'); }
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
    loadPortfolio();
    loadChart(period);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setPeriod(p: Period) {
    setPeriodState(p);
    loadChart(p);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'paper' && !paper) loadPaper();
  }

  async function closePosition(pos: Position) {
    setClosingPosition(prev => ({ ...prev, [pos.id]: true }));
    try {
      const res = await fetch('/api/v1/orders/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenId: pos.tokenId }),
      });
      if (res.ok) loadPortfolio();
    } catch { toast.error('Failed to close position'); }
    setClosingPosition(prev => ({ ...prev, [pos.id]: false }));
  }

  async function resetPaper() {
    if (!confirm('This will delete all paper positions and orders. This cannot be undone.')) return;
    setResettingPaper(true);
    try {
      const res = await fetch('/api/v1/paper/reset', { method: 'POST', credentials: 'include' });
      if (res.ok) setPaper({ pnl: '0', positions: [], orderCount: 0 });
    } catch { toast.error('Failed to reset paper account'); }
    setResettingPaper(false);
  }

  // Chart data
  const chartData = pnl?.snapshots.map(s => ({
    time: new Date(s.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    pnl: parseFloat(s.pnl),
  })) ?? [];
  const isProfitable = parseFloat(pnl?.totalPnl ?? '0') >= 0;
  const chartColorResolved = isProfitable
    ? (styles?.getPropertyValue('--color-pf-success').trim() || '#10B981')
    : (styles?.getPropertyValue('--color-pf-danger').trim() || '#EF4444');
  const chartColor = chartColorResolved;

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Portfolio</h1>
        <div className="flex bg-pf-surface rounded-pf border border-pf-border-subtle">
          <button
            onClick={() => handleTabChange('live')}
            className={`px-4 py-1.5 text-sm font-medium rounded-pf transition-colors ${
              tab === 'live' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => handleTabChange('paper')}
            className={`px-4 py-1.5 text-sm font-medium rounded-pf transition-colors ${
              tab === 'paper' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-secondary hover:text-pf-text'
            }`}
          >
            Paper
          </button>
        </div>
      </div>

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
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 border-l-cyan-500">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Win Rate</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-cyan-400">
                    {winRatePct(pnl?.winRate ?? '0')}
                  </span>
                </div>
                <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 border-l-pf-text">
                  <span className="text-xs text-pf-text-secondary uppercase tracking-wider">Open Positions</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-pf-text">
                    {portfolio.positions.length}
                  </span>
                </div>
              </>
            ) : (
              <div className="col-span-full bg-pf-elevated border border-red-500/20 rounded-pf-lg p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 text-red-400 opacity-60" size={32} />
                <p className="text-sm font-medium text-pf-text mb-1">Failed to load portfolio</p>
                <p className="text-xs text-pf-text-muted mb-4">Something went wrong while fetching your data.</p>
                <button
                  onClick={loadPortfolio}
                  className="px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-600 transition-colors"
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Market</th>
                      <th className="px-4 py-3 font-medium">Side</th>
                      <th className="px-4 py-3 font-medium text-right">Size</th>
                      <th className="px-4 py-3 font-medium text-right">Avg Entry</th>
                      <th className="px-4 py-3 font-medium text-right">Current</th>
                      <th className="px-4 py-3 font-medium text-right">Unreal. P&L</th>
                      <th className="px-4 py-3 font-medium text-right">Status</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pf-border-subtle">
                    {portfolio!.positions.map(pos => (
                      <tr key={pos.id} className="hover:bg-pf-surface/50 transition-colors">
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-pf-text line-clamp-1" title={pos.marketTitle}>{pos.marketTitle}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            pos.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
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
                        <td className="px-4 py-3 text-right font-mono text-cyan-400">
                          {+pos.currentPrice === 0 ? '\u2014' : parseFloat(pos.currentPrice).toFixed(3)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${pnlColor(pos.unrealizedPnl)}`}>
                          {formatPnl(pos.unrealizedPnl)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            pos.resolutionStatus === 'UNRESOLVED'
                              ? 'bg-cyan-500/10 text-cyan-400'
                              : 'bg-pf-overlay text-pf-text-muted'
                          }`}>
                            {pos.resolutionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pos.resolutionStatus === 'UNRESOLVED' && (
                            <button
                              onClick={() => closePosition(pos)}
                              disabled={closingPosition[pos.id]}
                              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                            >
                              {closingPosition[pos.id] ? <Loader2 className="size-3 animate-spin" /> : 'Close'}
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
                    onClick={resetPaper}
                    disabled={resettingPaper}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`size-3.5 ${resettingPaper ? 'animate-spin' : ''}`} />
                    Reset Paper Account
                  </button>
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                          <th className="px-4 py-3 font-medium">Token</th>
                          <th className="px-4 py-3 font-medium">Side</th>
                          <th className="px-4 py-3 font-medium text-right">Size</th>
                          <th className="px-4 py-3 font-medium text-right">Unreal. P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pf-border-subtle">
                        {paper.positions.map(pos => (
                          <tr key={pos.tokenId} className="hover:bg-pf-surface/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-pf-text-secondary">{pos.tokenId}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                pos.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
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
