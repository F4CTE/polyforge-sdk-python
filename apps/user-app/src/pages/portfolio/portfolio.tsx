import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Wallet, BarChart3,
  RefreshCw, Loader2, AlertTriangle, Fuel, PieChart, ShieldAlert,
  Shield, TrendingDown, TrendingUp, Share2, Copy, Check, Download,
  X, ChevronDown, ChevronUp, Clock, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/theme-store';
import { useAuthStore } from '@/stores/auth-store';

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
  openedAt?: string;
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

interface DailyPnlResponse {
  realizedPnl: string;
  unrealizedPnl: string;
  totalPnl: string;
}

interface DailyHeatmapEntry {
  date: string; // "2025-01-15"
  pnl: number;
}

interface UserRiskSettings {
  dailyLossLimit: number | null;
  maxPositionSize: number | null;
  maxOpenPositions: number | null;
  enabled: boolean;
}

interface PortfolioStats {
  sharpeRatio?: number | null;
  maxDrawdown?: number | null;
  longestWinStreak?: number | null;
  longestLossStreak?: number | null;
  avgHoldTimeDays?: number | null;
  bestSingleTrade?: number | null;
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

const CATEGORY_COLORS: Record<string, string> = {
  Politics: '#06b6d4',
  Sports: '#22c55e',
  Crypto: '#f59e0b',
  Finance: '#8b5cf6',
  Entertainment: '#ec4899',
  Science: '#3b82f6',
  Other: '#6b7280',
};

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

/* ─── Heatmap ────────────────────────────────────────────────────────── */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayColor(pnl: number): string {
  if (pnl === 0) return 'bg-pf-overlay';
  if (pnl > 0) {
    if (pnl > 100) return 'bg-pf-success';
    if (pnl > 25) return 'bg-pf-success/60';
    return 'bg-pf-success/25';
  } else {
    if (pnl < -100) return 'bg-pf-danger';
    if (pnl < -25) return 'bg-pf-danger/60';
    return 'bg-pf-danger/25';
  }
}

function formatDateLabel(dateStr: string, pnl: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = MONTH_NAMES[d.getMonth()];
  const day = d.getDate();
  const sign = pnl > 0 ? '+' : '';
  return `${month} ${day}: ${sign}$${Math.abs(pnl).toFixed(2)}`;
}

function HeatmapGrid({ data }: { data: DailyHeatmapEntry[] }) {
  const pnlMap = new Map<string, number>(data.map(d => [d.date, d.pnl]));

  const today = new Date();
  // Start from the 1st of the month 11 months ago
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  // Build month buckets: each bucket has weeks, each week has 7 day cells (null = padding)
  interface DayCell { date: string; pnl: number } | null;
  type WeekCol = (DayCell | null)[];

  const months: { label: string; weeks: WeekCol[] }[] = [];

  const cur = new Date(start);
  while (cur <= today) {
    const monthIdx = cur.getMonth();
    const yearIdx = cur.getFullYear();
    const monthLabel = MONTH_NAMES[monthIdx];

    // Collect all days for this month up to today
    const firstDay = new Date(yearIdx, monthIdx, 1);
    const lastDay = new Date(yearIdx, monthIdx + 1, 0); // last day of month
    const effectiveLastDay = lastDay > today ? today : lastDay;

    // Day of week offset (Mon=0 ... Sun=6)
    let startDow = firstDay.getDay(); // Sun=0..Sat=6
    startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0..Sun=6

    // Build flat list of cells for this month: leading nulls + day cells
    const cells: (DayCell | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);

    const d = new Date(firstDay);
    while (d <= effectiveLastDay) {
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({ date: dateStr, pnl: pnlMap.get(dateStr) ?? 0 });
      d.setDate(d.getDate() + 1);
    }

    // Chunk into weeks of 7
    const weeks: WeekCol[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    months.push({ label: monthLabel, weeks });
    // Advance to next month
    cur.setMonth(cur.getMonth() + 1);
    cur.setDate(1);
  }

  // Summary stats
  let profitDays = 0;
  let lossDays = 0;
  let bestDay = -Infinity;
  let worstDay = Infinity;
  data.forEach(d => {
    if (d.pnl > 0) { profitDays++; if (d.pnl > bestDay) bestDay = d.pnl; }
    if (d.pnl < 0) { lossDays++; if (d.pnl < worstDay) worstDay = d.pnl; }
  });
  const hasBest = bestDay !== -Infinity;
  const hasWorst = worstDay !== Infinity;

  return (
    <div>
      {/* Heatmap scroll container */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {/* Day-of-week labels column */}
          <div className="flex flex-col justify-start pt-5 gap-0.5 shrink-0">
            {DAY_LABELS.map(label => (
              <div key={label} className="h-2.5 flex items-center">
                <span className="text-[9px] text-pf-text-muted w-6 text-right pr-1 leading-none">{label}</span>
              </div>
            ))}
          </div>

          {/* Month columns */}
          {months.map((month, mi) => (
            <div key={`${month.label}-${mi}`} className="flex flex-col gap-0.5">
              {/* Month label */}
              <div className="text-[10px] text-pf-text-muted mb-1 leading-none">{month.label}</div>
              {/* Week columns rendered as rows of days */}
              <div className="flex gap-0.5">
                {month.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-0.5">
                    {week.map((cell, di) => (
                      cell === null
                        ? <div key={di} className="w-2.5 h-2.5" />
                        : (
                          <div
                            key={di}
                            className={`w-2.5 h-2.5 rounded-sm cursor-pointer ${dayColor(cell.pnl)}`}
                            title={formatDateLabel(cell.date, cell.pnl)}
                          />
                        )
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary row */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
          <span className="text-pf-success">{profitDays} profit day{profitDays !== 1 ? 's' : ''}</span>
          <span className="text-pf-text-muted">|</span>
          <span className="text-pf-danger">{lossDays} loss day{lossDays !== 1 ? 's' : ''}</span>
          {hasBest && (
            <>
              <span className="text-pf-text-muted">|</span>
              <span className="text-pf-success">Best: +${bestDay.toFixed(2)}</span>
            </>
          )}
          {hasWorst && (
            <>
              <span className="text-pf-text-muted">|</span>
              <span className="text-pf-danger">Worst: -${Math.abs(worstDay).toFixed(2)}</span>
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[10px] text-pf-text-muted">Less</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-overlay" title="No activity" />
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-danger" title="Loss > $100" />
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-danger/60" title="Loss $25–$100" />
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-danger/25" title="Loss < $25" />
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-success/25" title="Profit < $25" />
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-success/60" title="Profit $25–$100" />
        <div className="w-2.5 h-2.5 rounded-sm bg-pf-success" title="Profit > $100" />
        <span className="text-[10px] text-pf-text-muted">More</span>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  // Memoize CSS variable reads — avoids layout-triggering getComputedStyle on every render
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const username = user?.username ?? '';

  // Share card state
  const [edgeScore, setEdgeScore] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

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
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Daily P&L widget
  const [dailyPnl, setDailyPnl] = useState<DailyPnlResponse | null>(null);
  const [userRiskSettings, setUserRiskSettings] = useState<UserRiskSettings | null>(null);
  const [loadingDailyPnl, setLoadingDailyPnl] = useState(true);

  // Advanced stats
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);

  // Daily Returns heatmap
  const [heatmapData, setHeatmapData] = useState<DailyHeatmapEntry[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);

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

  // Load daily P&L, risk settings, advanced stats, edge score, and heatmap in parallel on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingDailyPnl(true);
    setLoadingHeatmap(true);
    Promise.all([
      fetch('/api/v1/portfolio/pnl?period=today', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/users/me/risk-settings', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/portfolio/stats', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/scores/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/portfolio/daily-pnl?months=12', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([pnlData, riskData, statsData, scoreData, heatmapRes]) => {
      if (cancelled) return;
      if (pnlData) setDailyPnl(pnlData);
      if (riskData) setUserRiskSettings(riskData);
      if (statsData) setPortfolioStats(statsData);
      if (scoreData?.score != null) setEdgeScore(typeof scoreData.score === 'number' ? scoreData.score : scoreData.score?.score ?? null);
      if (heatmapRes?.data) setHeatmapData(heatmapRes.data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) {
        setLoadingDailyPnl(false);
        setLoadingHeatmap(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

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
    const confirmed = window.confirm('Close this position? This will place a market sell order.');
    if (!confirmed) return;
    setClosingId(pos.id);
    setClosingPosition(prev => ({ ...prev, [pos.id]: true }));
    try {
      const res = await fetch('/api/v1/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tokenId: pos.tokenId,
          side: pos.side === 'BUY' ? 'SELL' : 'BUY',
          outcome: pos.outcome,
          size: pos.size,
          orderType: 'FOK',
          price: pos.currentPrice && parseFloat(pos.currentPrice) > 0
            ? parseFloat(pos.currentPrice)
            : 0.5,
        }),
      });
      if (res.ok) {
        toast.success('Close order placed');
        loadPortfolio();
      } else if (res.status === 451) {
        toast.error('Trading is not available in your region');
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.code === 'GEO_BLOCKED') {
          toast.error('Trading is not available in your region');
        } else {
          toast.error(err.message ?? 'Failed to place close order');
        }
      }
    } catch { toast.error('Failed to place close order'); }
    setClosingId(null);
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

  // Share card helpers
  function handleCopyLink() {
    const url = `https://polyforge.io/u/${username}/performance`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied!');
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => toast.error('Failed to copy link'));
  }

  function handleShareOnX() {
    const totalPnlNum = parseFloat(pnl?.totalPnl ?? '0');
    const winRateNum = Math.round(parseFloat(pnl?.winRate ?? '0') * 100);
    const pnlFormatted = totalPnlNum >= 0 ? `+$${totalPnlNum.toFixed(2)}` : `-$${Math.abs(totalPnlNum).toFixed(2)}`;
    const text = encodeURIComponent(
      `Check out my trading performance on @PolyForge! ${pnlFormatted} P&L with ${winRateNum}% win rate. polyforge.io/u/${username}/performance`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function handleDownloadCard() {
    handleCopyLink();
    toast.info('Use a screenshot to save the card');
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

          {/* ─── Share Performance ─── */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Share2 className="size-4 text-pf-cyan-400" />
              <span className="text-sm font-semibold text-pf-text">Share Performance</span>
            </div>

            {/* Preview card */}
            <div
              id="share-card"
              className="bg-gradient-to-br from-pf-surface to-pf-elevated border border-pf-cyan-500/30 rounded-pf-lg p-5 mb-4"
            >
              {/* Top row: logo + username */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      className="text-pf-cyan-400"
                    />
                    <path
                      d="M12 6L18 9.5V16.5L12 20L6 16.5V9.5L12 6Z"
                      fill="currentColor"
                      className="text-pf-cyan-500/20"
                    />
                  </svg>
                  <span className="text-sm font-bold text-pf-text tracking-wide">PolyForge</span>
                </div>
                {username && (
                  <span className="text-xs font-mono text-pf-text-muted">@{username}</span>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="text-center">
                  <p className="text-[10px] text-pf-text-muted uppercase tracking-wider mb-1">Total P&L</p>
                  <p className={`text-lg font-mono font-bold ${pnlColor(pnl?.totalPnl ?? '0')}`}>
                    {formatPnl(pnl?.totalPnl ?? '0')}
                  </p>
                </div>
                <div className="text-center border-x border-pf-border-subtle">
                  <p className="text-[10px] text-pf-text-muted uppercase tracking-wider mb-1">Win Rate</p>
                  <p className="text-lg font-mono font-bold text-pf-cyan-400">
                    {winRatePct(pnl?.winRate ?? '0')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-pf-text-muted uppercase tracking-wider mb-1">Edge Score</p>
                  <p className="text-lg font-mono font-bold text-pf-text">
                    {edgeScore != null ? edgeScore : '—'}
                  </p>
                </div>
              </div>

              {/* Tagline + footer */}
              <div className="border-t border-pf-border-subtle pt-3 flex items-end justify-between">
                <p className="text-xs text-pf-text-secondary italic">"Trading smarter on Polymarket"</p>
                <p className="text-[10px] font-mono text-pf-text-muted">polyforge.io</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs font-medium text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong transition-colors"
              >
                {linkCopied ? (
                  <Check className="size-3.5 text-pf-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {linkCopied ? 'Copied!' : 'Copy Share Link'}
              </button>
              <button
                type="button"
                onClick={handleShareOnX}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs font-medium text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share on X
              </button>
              <button
                type="button"
                onClick={handleDownloadCard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs font-medium text-pf-text-secondary hover:text-pf-text hover:border-pf-border-strong transition-colors"
              >
                <Download className="size-3.5" />
                Download Card
              </button>
            </div>
          </div>

          {/* ─── Daily P&L Widget ─── */}
          {(() => {
            const totalPnl = dailyPnl ? parseFloat(dailyPnl.totalPnl) : 0;
            const limit = userRiskSettings?.enabled ? (userRiskSettings?.dailyLossLimit ?? null) : null;
            const progress = limit != null && limit > 0
              ? Math.min(100, (Math.abs(Math.min(0, totalPnl)) / limit) * 100)
              : 0;
            const progressColor = progress >= 80
              ? 'bg-pf-danger'
              : progress >= 50
                ? 'bg-amber-400'
                : 'bg-pf-success';
            const limitHit = progress >= 100;
            const remaining = limit != null ? limit - Math.abs(Math.min(0, totalPnl)) : 0;
            return (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="size-4 text-pf-text-muted" />
                  <span className="text-sm font-medium text-pf-text">Today's P&L</span>
                </div>

                {loadingDailyPnl ? (
                  <div className="space-y-2">
                    <div className="h-8 bg-pf-overlay rounded animate-pulse w-32" />
                    <div className="h-3 bg-pf-overlay rounded animate-pulse w-full" />
                    <div className="h-3 bg-pf-overlay rounded animate-pulse w-2/3" />
                  </div>
                ) : (
                  <>
                    {/* Large P&L number */}
                    <p className={`text-3xl font-mono font-semibold mb-3 ${totalPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDC
                    </p>

                    {/* Limit hit banner */}
                    {limitHit && (
                      <div className="flex items-center gap-2 p-3 rounded-pf bg-pf-danger/10 border border-pf-danger/30 mb-3">
                        <AlertTriangle className="size-4 text-pf-danger shrink-0" />
                        <p className="text-xs font-medium text-pf-danger">Daily loss limit reached — trading paused</p>
                      </div>
                    )}

                    {/* Progress bar (only if limit is configured and enabled) */}
                    {limit != null && (
                      <div className="space-y-1.5">
                        <div className="bg-pf-surface rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColor}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-pf-text-muted">
                          <span className="flex items-center gap-1">
                            <TrendingDown className="size-3" />
                            Loss limit: ${limit.toFixed(2)}
                          </span>
                          <span>{remaining > 0 ? `$${remaining.toFixed(2)} remaining` : 'Limit reached'}</span>
                        </div>
                      </div>
                    )}

                    {/* No limit set — offer link */}
                    {limit == null && (
                      <p className="text-xs text-pf-text-muted">
                        No daily loss limit set.{' '}
                        <a href="/settings?tab=risk" className="underline text-pf-cyan-400 hover:text-pf-cyan-300">
                          Set a loss limit
                        </a>
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })()}

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
                    {portfolio!.positions.map(pos => {
                      const isExpanded = expandedId === pos.id;
                      const isClosing = closingId === pos.id;
                      const pnlNum = parseFloat(pos.unrealizedPnl);
                      const entryPrice = parseFloat(pos.avgEntryPrice);
                      const currentPrice = parseFloat(pos.currentPrice);
                      const size = parseFloat(pos.size);
                      const maxGain = pos.side === 'BUY'
                        ? ((1 - entryPrice) * size).toFixed(2)
                        : (entryPrice * size).toFixed(2);
                      const maxLoss = pos.side === 'BUY'
                        ? (entryPrice * size).toFixed(2)
                        : ((1 - entryPrice) * size).toFixed(2);
                      const timeHeld = pos.openedAt
                        ? (() => {
                            const ms = Date.now() - new Date(pos.openedAt).getTime();
                            const days = Math.floor(ms / 86400000);
                            const hours = Math.floor((ms % 86400000) / 3600000);
                            return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                          })()
                        : null;
                      return (
                        <>
                          <tr
                            key={pos.id}
                            className="hover:bg-pf-surface/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : pos.id)}
                          >
                            <td className="px-4 py-3 max-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                {isExpanded
                                  ? <ChevronUp className="size-3 text-pf-text-muted shrink-0" />
                                  : <ChevronDown className="size-3 text-pf-text-muted shrink-0" />}
                                <span className="text-pf-text line-clamp-1" title={pos.marketTitle}>{pos.marketTitle}</span>
                              </div>
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
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {pos.resolutionStatus === 'UNRESOLVED' && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); closePosition(pos); }}
                                    disabled={isClosing}
                                    className="inline-flex items-center gap-1 text-pf-danger border border-pf-danger/30 hover:bg-pf-danger/10 text-xs px-2 py-1 rounded disabled:opacity-50 transition-colors"
                                  >
                                    {isClosing
                                      ? <Loader2 className="size-3 animate-spin" />
                                      : <X className="size-3" />}
                                    Close
                                  </button>
                                )}
                                {pos.resolutionStatus === 'RESOLVED' && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); redeemPosition(pos); }}
                                    disabled={redeemingPosition[pos.id]}
                                    className="text-xs text-pf-success hover:text-pf-success disabled:opacity-50 transition-colors"
                                  >
                                    {redeemingPosition[pos.id] ? <Loader2 className="size-3 animate-spin" /> : 'Redeem'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${pos.id}-detail`}>
                              <td colSpan={8}>
                                <div className="px-4 py-3 bg-pf-surface/50 border-t border-pf-border-subtle animate-fade-in">
                                  <div className="flex flex-wrap items-start gap-6">
                                    {/* P&L prominent display */}
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-pf-text-muted uppercase tracking-wider mb-0.5">Unrealized P&L</span>
                                      <span className={`text-2xl font-mono font-bold ${pnlNum >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                                        {formatPnl(pos.unrealizedPnl)}
                                      </span>
                                      <span className="text-[10px] text-pf-text-muted mt-1 italic">Unrealized P&L updates are estimated</span>
                                    </div>

                                    {/* Detail stats */}
                                    <div className="flex flex-wrap gap-4 text-xs">
                                      <div>
                                        <p className="text-pf-text-muted mb-0.5">Entry Price</p>
                                        <p className="font-mono text-pf-text">{entryPrice.toFixed(3)}</p>
                                      </div>
                                      <div>
                                        <p className="text-pf-text-muted mb-0.5">Current Price</p>
                                        <p className="font-mono text-pf-cyan-400">
                                          {currentPrice > 0 ? currentPrice.toFixed(3) : '—'}
                                        </p>
                                      </div>
                                      {timeHeld && (
                                        <div>
                                          <p className="text-pf-text-muted mb-0.5 flex items-center gap-1">
                                            <Clock className="size-3" /> Time Held
                                          </p>
                                          <p className="font-mono text-pf-text">{timeHeld}</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-pf-text-muted mb-0.5">Max Gain</p>
                                        <p className="font-mono text-pf-success">+${maxGain}</p>
                                      </div>
                                      <div>
                                        <p className="text-pf-text-muted mb-0.5">Max Loss</p>
                                        <p className="font-mono text-pf-danger">-${maxLoss}</p>
                                      </div>
                                    </div>
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

          {/* P&L Breakdown — Realized vs Unrealized */}
          {portfolio && (
            <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
              <p className="text-xs text-pf-text-secondary uppercase tracking-wider mb-3">P&L Breakdown</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-pf-text-muted mb-1">Realized P&L</p>
                  <span className={`text-xl font-mono font-semibold ${pnlColor(portfolio.totalRealizedPnl)}`}>
                    {formatPnl(portfolio.totalRealizedPnl)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-pf-text-muted mb-1">Unrealized P&L</p>
                  <span className={`text-xl font-mono font-semibold ${pnlColor(portfolio.totalUnrealizedPnl)}`}>
                    {formatPnl(portfolio.totalUnrealizedPnl)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Position Allocation ─── */}
          {(portfolio?.positions ?? []).length > 0 && (() => {
            // Build allocation data grouped by market category
            const allocationMap = portfolio!.positions.reduce<Record<string, number>>((acc, pos) => {
              const raw = (pos as any).marketCategory ?? pos.market?.category ?? 'Other';
              const key = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
              const normalized = Object.keys(CATEGORY_COLORS).find(
                k => k.toLowerCase() === key.toLowerCase()
              ) ?? 'Other';
              acc[normalized] = (acc[normalized] ?? 0) + (parseFloat(pos.size) || 0);
              return acc;
            }, {});
            const allocationData = Object.entries(allocationMap)
              .filter(([, v]) => v > 0)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value);
            const totalAllocation = allocationData.reduce((s, d) => s + d.value, 0) || 1;

            // Top 5 positions sorted by size desc
            const topPositions = [...portfolio!.positions]
              .sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
              .slice(0, 5);

            const CustomTooltip = ({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const { name, value } = payload[0].payload;
              const pct = ((value / totalAllocation) * 100).toFixed(1);
              return (
                <div className="bg-pf-surface border border-pf-border rounded-pf px-3 py-2 text-xs font-mono shadow-pf">
                  <p className="text-pf-text font-medium">{name}</p>
                  <p className="text-pf-text-secondary">${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pct}%)</p>
                </div>
              );
            };

            return (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                {/* Section header */}
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="size-4 text-pf-text-muted" />
                  <span className="text-sm font-medium text-pf-text">Position Allocation</span>
                </div>

                {/* Donut + legend */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Donut chart */}
                  <div className="h-48 w-full sm:w-64 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={allocationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="transparent"
                        >
                          {allocationData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={CATEGORY_COLORS[entry.name] ?? CATEGORY_COLORS.Other}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend list */}
                  <div className="flex-1 space-y-2 min-w-0">
                    {allocationData.map((entry) => {
                      const color = CATEGORY_COLORS[entry.name] ?? CATEGORY_COLORS.Other;
                      const pct = ((entry.value / totalAllocation) * 100).toFixed(1);
                      return (
                        <div key={entry.name} className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="flex-1 text-sm text-pf-text capitalize truncate">{entry.name}</span>
                          <span className="text-xs font-mono text-pf-text-secondary shrink-0">
                            ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-mono text-pf-text-muted w-12 text-right shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Largest Positions table */}
                <div className="mt-5">
                  <p className="text-xs text-pf-text-secondary uppercase tracking-wider mb-2">Largest Positions</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" aria-label="Largest positions">
                      <thead>
                        <tr className="text-left text-pf-text-muted border-b border-pf-border-subtle">
                          <th className="pb-2 font-medium pr-3">Market</th>
                          <th className="pb-2 font-medium pr-3">Category</th>
                          <th className="pb-2 font-medium pr-3">Side</th>
                          <th className="pb-2 font-medium pr-3">Outcome</th>
                          <th className="pb-2 font-medium text-right pr-3">Size (USDC)</th>
                          <th className="pb-2 font-medium text-right pr-3">Current Price</th>
                          <th className="pb-2 font-medium text-right">Unreal. P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pf-border-subtle">
                        {topPositions.map((pos) => {
                          const category = (pos as any).marketCategory ?? pos.market?.category ?? null;
                          const categoryNorm = category
                            ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
                            : null;
                          const dotColor = categoryNorm
                            ? CATEGORY_COLORS[categoryNorm] ?? CATEGORY_COLORS.Other
                            : CATEGORY_COLORS.Other;
                          return (
                            <tr key={pos.id} className="hover:bg-pf-surface/40 transition-colors">
                              <td className="py-2 pr-3 max-w-[140px]">
                                <span className="truncate block text-pf-text" title={pos.marketTitle}>{pos.marketTitle}</span>
                              </td>
                              <td className="py-2 pr-3">
                                {categoryNorm ? (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="size-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
                                    <span className="text-pf-text-secondary">{categoryNorm}</span>
                                  </span>
                                ) : (
                                  <span className="text-pf-text-muted">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                <span className={`inline-flex px-1.5 py-0.5 rounded font-medium ${
                                  pos.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'
                                }`}>
                                  {pos.side}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-pf-text-secondary font-mono">{pos.outcome ?? '—'}</td>
                              <td className="py-2 pr-3 text-right font-mono text-pf-text">
                                {parseFloat(pos.size).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono text-pf-cyan-400">
                                {pos.currentPrice && parseFloat(pos.currentPrice) > 0
                                  ? `$${parseFloat(pos.currentPrice).toFixed(3)}`
                                  : <span className="text-pf-text-muted">—</span>}
                              </td>
                              <td className={`py-2 text-right font-mono font-medium ${pnlColor(pos.unrealizedPnl)}`}>
                                {formatPnl(pos.unrealizedPnl)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── Advanced Statistics ─── */}
          {(() => {
            // Compute client-side fallbacks from positions when API stats are absent
            const positions = portfolio?.positions ?? [];
            const unrealizedPnls = positions.map(p => parseFloat(p.unrealizedPnl || '0'));
            const bestSingleTradeFallback = unrealizedPnls.length > 0
              ? Math.max(...unrealizedPnls)
              : null;

            const stats = portfolioStats;
            const sharpe = stats?.sharpeRatio ?? null;
            const maxDrawdown = stats?.maxDrawdown ?? null;
            const winStreak = stats?.longestWinStreak ?? null;
            const lossStreak = stats?.longestLossStreak ?? null;
            const avgHold = stats?.avgHoldTimeDays ?? null;
            const bestTrade = stats?.bestSingleTrade ?? (bestSingleTradeFallback !== null && bestSingleTradeFallback > 0 ? bestSingleTradeFallback : null);

            const statItems: { label: string; value: React.ReactNode; tooltip?: string }[] = [
              {
                label: 'Sharpe Ratio',
                tooltip: 'Risk-adjusted return (higher is better)',
                value: sharpe != null
                  ? <span className={sharpe >= 1 ? 'text-pf-success' : sharpe >= 0 ? 'text-pf-text' : 'text-pf-danger'}>{sharpe.toFixed(2)}</span>
                  : <span className="text-pf-text-muted">—</span>,
              },
              {
                label: 'Max Drawdown',
                value: maxDrawdown != null
                  ? <span className="text-pf-danger">-${Math.abs(maxDrawdown).toFixed(2)}</span>
                  : <span className="text-pf-text-muted">—</span>,
              },
              {
                label: 'Longest Win Streak',
                value: winStreak != null
                  ? <span className="text-pf-success">{winStreak} trade{winStreak !== 1 ? 's' : ''}</span>
                  : <span className="text-pf-text-muted">—</span>,
              },
              {
                label: 'Longest Loss Streak',
                value: lossStreak != null
                  ? <span className="text-pf-danger">{lossStreak} trade{lossStreak !== 1 ? 's' : ''}</span>
                  : <span className="text-pf-text-muted">—</span>,
              },
              {
                label: 'Avg Hold Time',
                value: avgHold != null
                  ? <span className="text-pf-text">{avgHold.toFixed(1)} days</span>
                  : <span className="text-pf-text-muted">—</span>,
              },
              {
                label: 'Best Single Trade',
                value: bestTrade != null
                  ? <span className="text-pf-success">+${bestTrade.toFixed(2)}</span>
                  : <span className="text-pf-text-muted">—</span>,
              },
            ];

            return (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-4 text-pf-text-muted" />
                  <span className="text-sm font-medium text-pf-text">Advanced Statistics</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {statItems.map((item) => (
                    <div key={item.label} className="bg-pf-surface rounded-pf p-3">
                      <p
                        className="text-xs text-pf-text-muted uppercase tracking-wider mb-1"
                        title={item.tooltip}
                      >
                        {item.label}
                        {item.tooltip && (
                          <span className="ml-1 text-pf-text-muted cursor-help" title={item.tooltip}>ⓘ</span>
                        )}
                      </p>
                      <div className="text-lg font-mono font-bold leading-tight">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ─── Daily Returns Heatmap ─── */}
          <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="size-4 text-pf-text-muted" />
              <span className="text-sm font-medium text-pf-text">Daily Returns (12 months)</span>
            </div>
            {loadingHeatmap ? (
              <div className="h-32 bg-pf-overlay rounded animate-pulse" />
            ) : heatmapData.length === 0 ? (
              <p className="text-sm text-pf-text-muted">No trading data yet</p>
            ) : (
              <HeatmapGrid data={heatmapData} />
            )}
          </div>

          {/* Category Exposure */}
          {(portfolio?.positions ?? []).length > 0 && (() => {
            const byCategory = portfolio!.positions.reduce<Record<string, { count: number; exposure: number }>>((acc, pos) => {
              const key = pos.market?.category ?? 'Uncategorized';
              if (!acc[key]) acc[key] = { count: 0, exposure: 0 };
              acc[key].count++;
              acc[key].exposure += parseFloat(pos.size) || 0;
              return acc;
            }, {});
            const entries = Object.entries(byCategory).sort((a, b) => b[1].exposure - a[1].exposure);
            const totalExposure = entries.reduce((sum, [, v]) => sum + v.exposure, 0) || 1;
            return (
              <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4">
                <p className="text-xs text-pf-text-secondary uppercase tracking-wider mb-3">Category Exposure</p>
                <div className="space-y-3">
                  {entries.map(([category, { count, exposure }]) => {
                    const barPct = Math.round((exposure / totalExposure) * 100);
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-pf-text capitalize">{category}</span>
                          <span className="text-xs text-pf-text-muted font-mono">
                            {exposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} shares &middot; {count} position{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-pf-surface overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-pf-cyan-500/60"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
