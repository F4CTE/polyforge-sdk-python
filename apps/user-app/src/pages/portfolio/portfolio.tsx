import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Wallet, BarChart3,
  RefreshCw, Loader2, AlertTriangle, Fuel, PieChart, ShieldAlert,
  Shield, TrendingDown, TrendingUp, Share2, Copy, Check, Download,
  X, ChevronDown, ChevronUp, Clock, CalendarDays, Receipt, FileText,
  Target, Pencil, Trash2, Trophy, ShieldCheck,
  Lightbulb, Shuffle, CheckCircle2, SlidersHorizontal,
  Wifi, WifiOff,
} from 'lucide-react';
import { wsManager } from '@/lib/websocket';
import { toast } from 'sonner';
import { notifyApiError } from '@/lib/api-error';
import { useThemeStore } from '@/stores/theme-store';
import { useAuthStore, authedFetch } from '@/stores/auth-store';
import { Button, Input, Select, CardSkeleton } from '@polyforge/ui';
import { useBetaUsage } from '@/hooks/use-beta-usage';
import { useWebSocketConnectionState } from '@/hooks/use-websocket-connection-state';
import { BetaUsageBar } from '@/components/beta-usage-bar';
import { RewardsDashboard } from '@/components/rewards/rewards-dashboard';
import {
  clearPendingIdempotencyKeyForId,
  getOrCreatePendingIdempotencyKeyForId,
  idempotencyHeaders,
} from '@/lib/idempotency';
import { resolveChartTheme } from '@polyforge/ui/lib/chart-colors';
import { chartTooltipContentStyle, chartTooltipLabelStyle, chartAxisTick } from '@polyforge/ui/lib/chart-styles';

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

interface TaxEntry {
  id: string;
  marketQuestion: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  openDate: string;
  closeDate: string;
  quantity: number;
  costBasis: number;
  proceeds: number;
  realizedGain: number;
  holdingDays: number;
  type: 'SHORT_TERM' | 'LONG_TERM';
}

interface TaxSummary {
  totalRealizedGain: number;
  totalRealizedLoss: number;
  netGain: number;
  shortTermGain: number;
  longTermGain: number;
  totalProceeds: number;
  totalCostBasis: number;
  tradeCount: number;
}

interface PortfolioGoal {
  id: string;
  label: string;
  targetAmount: number;
  startDate: string;
  endDate: string;
  startPnl: number;
}

interface RiskCell {
  category: string; // 'politics' | 'sports' | 'crypto' | 'finance' | 'entertainment' | 'science'
  outcome: 'YES' | 'NO';
  totalValue: number; // USDC allocated
  positionCount: number;
  pnl: number; // unrealised P&L for this cell
}

interface RebalanceSuggestion {
  id: string;
  type: 'reduce' | 'diversify' | 'close' | 'hedge';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedCategory?: string;
  affectedOutcome?: 'YES' | 'NO';
  currentPct: number;
  targetPct: number;
  estimatedImpact: string;
}

interface RiskHeatmapData {
  cells: RiskCell[];
  totalValue: number;
  maxCellValue: number;
}

interface AutoCloseRule {
  id: string;
  positionId: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  status: 'active' | 'triggered' | 'cancelled';
  triggeredAt?: string;
}

interface PositionPriceUpdate {
  type: 'POSITION_PRICE_UPDATE';
  positionId: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  currentPrice: number;
  previousPrice: number;
  priceChangePct: number;
  timestamp: string;
}

interface PortfolioPnlUpdate {
  type: 'PORTFOLIO_PNL_UPDATE';
  totalPnl: number;
  totalPnlPct: number;
  dayPnl: number;
  dayPnlPct: number;
  unrealisedPnl: number;
  timestamp: string;
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
  Politics: 'var(--accent-default)',
  Sports: 'var(--gain)',
  Crypto: 'var(--chart-category-3)',
  Finance: 'var(--chart-category-2)',
  Entertainment: 'var(--loss)',
  Science: 'var(--info)',
  Other: 'var(--text-tertiary)',
};

function pnlColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'text-gain';
  if (n < 0) return 'text-loss';
  return 'text-tertiary';
}

function pnlBorderColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return 'border-l-gain';
  if (n < 0) return 'border-l-loss';
  return 'border-l-tertiary';
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
    crypto: 'bg-gold-500/15 text-gold-500 border-gold-500/30',
    politics: 'bg-info-subtle text-info border-info/30',
    sports: 'bg-gain-subtle text-gain border-gain/30',
    entertainment: 'bg-variable-subtle text-variable-text border-variable/30',
    science: 'bg-accent-subtle text-accent-text border-accent/30',
  };
  const key = category.toLowerCase();
  const cls = colors[key] ?? 'bg-surface text-tertiary border-default';
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-sm text-caption font-medium border ${cls}`}>
      {category}
    </span>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function PortfolioCardSkeleton() {
  return <CardSkeleton className="h-20" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-10 bg-overlay rounded-sm animate-pulse" />
      ))}
    </div>
  );
}

/* ─── Heatmap ────────────────────────────────────────────────────────── */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayColor(pnl: number): string {
  if (pnl === 0) return 'bg-overlay';
  if (pnl > 0) {
    if (pnl > 100) return 'bg-gain';
    if (pnl > 25) return 'bg-gain/60';
    return 'bg-gain/25';
  } else {
    if (pnl < -100) return 'bg-loss';
    if (pnl < -25) return 'bg-loss/60';
    return 'bg-loss/25';
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
  type DayCell = { date: string; pnl: number } | null;
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
          <div className="flex flex-col justify-start pt-5 gap-1 shrink-0">
            {DAY_LABELS.map(label => (
              <div key={label} className="h-3 flex items-center">
                <span className="text-caption text-tertiary w-6 text-right pr-1 leading-none">{label}</span>
              </div>
            ))}
          </div>

          {/* Month columns */}
          {months.map((month, mi) => (
            <div key={`${month.label}-${mi}`} className="flex flex-col gap-1">
              {/* Month label */}
              <div className="text-caption text-tertiary mb-1 leading-none">{month.label}</div>
              {/* Week columns rendered as rows of days */}
              <div className="flex gap-1">
                {month.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((cell, di) => (
                      cell === null
                        ? <div key={di} className="w-3 h-3" />
                        : (
                          <div
                            key={di}
                            className={`w-3 h-3 rounded-sm cursor-pointer ${dayColor(cell.pnl)}`}
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
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-label">
          <span className="text-gain"><span className="font-mono">{profitDays}</span> profit day{profitDays !== 1 ? 's' : ''}</span>
          <span className="text-tertiary">|</span>
          <span className="text-loss"><span className="font-mono">{lossDays}</span> loss day{lossDays !== 1 ? 's' : ''}</span>
          {hasBest && (
            <>
              <span className="text-tertiary">|</span>
              <span className="text-gain">Best: <span className="font-mono">+${bestDay.toFixed(2)}</span></span>
            </>
          )}
          {hasWorst && (
            <>
              <span className="text-tertiary">|</span>
              <span className="text-loss">Worst: <span className="font-mono">-${Math.abs(worstDay).toFixed(2)}</span></span>
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-caption text-tertiary">Less</span>
        <div className="w-3 h-3 rounded-sm bg-overlay" title="No activity" />
        <div className="w-3 h-3 rounded-sm bg-loss" title="Loss > $100" />
        <div className="w-3 h-3 rounded-sm bg-loss/60" title="Loss $25–$100" />
        <div className="w-3 h-3 rounded-sm bg-loss/25" title="Loss < $25" />
        <div className="w-3 h-3 rounded-sm bg-gain/25" title="Profit < $25" />
        <div className="w-3 h-3 rounded-sm bg-gain/60" title="Profit $25–$100" />
        <div className="w-3 h-3 rounded-sm bg-gain" title="Profit > $100" />
        <span className="text-caption text-tertiary">More</span>
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

  const { usage: betaUsage } = useBetaUsage();

  // Share card state
  const [edgeScore, setEdgeScore] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const themeColors = useMemo(() => resolveChartTheme(), [isDark]);
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
  const closePositionIdempotencyKeysRef = useRef<Record<string, string | undefined>>({});
  const redeemPositionIdempotencyKeysRef = useRef<Record<string, string | undefined>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auto-close rules
  const [autoCloseRules, setAutoCloseRules] = useState<Record<string, AutoCloseRule>>({});
  const [expandedAutoClose, setExpandedAutoClose] = useState<string | null>(null);
  const [acLoading, setAcLoading] = useState<Record<string, boolean>>({});
  const [acSubmitting, setAcSubmitting] = useState<Record<string, boolean>>({});
  const [acSlEnabled, setAcSlEnabled] = useState<Record<string, boolean>>({});
  const [acTpEnabled, setAcTpEnabled] = useState<Record<string, boolean>>({});
  const [acSlPrice, setAcSlPrice] = useState<Record<string, string>>({});
  const [acTpPrice, setAcTpPrice] = useState<Record<string, string>>({});
  const [acQuantityAll, setAcQuantityAll] = useState<Record<string, boolean>>({});
  const [acQuantity, setAcQuantity] = useState<Record<string, string>>({});
  const [acErrors, setAcErrors] = useState<Record<string, string>>({});

  // Daily P&L widget
  const [dailyPnl, setDailyPnl] = useState<DailyPnlResponse | null>(null);
  const [userRiskSettings, setUserRiskSettings] = useState<UserRiskSettings | null>(null);
  const [loadingDailyPnl, setLoadingDailyPnl] = useState(true);

  // Advanced stats
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);

  // Daily Returns heatmap
  const [heatmapData, setHeatmapData] = useState<DailyHeatmapEntry[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);

  // Risk Concentration Heatmap
  const [riskHeatmap, setRiskHeatmap] = useState<RiskHeatmapData | null>(null);
  const [loadingRiskHeatmap, setLoadingRiskHeatmap] = useState(true);

  // Rebalancing Suggestions
  const [suggestions, setSuggestions] = useState<RebalanceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pf-dismissed-suggestions') || '[]'); } catch { return []; }
  });

  // Tax Report
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState<number>(currentYear);
  const [taxData, setTaxData] = useState<TaxEntry[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loadingTax, setLoadingTax] = useState(true);
  const [exportingTax, setExportingTax] = useState(false);
  const [taxExpanded, setTaxExpanded] = useState(false);

  // Goal Tracker
  const [goals, setGoals] = useState<PortfolioGoal[]>(() => {
    try { return JSON.parse(localStorage.getItem('pf-portfolio-goals') || '[]'); } catch { return []; }
  });
  const [activeGoalIdx, setActiveGoalIdx] = useState(0);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoalLabel, setNewGoalLabel] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');

  useEffect(() => {
    localStorage.setItem('pf-portfolio-goals', JSON.stringify(goals));
  }, [goals]);

  // ── Live P&L via WebSocket ────────────────────────────────────────────
  const [livePositionPrices, setLivePositionPrices] = useState<Record<string, number>>({});
  const [livePnl, setLivePnl] = useState<{
    totalPnl: number;
    totalPnlPct: number;
    dayPnl: number;
    dayPnlPct: number;
    unrealisedPnl: number;
  } | null>(null);
  const wsConnected = useWebSocketConnectionState();
  // Flash state: set of positionIds whose price cell is flashing
  const [flashingPrices, setFlashingPrices] = useState<Record<string, 'up' | 'down' | null>>({});
  // Flash state for the header bar (direction determines animation class)
  const [pnlFlashing, setPnlFlashing] = useState(false);
  const [pnlFlashDir, setPnlFlashDir] = useState<'gain' | 'loss'>('gain');
  const [pnlFlashKey, setPnlFlashKey] = useState(0);

  useEffect(() => {
    const handler = (msg: { type: string; [key: string]: unknown }) => {
      if (msg.type === 'POSITION_PRICE_UPDATE') {
        const update = msg as unknown as PositionPriceUpdate;
        setLivePositionPrices(prev => ({ ...prev, [update.positionId]: update.currentPrice }));
        // Determine direction for flash colour
        const direction: 'up' | 'down' = update.currentPrice >= update.previousPrice ? 'up' : 'down';
        setFlashingPrices(prev => ({ ...prev, [update.positionId]: direction }));
        setTimeout(() => {
          setFlashingPrices(prev => ({ ...prev, [update.positionId]: null }));
        }, 600);
      }
      if (msg.type === 'PORTFOLIO_PNL_UPDATE') {
        const update = msg as unknown as PortfolioPnlUpdate;
        setLivePnl({
          totalPnl: update.totalPnl,
          totalPnlPct: update.totalPnlPct,
          dayPnl: update.dayPnl,
          dayPnlPct: update.dayPnlPct,
          unrealisedPnl: update.unrealisedPnl,
        });
        setPnlFlashDir(update.totalPnl >= 0 ? 'gain' : 'loss');
        setPnlFlashKey(k => k + 1);
        setPnlFlashing(true);
        setTimeout(() => setPnlFlashing(false), 600);
      }
    };

    wsManager.addListener(handler);

    return () => {
      wsManager.removeListener(handler);
    };
  }, []);

  const loadPortfolio = useCallback(async () => {
    setLoadingPortfolio(true);
    try {
      const res = await fetch('/api/v1/portfolio', { credentials: 'include' });
      if (res.ok) setPortfolio(await res.json());
    } catch { toast.error('Failed to load data'); }
    setLoadingPortfolio(false);
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/v1/portfolio/rebalance-suggestions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch { /* silently ignore — non-critical */ }
    setLoadingSuggestions(false);
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

  // Load daily P&L, risk settings, advanced stats, edge score, heatmap, and risk heatmap in parallel on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingDailyPnl(true);
    setLoadingHeatmap(true);
    setLoadingRiskHeatmap(true);
    loadSuggestions();
    Promise.all([
      fetch('/api/v1/portfolio/pnl?period=today', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/users/me/risk-settings', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/portfolio/stats', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      authedFetch('/api/v1/scores/me').then(r => r.ok ? r.json() : null),
      fetch('/api/v1/portfolio/daily-pnl?months=12', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('/api/v1/portfolio/risk-heatmap', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([pnlData, riskData, statsData, scoreData, heatmapRes, riskHeatmapRes]) => {
      if (cancelled) return;
      if (pnlData) setDailyPnl(pnlData);
      if (riskData) setUserRiskSettings(riskData);
      if (statsData) setPortfolioStats(statsData);
      if (scoreData?.score != null) setEdgeScore(typeof scoreData.score === 'number' ? scoreData.score : scoreData.score?.score ?? null);
      if (heatmapRes?.data) setHeatmapData(heatmapRes.data);
      if (riskHeatmapRes) setRiskHeatmap(riskHeatmapRes);
    }).catch(() => toast.error('Failed to load portfolio data')).finally(() => {
      if (!cancelled) {
        setLoadingDailyPnl(false);
        setLoadingHeatmap(false);
        setLoadingRiskHeatmap(false);
      }
    });
    return () => { cancelled = true; };
  }, [loadSuggestions]);

  // Tax report fetch — runs on mount and when taxYear changes
  useEffect(() => {
    let cancelled = false;
    setLoadingTax(true);
    fetch(`/api/v1/portfolio/tax-report?year=${taxYear}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (cancelled || !res) return;
        setTaxData(res.data ?? []);
        setTaxSummary(res.summary ?? null);
      })
      .catch(err => { notifyApiError(err, "load tax report"); })
      .finally(() => { if (!cancelled) setLoadingTax(false); });
    return () => { cancelled = true; };
  }, [taxYear]);

  function downloadTaxCsv(entries: TaxEntry[], year: number) {
    setExportingTax(true);
    try {
      const headers = ['Date Opened', 'Date Closed', 'Market', 'Outcome', 'Quantity', 'Cost Basis', 'Proceeds', 'Realized Gain/Loss', 'Hold Days', 'Term'];
      const rows = entries.map(e => [
        e.openDate, e.closeDate,
        `"${e.marketQuestion.replace(/"/g, '""')}"`,
        e.outcome, e.quantity,
        e.costBasis.toFixed(2), e.proceeds.toFixed(2),
        e.realizedGain.toFixed(2), e.holdingDays,
        e.type === 'SHORT_TERM' ? 'Short-term' : 'Long-term',
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `polyforge-tax-report-${year}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${entries.length} transactions`);
    } catch {
      toast.error('Failed to generate CSV');
    }
    setExportingTax(false);
  }

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
      const idempotencyKey = getOrCreatePendingIdempotencyKeyForId(closePositionIdempotencyKeysRef, pos.id, 'close-position');
      const res = await fetch('/api/v1/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idempotencyHeaders(idempotencyKey) },
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
    } catch {
      toast.error('Failed to place close order');
    } finally {
      clearPendingIdempotencyKeyForId(closePositionIdempotencyKeysRef, pos.id);
      setClosingId(null);
      setClosingPosition(prev => ({ ...prev, [pos.id]: false }));
    }
  }

  async function redeemPosition(pos: Position) {
    setRedeemingPosition(prev => ({ ...prev, [pos.id]: true }));
    try {
      const idempotencyKey = getOrCreatePendingIdempotencyKeyForId(redeemPositionIdempotencyKeysRef, pos.id, 'redeem-position');
      const res = await fetch('/api/v1/orders/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...idempotencyHeaders(idempotencyKey) },
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
    } catch {
      toast.error('Failed to redeem position');
    } finally {
      clearPendingIdempotencyKeyForId(redeemPositionIdempotencyKeysRef, pos.id);
      setRedeemingPosition(prev => ({ ...prev, [pos.id]: false }));
    }
  }

  async function loadAutoCloseRule(positionId: string) {
    setAcLoading(prev => ({ ...prev, [positionId]: true }));
    try {
      const res = await fetch(`/api/v1/positions/${positionId}/auto-close`, { credentials: 'include' });
      if (res.ok) {
        const rule: AutoCloseRule | null = await res.json();
        if (rule) {
          setAutoCloseRules(prev => ({ ...prev, [positionId]: rule }));
          setAcSlEnabled(prev => ({ ...prev, [positionId]: rule.stopLoss != null }));
          setAcTpEnabled(prev => ({ ...prev, [positionId]: rule.takeProfit != null }));
          setAcSlPrice(prev => ({ ...prev, [positionId]: rule.stopLoss != null ? String(rule.stopLoss) : '' }));
          setAcTpPrice(prev => ({ ...prev, [positionId]: rule.takeProfit != null ? String(rule.takeProfit) : '' }));
          setAcQuantityAll(prev => ({ ...prev, [positionId]: rule.quantity == null }));
          setAcQuantity(prev => ({ ...prev, [positionId]: rule.quantity != null ? String(rule.quantity) : '' }));
        } else {
          setAcQuantityAll(prev => ({ ...prev, [positionId]: true }));
        }
      } else {
        setAcQuantityAll(prev => ({ ...prev, [positionId]: true }));
      }
    } catch {
      setAcQuantityAll(prev => ({ ...prev, [positionId]: true }));
    }
    setAcLoading(prev => ({ ...prev, [positionId]: false }));
  }

  function openAutoClosePanel(positionId: string) {
    if (expandedAutoClose === positionId) {
      setExpandedAutoClose(null);
      return;
    }
    setExpandedAutoClose(positionId);
    setAcErrors(prev => ({ ...prev, [positionId]: '' }));
    if (!(positionId in autoCloseRules) && !acLoading[positionId]) {
      loadAutoCloseRule(positionId);
    }
  }

  async function saveAutoCloseRule(pos: Position) {
    const positionId = pos.id;
    const slEnabled = acSlEnabled[positionId] ?? false;
    const tpEnabled = acTpEnabled[positionId] ?? false;
    const slVal = parseFloat(acSlPrice[positionId] ?? '');
    const tpVal = parseFloat(acTpPrice[positionId] ?? '');
    const currentPrice = parseFloat(pos.currentPrice);

    // Validation
    if (!slEnabled && !tpEnabled) {
      setAcErrors(prev => ({ ...prev, [positionId]: 'Enable at least one rule (stop-loss or take-profit).' }));
      return;
    }
    if (slEnabled) {
      if (Number.isNaN(slVal) || slVal < 0.01 || slVal > 0.99) {
        setAcErrors(prev => ({ ...prev, [positionId]: 'Stop-loss must be between 0.01 and 0.99.' }));
        return;
      }
      if (currentPrice > 0 && slVal >= currentPrice) {
        setAcErrors(prev => ({ ...prev, [positionId]: `Stop-loss must be below the current price (${currentPrice.toFixed(3)}).` }));
        return;
      }
    }
    if (tpEnabled) {
      if (Number.isNaN(tpVal) || tpVal < 0.01 || tpVal > 0.99) {
        setAcErrors(prev => ({ ...prev, [positionId]: 'Take-profit must be between 0.01 and 0.99.' }));
        return;
      }
      if (currentPrice > 0 && tpVal <= currentPrice) {
        setAcErrors(prev => ({ ...prev, [positionId]: `Take-profit must be above the current price (${currentPrice.toFixed(3)}).` }));
        return;
      }
    }
    setAcErrors(prev => ({ ...prev, [positionId]: '' }));
    setAcSubmitting(prev => ({ ...prev, [positionId]: true }));
    try {
      const quantityAll = acQuantityAll[positionId] ?? true;
      const quantityStr = acQuantity[positionId] ?? '';
      const quantityNum = !quantityAll && quantityStr ? parseFloat(quantityStr) : undefined;
      const body: Record<string, number | undefined> = {};
      if (slEnabled) body.stopLoss = slVal;
      if (tpEnabled) body.takeProfit = tpVal;
      if (quantityNum != null && !Number.isNaN(quantityNum)) body.quantity = quantityNum;
      const res = await fetch(`/api/v1/positions/${positionId}/auto-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const rule: AutoCloseRule = await res.json();
        setAutoCloseRules(prev => ({ ...prev, [positionId]: rule }));
        toast.success('Auto-close rule saved');
        setExpandedAutoClose(null);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Failed to save rule');
      }
    } catch {
      toast.error('Failed to save rule');
    }
    setAcSubmitting(prev => ({ ...prev, [positionId]: false }));
  }

  async function deleteAutoCloseRule(positionId: string) {
    setAcSubmitting(prev => ({ ...prev, [positionId]: true }));
    try {
      const res = await fetch(`/api/v1/positions/${positionId}/auto-close`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setAutoCloseRules(prev => {
          const next = { ...prev };
          delete next[positionId];
          return next;
        });
        setAcSlEnabled(prev => ({ ...prev, [positionId]: false }));
        setAcTpEnabled(prev => ({ ...prev, [positionId]: false }));
        setAcSlPrice(prev => ({ ...prev, [positionId]: '' }));
        setAcTpPrice(prev => ({ ...prev, [positionId]: '' }));
        toast.success('Auto-close rule removed');
        setExpandedAutoClose(null);
      } else {
        toast.error('Failed to remove rule');
      }
    } catch {
      toast.error('Failed to remove rule');
    }
    setAcSubmitting(prev => ({ ...prev, [positionId]: false }));
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
      .catch(err => { notifyApiError(err, "request"); });
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

  function dismissSuggestion(id: string) {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try { localStorage.setItem('pf-dismissed-suggestions', JSON.stringify(next)); } catch { /* ignore */ }
    toast('Suggestion dismissed');
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
    const { success, danger } = resolveChartTheme();
    return isProfitable ? success : danger;
  }, [isProfitable, isDark]);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-primary">Portfolio</h1>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gain/10 text-gain text-label font-medium border border-gain/20" title="Gas fees are sponsored — you pay zero network fees">
            <Fuel className="size-3" />
            Gasless
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* WS connection dot */}
          <div className="flex items-center gap-1" title={wsConnected === 'connected' ? 'WebSocket connected — live prices active' : 'WebSocket offline'}>
            {wsConnected === 'connected' ? (
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-60" />
                <span className="relative inline-flex rounded-full size-2 bg-gain" />
              </span>
            ) : (
              <span className="inline-flex rounded-full size-2 bg-tertiary" />
            )}
            <span className={`text-caption font-medium ${wsConnected === 'connected' ? 'text-gain' : 'text-tertiary'}`}>
              {wsConnected === 'connected' ? 'Live' : 'Offline'}
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            className="flex items-center gap-2"
          >
            <Download size={12} strokeWidth={1.5} />
            Export CSV
          </Button>
          <div className="flex bg-surface rounded-pf border border-subtle" role="tablist" aria-label="Portfolio mode">
            <Button
              type="button"
              variant={tab === 'live' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('live')}
              role="tab"
              aria-selected={tab === 'live'}
            >
              Live
            </Button>
            <Button
              type="button"
              variant={tab === 'paper' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('paper')}
              role="tab"
              aria-selected={tab === 'paper'}
            >
              Paper
            </Button>
          </div>
        </div>
      </div>

      {/* ── Beta monthly volume indicator ──────────────────────────────── */}
      {betaUsage && (
        <BetaUsageBar
          label="monthly volume used"
          used={betaUsage.monthlyVolume.usedUsdc}
          limit={betaUsage.monthlyVolume.limitUsdc}
          format={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          className="max-w-sm"
        />
      )}

      {/* ── Live P&L Strip ─────────────────────────────────────────────── */}
      {(() => {
        // Use live data when available, fall back to API data
        const totalPnlNum = livePnl != null
          ? livePnl.totalPnl
          : parseFloat(pnl?.totalPnl ?? '0');
        const totalPnlPctNum = livePnl?.totalPnlPct ?? null;
        const dayPnlNum = livePnl?.dayPnl ?? null;
        const dayPnlPctNum = livePnl?.dayPnlPct ?? null;
        const unrealisedNum = livePnl != null
          ? livePnl.unrealisedPnl
          : parseFloat(portfolio?.totalUnrealizedPnl ?? '0');

        const fmtPnl = (n: number) => `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
        const fmtPct = (n: number) => `(${n >= 0 ? '+' : ''}${n.toFixed(1)}%)`;
        const colorClass = (n: number) => n >= 0 ? 'text-gain' : 'text-loss';

        return (
          <div
            className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 rounded-pf border transition-colors ${
              pnlFlashing
                ? 'bg-elevated/80 border-default'
                : 'bg-elevated border-default'
            }`}
            aria-live="polite"
            aria-label="Live portfolio P&L"
          >
            {/* Connection indicator */}
            <div className="flex items-center gap-2 shrink-0">
              {wsConnected === 'connected' ? (
                <>
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gain opacity-60" />
                    <span className="relative inline-flex rounded-full size-2 bg-gain" />
                  </span>
                  <span className="text-label font-medium text-gain">Live</span>
                  <Wifi className="size-3 text-gain" />
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full size-2 bg-tertiary" />
                  <span className="text-label font-medium text-tertiary">Offline</span>
                  <WifiOff className="size-3 text-tertiary" />
                </>
              )}
            </div>

            <span className="w-px h-4 bg-default shrink-0 hidden sm:block" />

            {/* Total P&L */}
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-label text-secondary">Total P&L</span>
              <span
                key={pnlFlashKey}
                className={`text-body-md font-mono font-semibold px-1 rounded-sm ${colorClass(totalPnlNum)} ${
                  pnlFlashing
                    ? pnlFlashDir === 'gain'
                      ? 'animate-value-flash-gain'
                      : 'animate-value-flash-loss'
                    : ''
                }`}
              >
                {fmtPnl(totalPnlNum)}
              </span>
              {totalPnlPctNum != null && (
                <span className={`text-label font-mono ${colorClass(totalPnlPctNum)}`}>
                  {fmtPct(totalPnlPctNum)}
                </span>
              )}
              {totalPnlNum >= 0
                ? <TrendingUp className="size-3 text-gain" />
                : <TrendingDown className="size-3 text-loss" />}
            </div>

            {dayPnlNum != null && (
              <>
                <span className="w-px h-4 bg-default shrink-0 hidden sm:block" />
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="text-label text-secondary">Today</span>
                  <span className={`text-body-md font-mono font-semibold ${colorClass(dayPnlNum)}`}>
                    {fmtPnl(dayPnlNum)}
                  </span>
                  {dayPnlPctNum != null && (
                    <span className={`text-label font-mono ${colorClass(dayPnlPctNum)}`}>
                      {fmtPct(dayPnlPctNum)}
                    </span>
                  )}
                </div>
              </>
            )}

            <span className="w-px h-4 bg-default shrink-0 hidden sm:block" />

            {/* Unrealised P&L */}
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-label text-secondary">Unrealised</span>
              <span className={`text-body-md font-mono font-semibold ${colorClass(unrealisedNum)}`}>
                {fmtPnl(unrealisedNum)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Circuit Breaker Banner */}
      {circuitBreakerTripped && (
        <div className="flex items-start gap-3 p-4 rounded-pf bg-loss/10 border border-loss/30">
          <ShieldAlert className="size-5 text-loss shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-body-md font-semibold text-loss">Circuit Breaker Active</p>
            <p className="text-label text-secondary mt-1">
              All strategies have been paused due to drawdown exceeding your risk threshold.
              {circuitBreakerTrippedAt && (
                <span> Triggered {new Date(circuitBreakerTrippedAt).toLocaleString()}.</span>
              )}
              {' '}
              <a href="/settings?tab=risk" className="underline text-loss hover:text-loss/80">Reset in Settings &rarr;</a>
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
              [1, 2, 3, 4].map(i => <PortfolioCardSkeleton key={i} />)
            ) : portfolio ? (
              <>
                <div className={`bg-elevated border border-default rounded-pf p-4 border-l-4 ${pnlBorderColor(portfolio.totalUnrealizedPnl)}`}>
                  <span className="text-label text-secondary uppercase tracking-wider">Unrealized P&L</span>
                  <span data-testid="stat-pnl" className={`block mt-1 text-xl font-mono font-semibold ${pnlColor(portfolio.totalUnrealizedPnl)}`}>
                    {formatPnl(portfolio.totalUnrealizedPnl)}
                  </span>
                </div>
                <div className={`bg-elevated border border-default rounded-pf p-4 border-l-4 ${pnlBorderColor(portfolio.totalRealizedPnl)}`}>
                  <span className="text-label text-secondary uppercase tracking-wider">Realized P&L</span>
                  <span data-testid="stat-return" className={`block mt-1 text-xl font-mono font-semibold ${pnlColor(portfolio.totalRealizedPnl)}`}>
                    {formatPnl(portfolio.totalRealizedPnl)}
                  </span>
                </div>
                <div className="bg-elevated border border-default rounded-pf p-4 border-l-4 border-l-accent">
                  <span className="text-label text-secondary uppercase tracking-wider">Win Rate</span>
                  <span data-testid="stat-win-rate" className="block mt-1 text-xl font-mono font-semibold text-accent-text">
                    {parseFloat(pnl?.winRate ?? '0') === 0 && (portfolio?.positions ?? []).length > 0
                      ? '—'
                      : winRatePct(pnl?.winRate ?? '0')}
                  </span>
                  {parseFloat(pnl?.winRate ?? '0') === 0 && (portfolio?.positions ?? []).length > 0 && (
                    <span className="text-caption text-tertiary mt-1 block">No resolved trades yet</span>
                  )}
                </div>
                <div className="bg-elevated border border-default rounded-pf p-4 border-l-4 border-l-primary">
                  <span className="text-label text-secondary uppercase tracking-wider">Open Positions</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-primary">
                    {portfolio.positions.length}
                  </span>
                </div>
              </>
            ) : (
              <div className="col-span-full bg-elevated border border-loss/20 rounded-pf p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 text-loss opacity-60" size={32} />
                <p className="text-body-md font-medium text-primary mb-1">Failed to load portfolio</p>
                <p className="text-label text-tertiary mb-4">Something went wrong while fetching your data.</p>
                <Button type="button" variant="default" onClick={loadPortfolio}>
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* ─── Rewards & Rebates ─── */}
          <RewardsDashboard />

          {/* ─── Tax Report ─── */}
          <div className="bg-elevated border border-default rounded-pf p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-accent-text" />
                <span className="text-body-md font-semibold text-primary">Tax Report</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={taxYear}
                  onChange={e => setTaxYear(Number(e.target.value))}
                  className="w-auto"
                >
                  {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={exportingTax || taxData.length === 0}
                  onClick={() => downloadTaxCsv(taxData, taxYear)}
                  className="flex items-center gap-2"
                >
                  <Download className="size-4" />
                  {exportingTax ? 'Exporting…' : 'Download CSV'}
                </Button>
              </div>
            </div>

            {/* Summary cards */}
            {loadingTax ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-overlay rounded-pf animate-pulse" />)}
              </div>
            ) : taxSummary ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Net Realized Gain/Loss */}
                <div className={`bg-surface border border-default rounded-pf p-3 border-l-4 ${taxSummary.netGain >= 0 ? 'border-l-gain' : 'border-l-loss'}`}>
                  <span className="text-caption text-secondary uppercase tracking-wider block mb-1">Net Realized Gain/Loss</span>
                  <span className={`text-lg font-mono font-semibold ${taxSummary.netGain >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {taxSummary.netGain >= 0 ? '+' : ''}{taxSummary.netGain.toFixed(2)} USDC
                  </span>
                </div>
                {/* Short-term Gains */}
                <div className="bg-surface border border-default rounded-pf p-3">
                  <span className="text-caption text-secondary uppercase tracking-wider block mb-1">Short-term Gains</span>
                  <span className={`text-lg font-mono font-semibold ${taxSummary.shortTermGain >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {taxSummary.shortTermGain >= 0 ? '+' : ''}{taxSummary.shortTermGain.toFixed(2)} USDC
                  </span>
                </div>
                {/* Long-term Gains */}
                <div className="bg-surface border border-default rounded-pf p-3">
                  <span className="text-caption text-secondary uppercase tracking-wider block mb-1">Long-term Gains</span>
                  <span className={`text-lg font-mono font-semibold ${taxSummary.longTermGain >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {taxSummary.longTermGain >= 0 ? '+' : ''}{taxSummary.longTermGain.toFixed(2)} USDC
                  </span>
                </div>
                {/* Total Trades */}
                <div className="bg-surface border border-default rounded-pf p-3">
                  <span className="text-caption text-secondary uppercase tracking-wider block mb-1">Total Trades</span>
                  <span className="text-lg font-mono font-semibold text-primary">{taxSummary.tradeCount}</span>
                </div>
              </div>
            ) : !loadingTax && (
              <div className="flex flex-col items-center justify-center py-8 text-center mb-4">
                <FileText className="size-8 text-tertiary mb-2" />
                <p className="text-body-md font-medium text-primary">No tax data for {taxYear}</p>
                <p className="text-label text-tertiary mt-1">Closed trades will appear here once available.</p>
              </div>
            )}

            {/* Preview table */}
            {!loadingTax && taxData.length > 0 && (() => {
              const sorted = [...taxData].sort((a, b) => Math.abs(b.realizedGain) - Math.abs(a.realizedGain));
              const preview = sorted.slice(0, 10);
              const showToggle = taxData.length > 10;
              return (
                <div className="mb-3">
                  <div className="overflow-x-auto rounded-pf border border-subtle">
                    <table className="w-full text-label" aria-label="Capital gains and losses">
                      <caption className="sr-only">Capital gains and losses</caption>
                      <thead>
                        <tr className="border-b border-subtle bg-overlay">
                          <th className="px-3 py-2 text-left text-secondary font-medium">Close Date</th>
                          <th className="px-3 py-2 text-left text-secondary font-medium">Market</th>
                          <th className="px-3 py-2 text-right text-secondary font-medium">Gain/Loss</th>
                          <th className="px-3 py-2 text-center text-secondary font-medium">Term</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(taxExpanded ? sorted : preview).map(entry => (
                          <tr key={entry.id} className="border-b border-subtle last:border-0 hover:bg-overlay/50 transition-colors">
                            <td className="px-3 py-2 font-mono text-secondary whitespace-nowrap">{entry.closeDate}</td>
                            <td className="px-3 py-2 text-primary max-w-col-md truncate" title={entry.marketQuestion}>{entry.marketQuestion}</td>
                            <td className={`px-3 py-2 text-right font-mono font-medium whitespace-nowrap ${entry.realizedGain >= 0 ? 'text-gain' : 'text-loss'}`}>
                              {entry.realizedGain >= 0 ? '+' : ''}{entry.realizedGain.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center px-2 py-1 rounded-sm text-caption font-medium border ${entry.type === 'SHORT_TERM' ? 'bg-gold-500/10 text-gold-500 border-gold-500/25' : 'bg-gain/10 text-gain border-gain/25'}`}>
                                {entry.type === 'SHORT_TERM' ? 'Short' : 'Long'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {showToggle && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTaxExpanded(prev => !prev)}
                      className="flex items-center gap-2 mt-2"
                    >
                      {taxExpanded ? (
                        <><ChevronUp className="size-4" /> Show fewer</>
                      ) : (
                        <><ChevronDown className="size-4" /> Show all {taxData.length} transactions</>
                      )}
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Disclaimer */}
            <p className="text-caption text-tertiary mt-1">
              This report is for informational purposes only. Consult a tax professional for advice.
            </p>
          </div>

          {/* ─── Goal Tracker ─── */}
          {(() => {
            const currentTotalPnl = parseFloat(pnl?.totalPnl ?? '0');

            function openNewGoalForm() {
              setEditingGoalId(null);
              setNewGoalLabel('');
              setNewGoalTarget('');
              setNewGoalDeadline('');
              setShowGoalForm(true);
            }

            function openEditGoalForm(goal: PortfolioGoal) {
              setEditingGoalId(goal.id);
              setNewGoalLabel(goal.label);
              setNewGoalTarget(String(goal.targetAmount));
              setNewGoalDeadline(goal.endDate);
              setShowGoalForm(true);
            }

            function saveGoal() {
              const target = parseFloat(newGoalTarget);
              if (!newGoalLabel.trim() || Number.isNaN(target) || target <= 0 || !newGoalDeadline) return;
              if (editingGoalId) {
                setGoals(prev => prev.map(g =>
                  g.id === editingGoalId
                    ? { ...g, label: newGoalLabel.trim(), targetAmount: target, endDate: newGoalDeadline }
                    : g,
                ));
                toast.success('Goal updated!');
              } else {
                const newGoal: PortfolioGoal = {
                  id: crypto.randomUUID(),
                  label: newGoalLabel.trim(),
                  targetAmount: target,
                  startDate: new Date().toISOString(),
                  endDate: newGoalDeadline,
                  startPnl: currentTotalPnl,
                };
                setGoals(prev => [...prev, newGoal]);
                setActiveGoalIdx(goals.length);
                toast.success('Goal saved!');
              }
              setShowGoalForm(false);
              setEditingGoalId(null);
            }

            function deleteGoal(id: string) {
              setGoals(prev => prev.filter(g => g.id !== id));
              setActiveGoalIdx(prev => Math.max(0, prev - 1));
              toast.success('Goal deleted');
            }

            const activeGoal = goals[activeGoalIdx] ?? goals[0] ?? null;

            return (
              <div className="bg-elevated border border-default rounded-pf p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-accent-text" />
                    <span className="text-body-md font-semibold text-primary">Goal Tracker</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {goals.length < 3 && !showGoalForm && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={openNewGoalForm}
                        className="flex items-center gap-2"
                      >
                        <Target className="size-3" />
                        {goals.length === 0 ? 'Set Goal' : 'Add Another Goal'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tabs (multiple goals) */}
                {goals.length > 1 && !showGoalForm && (
                  <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                    {goals.map((g, i) => (
                      <Button
                        key={g.id}
                        type="button"
                        variant={i === activeGoalIdx ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveGoalIdx(i)}
                        className="whitespace-nowrap"
                      >
                        {g.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Inline form */}
                {showGoalForm && (
                  <div className="bg-surface border border-default rounded-pf p-4 mb-4 space-y-3">
                    <div>
                      <label className="text-label text-secondary block mb-1">Goal name</label>
                      <Input
                        type="text"
                        placeholder="e.g. October target"
                        value={newGoalLabel}
                        onChange={e => setNewGoalLabel(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-label text-secondary block mb-1">Target amount (USDC profit)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-tertiary">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={newGoalTarget}
                          onChange={e => setNewGoalTarget(e.target.value)}
                          className="w-full pl-7"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-label text-secondary block mb-1">Deadline</label>
                      <Input
                        type="date"
                        value={newGoalDeadline}
                        onChange={e => setNewGoalDeadline(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={saveGoal}
                        disabled={!newGoalLabel.trim() || !newGoalTarget || !newGoalDeadline}
                      >
                        Save Goal
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowGoalForm(false); setEditingGoalId(null); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Goal display */}
                {!showGoalForm && activeGoal && (() => {
                  const earned = currentTotalPnl - activeGoal.startPnl;
                  const progress = Math.min(100, Math.max(0, (earned / activeGoal.targetAmount) * 100));

                  const now = new Date();
                  const start = new Date(activeGoal.startDate);
                  const end = new Date(activeGoal.endDate + 'T23:59:59');
                  const totalMs = end.getTime() - start.getTime();
                  const elapsedMs = now.getTime() - start.getTime();
                  const totalDays = Math.max(1, totalMs / 86400000);
                  const daysElapsed = Math.max(0, elapsedMs / 86400000);
                  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
                  const isExpired = now > end;
                  const isAchieved = progress >= 100;

                  // Color logic: on track if daysElapsed/totalDays >= (progress/100) * 0.9
                  const paceFraction = totalDays > 0 ? daysElapsed / totalDays : 1;
                  const onTrack = paceFraction >= (progress / 100) * 0.9;
                  const barColor = earned < 0
                    ? 'bg-loss'
                    : onTrack
                      ? 'bg-gain'
                      : 'bg-warning';

                  const endLabel = (() => {
                    const d = new Date(activeGoal.endDate + 'T00:00:00');
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  })();

                  const dailyRunRate = daysRemaining > 0
                    ? (activeGoal.targetAmount - earned) / daysRemaining
                    : null;

                  return (
                    <div>
                      {/* Goal header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-body-md font-medium text-primary">{activeGoal.label}</p>
                          <p className="text-label text-tertiary flex items-center gap-1 mt-1">
                            <CalendarDays className="size-3" />
                            Ends {endLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit goal"
                            onClick={() => openEditGoalForm(activeGoal)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete goal"
                            onClick={() => deleteGoal(activeGoal.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Achievement banner */}
                      {isAchieved && (
                        <div className="flex items-center gap-2 bg-gain/10 border border-gain/30 rounded-pf p-3 mb-3">
                          <Trophy className="size-4 text-gain shrink-0" />
                          <span className="text-body-md font-semibold text-gain">Goal achieved!</span>
                        </div>
                      )}

                      {/* Earned / target */}
                      <div className="mb-2">
                        <span className={`text-2xl font-mono font-semibold ${earned >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {earned >= 0 ? '+' : ''}{earned.toFixed(2)}
                        </span>
                        <span className="text-body-sm text-tertiary font-mono ml-1">
                          earned of ${activeGoal.targetAmount.toFixed(2)} target
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-surface overflow-hidden mb-3">
                        <div
                          className={`h-2 rounded-full transition-all duration-slow ${barColor}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Footer stats */}
                      <div className="flex items-center justify-between text-label flex-wrap gap-y-1">
                        {isExpired ? (
                          <span className="text-loss font-medium">Goal expired</span>
                        ) : (
                          <span className="text-tertiary">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
                        )}
                        {!isAchieved && dailyRunRate !== null && !isExpired && (
                          <span className={`font-mono ${dailyRunRate > 0 ? 'text-secondary' : 'text-gain'}`}>
                            {dailyRunRate > 0
                              ? `Need $${dailyRunRate.toFixed(2)}/day to hit target`
                              : 'On track — no daily minimum needed'}
                          </span>
                        )}
                        <span className={`font-mono font-semibold ${onTrack ? 'text-gain' : 'text-warning'}`}>
                          {progress.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Empty state */}
                {!showGoalForm && goals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Target className="size-8 text-tertiary mb-2" />
                    <p className="text-body-md font-medium text-primary">No goals set</p>
                    <p className="text-label text-tertiary mt-1">Set a profit target to track your progress.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── Share Performance ─── */}
          <div className="bg-elevated border border-default rounded-pf p-4">
            <div className="flex items-center gap-2 mb-4">
              <Share2 className="size-4 text-accent-text" />
              <span className="text-body-md font-semibold text-primary">Share Performance</span>
            </div>

            {/* Preview card */}
            <div
              id="share-card"
              className="bg-gradient-to-br from-surface to-elevated border border-accent/30 rounded-pf p-5 mb-4"
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
                      className="text-accent-text"
                    />
                    <path
                      d="M12 6L18 9.5V16.5L12 20L6 16.5V9.5L12 6Z"
                      fill="currentColor"
                      className="text-accent/20"
                    />
                  </svg>
                  <span className="text-body-md font-semibold text-primary tracking-wide">PolyForge</span>
                </div>
                {username && (
                  <span className="text-label font-mono text-tertiary">@{username}</span>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="text-center">
                  <p className="text-caption text-tertiary uppercase tracking-wider mb-1">Total P&L</p>
                  <p className={`text-lg font-mono font-semibold ${pnlColor(pnl?.totalPnl ?? '0')}`}>
                    {formatPnl(pnl?.totalPnl ?? '0')}
                  </p>
                </div>
                <div className="text-center border-x border-subtle">
                  <p className="text-caption text-tertiary uppercase tracking-wider mb-1">Win Rate</p>
                  <p className="text-lg font-mono font-semibold text-accent-text">
                    {winRatePct(pnl?.winRate ?? '0')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-caption text-tertiary uppercase tracking-wider mb-1">Edge Score</p>
                  <p className="text-lg font-mono font-semibold text-primary">
                    {edgeScore != null ? edgeScore : '—'}
                  </p>
                </div>
              </div>

              {/* Tagline + footer */}
              <div className="border-t border-subtle pt-3 flex items-end justify-between">
                <p className="text-label text-secondary italic">"Trading smarter on Polymarket"</p>
                <p className="text-caption font-mono text-tertiary">polyforge.io</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyLink}
                className="flex items-center gap-2"
              >
                {linkCopied ? (
                  <Check className="size-4 text-gain" />
                ) : (
                  <Copy className="size-4" />
                )}
                {linkCopied ? 'Copied!' : 'Copy Share Link'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleShareOnX}
                className="flex items-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share on X
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDownloadCard}
                className="flex items-center gap-2"
              >
                <Download className="size-4" />
                Download Card
              </Button>
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
              ? 'bg-loss'
              : progress >= 50
                ? 'bg-warning'
                : 'bg-gain';
            const limitHit = progress >= 100;
            const remaining = limit != null ? limit - Math.abs(Math.min(0, totalPnl)) : 0;
            return (
              <div className="bg-elevated border border-default rounded-pf p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="size-4 text-tertiary" />
                  <span className="text-body-md font-medium text-primary">Today's P&L</span>
                </div>

                {loadingDailyPnl ? (
                  <div className="space-y-2">
                    <div className="h-8 bg-overlay rounded-sm animate-pulse w-32" />
                    <div className="h-3 bg-overlay rounded-sm animate-pulse w-full" />
                    <div className="h-3 bg-overlay rounded-sm animate-pulse w-2/3" />
                  </div>
                ) : (
                  <>
                    {/* Large P&L number */}
                    <p className={`text-3xl font-mono font-semibold mb-3 ${totalPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDC
                    </p>

                    {/* Limit hit banner */}
                    {limitHit && (
                      <div className="flex items-center gap-2 p-3 rounded-pf bg-loss/10 border border-loss/30 mb-3">
                        <AlertTriangle className="size-4 text-loss shrink-0" />
                        <p className="text-label font-medium text-loss">Daily loss limit reached — trading paused</p>
                      </div>
                    )}

                    {/* Progress bar (only if limit is configured and enabled) */}
                    {limit != null && (
                      <div className="space-y-2">
                        <div className="bg-surface rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColor}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-caption text-tertiary">
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
                      <p className="text-label text-tertiary">
                        No daily loss limit set.{' '}
                        <a href="/settings?tab=risk" className="underline text-accent-text hover:text-accent-text">
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
          <div data-testid="pnl-chart" className="bg-elevated border border-default rounded-pf">
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
              <span className="text-body-md font-medium text-primary">P&L Over Time</span>
              <div className="flex gap-1">
                {PERIODS.map(p => (
                  <Button
                    type="button"
                    key={p.value}
                    variant={period === p.value ? 'default' : 'ghost'}
                    size="sm"
                    aria-selected={period === p.value}
                    onClick={() => setPeriod(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            {loadingChart ? (
              <div className="h-64 animate-pulse bg-overlay m-4 rounded-sm" />
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
                      dataKey="time" tick={chartAxisTick}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={chartAxisTick}
                      axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={chartTooltipContentStyle}
                      labelStyle={chartTooltipLabelStyle}
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
                <BarChart3 className="size-10 text-tertiary mb-3" />
                <p className="text-body-md font-medium text-primary">No P&L data yet</p>
                <p className="text-label text-tertiary mt-1">P&L data will appear once your strategies generate trades.</p>
              </div>
            )}
          </div>

          {/* Positions table */}
          <div data-testid="positions-table" className="bg-elevated border border-default rounded-pf">
            <div className="px-4 py-3 border-b border-subtle">
              <span className="text-body-md font-medium text-primary">Open Positions</span>
            </div>
            {loadingPortfolio ? (
              <TableSkeleton />
            ) : (portfolio?.positions ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wallet className="size-10 text-tertiary mb-3" />
                <p className="text-body-md font-medium text-primary">No open positions</p>
                <p className="text-label text-tertiary mt-1">Start a strategy to build positions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm" aria-label="Open positions">
                  <caption className="sr-only">Open positions</caption>
                  <thead>
                    <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
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
                  <tbody className="divide-y divide-subtle">
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
                      const rule = autoCloseRules[pos.id];
                      const hasRule = rule != null && rule.status === 'active';
                      const isTriggered = rule?.status === 'triggered';
                      const isAutoCloseExpanded = expandedAutoClose === pos.id;
                      return (
                        <>
                          <tr
                            key={pos.id}
                            className="hover:bg-surface/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : pos.id)}
                          >
                            <td className="px-4 py-3 max-w-col-md">
                              <div className="flex items-center gap-2">
                                {isExpanded
                                  ? <ChevronUp className="size-3 text-tertiary shrink-0" />
                                  : <ChevronDown className="size-3 text-tertiary shrink-0" />}
                                <span className="text-primary line-clamp-1" title={pos.marketTitle}>{pos.marketTitle}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <CategoryBadge category={(pos as any).marketCategory} />
                                {hasRule && rule.stopLoss != null && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-sm text-caption font-mono font-medium bg-loss/10 text-loss border border-loss/20">
                                    SL: {rule.stopLoss.toFixed(2)}
                                  </span>
                                )}
                                {hasRule && rule.takeProfit != null && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-sm text-caption font-mono font-medium bg-gain/10 text-gain border border-gain/20">
                                    TP: {rule.takeProfit.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                                pos.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                              }`}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-primary">
                              {parseFloat(pos.size).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-primary">
                              {parseFloat(pos.avgEntryPrice).toFixed(3)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {(() => {
                                const livePrice = livePositionPrices[pos.id];
                                const staticPrice = pos.currentPrice && parseFloat(pos.currentPrice) > 0
                                  ? parseFloat(pos.currentPrice)
                                  : null;
                                const displayPrice = livePrice ?? staticPrice;
                                const flash = flashingPrices[pos.id];

                                if (displayPrice == null) {
                                  return <span className="text-tertiary">&mdash;</span>;
                                }

                                if (livePrice != null && flash != null) {
                                  const isUp = flash === 'up';
                                  return (
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-label font-mono font-medium ${
                                      isUp
                                        ? 'text-gain animate-value-flash-gain'
                                        : 'text-loss animate-value-flash-loss'
                                    }`}>
                                      {isUp
                                        ? <TrendingUp className="size-3" />
                                        : <TrendingDown className="size-3" />}
                                      ${displayPrice.toFixed(3)}
                                    </span>
                                  );
                                }

                                if (livePrice != null) {
                                  const prevStatic = staticPrice ?? livePrice;
                                  const isUp = livePrice >= prevStatic;
                                  return (
                                    <span className={`inline-flex items-center gap-1 text-label font-mono font-medium ${
                                      isUp ? 'text-gain' : 'text-loss'
                                    }`}>
                                      {isUp
                                        ? <TrendingUp className="size-3" />
                                        : <TrendingDown className="size-3" />}
                                      ${displayPrice.toFixed(3)}
                                    </span>
                                  );
                                }

                                return <span className="text-accent-text">${displayPrice.toFixed(3)}</span>;
                              })()}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono ${pnlColor(pos.unrealizedPnl)}`}>
                              {formatPnl(pos.unrealizedPnl)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                                  pos.resolutionStatus === 'UNRESOLVED'
                                    ? 'bg-accent/10 text-accent-text'
                                    : 'bg-overlay text-tertiary'
                                }`}
                                {...(pos.resolutionStatus === 'UNRESOLVED' ? { title: 'Market has not yet resolved — position is still active' } : {})}
                              >
                                {pos.resolutionStatus === 'UNRESOLVED' ? 'OPEN' : pos.resolutionStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {pos.resolutionStatus === 'UNRESOLVED' && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    title={isTriggered ? 'Rule triggered' : hasRule ? 'Edit auto-close rule' : 'Set auto-close'}
                                    aria-label={isTriggered ? 'Rule triggered' : hasRule ? 'Edit auto-close rule' : 'Set auto-close'}
                                    onClick={e => { e.stopPropagation(); openAutoClosePanel(pos.id); }}
                                  >
                                    <SlidersHorizontal className={`size-4 ${isTriggered ? 'text-gain' : hasRule ? 'text-accent-text' : ''}`} />
                                  </Button>
                                )}
                                {pos.resolutionStatus === 'UNRESOLVED' && (
                                  <Button
                                    type="button"
                                    variant="danger"
                                    size="sm"
                                    onClick={e => { e.stopPropagation(); closePosition(pos); }}
                                    disabled={isClosing}
                                    className="flex items-center gap-1"
                                  >
                                    {isClosing
                                      ? <Loader2 className="size-3 animate-spin" />
                                      : <X className="size-3" />}
                                    Close
                                  </Button>
                                )}
                                {pos.resolutionStatus === 'RESOLVED' && (
                                  <Button
                                    type="button"
                                    variant="success"
                                    size="sm"
                                    onClick={e => { e.stopPropagation(); redeemPosition(pos); }}
                                    disabled={redeemingPosition[pos.id]}
                                  >
                                    {redeemingPosition[pos.id] ? <Loader2 className="size-3 animate-spin" /> : 'Redeem'}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isAutoCloseExpanded && (
                            <tr key={`${pos.id}-autoclose`}>
                              <td colSpan={8}>
                                <div className="px-4 py-4 bg-surface border-t border-subtle animate-fade-in">
                                  {/* Panel header */}
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <SlidersHorizontal className="size-4 text-accent-text" />
                                      <span className="text-body-md font-semibold text-primary">
                                        Auto-Close Rules
                                      </span>
                                      <span className="text-label text-tertiary truncate max-w-col-md" title={pos.marketTitle}>
                                        — {pos.marketTitle}
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Close auto-close panel"
                                      onClick={e => { e.stopPropagation(); setExpandedAutoClose(null); }}
                                    >
                                      <X className="size-4" />
                                    </Button>
                                  </div>

                                  {acLoading[pos.id] ? (
                                    <div className="flex items-center gap-2 py-4">
                                      <Loader2 className="size-4 animate-spin text-tertiary" />
                                      <span className="text-body-sm text-tertiary">Loading rule…</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      {/* Stop Loss */}
                                      <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={acSlEnabled[pos.id] ?? false}
                                            onChange={e => {
                                              e.stopPropagation();
                                              setAcSlEnabled(prev => ({ ...prev, [pos.id]: e.target.checked }));
                                            }}
                                            onClick={e => e.stopPropagation()}
                                            className="rounded-xs border-default accent-accent-text"
                                          />
                                          <span className="text-body-md font-medium text-primary">Stop Loss</span>
                                        </label>
                                        {(acSlEnabled[pos.id] ?? false) && (
                                          <div className="ml-6 space-y-1">
                                            <p className="text-label text-secondary">Sell if YES price drops below:</p>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                type="number"
                                                min="0.01"
                                                max="0.99"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={acSlPrice[pos.id] ?? ''}
                                                onChange={e => { e.stopPropagation(); setAcSlPrice(prev => ({ ...prev, [pos.id]: e.target.value })); }}
                                                onClick={e => e.stopPropagation()}
                                                className="w-28 font-mono"
                                              />
                                              <span className="text-label text-tertiary">(0.01 – 0.99)</span>
                                            </div>
                                            {currentPrice > 0 && (
                                              <p className="text-label text-tertiary">Current price: <span className="font-mono text-accent-text">{currentPrice.toFixed(3)}</span></p>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Take Profit */}
                                      <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={acTpEnabled[pos.id] ?? false}
                                            onChange={e => {
                                              e.stopPropagation();
                                              setAcTpEnabled(prev => ({ ...prev, [pos.id]: e.target.checked }));
                                            }}
                                            onClick={e => e.stopPropagation()}
                                            className="rounded-xs border-default accent-accent-text"
                                          />
                                          <span className="text-body-md font-medium text-primary">Take Profit</span>
                                        </label>
                                        {(acTpEnabled[pos.id] ?? false) && (
                                          <div className="ml-6 space-y-1">
                                            <p className="text-label text-secondary">Sell if YES price rises above:</p>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                type="number"
                                                min="0.01"
                                                max="0.99"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={acTpPrice[pos.id] ?? ''}
                                                onChange={e => { e.stopPropagation(); setAcTpPrice(prev => ({ ...prev, [pos.id]: e.target.value })); }}
                                                onClick={e => e.stopPropagation()}
                                                className="w-28 font-mono"
                                              />
                                              <span className="text-label text-tertiary">(0.01 – 0.99)</span>
                                            </div>
                                            {currentPrice > 0 && (
                                              <p className="text-label text-tertiary">Current price: <span className="font-mono text-accent-text">{currentPrice.toFixed(3)}</span></p>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Quantity */}
                                      <div className="space-y-2">
                                        <p className="text-body-md font-medium text-primary">Quantity</p>
                                        <div className="flex items-center gap-3 ml-0">
                                          <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                              type="radio"
                                              name={`ac-qty-${pos.id}`}
                                              checked={acQuantityAll[pos.id] ?? true}
                                              onChange={e => { e.stopPropagation(); setAcQuantityAll(prev => ({ ...prev, [pos.id]: true })); }}
                                              onClick={e => e.stopPropagation()}
                                              className="accent-accent-text"
                                            />
                                            <span className="text-body-md text-primary">All shares</span>
                                          </label>
                                          <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                              type="radio"
                                              name={`ac-qty-${pos.id}`}
                                              checked={!(acQuantityAll[pos.id] ?? true)}
                                              onChange={e => { e.stopPropagation(); setAcQuantityAll(prev => ({ ...prev, [pos.id]: false })); }}
                                              onClick={e => e.stopPropagation()}
                                              className="accent-accent-text"
                                            />
                                            <span className="text-body-md text-primary">Partial</span>
                                          </label>
                                          {!(acQuantityAll[pos.id] ?? true) && (
                                            <Input
                                              type="number"
                                              min="0.01"
                                              step="0.01"
                                              placeholder="Amount"
                                              value={acQuantity[pos.id] ?? ''}
                                              onChange={e => { e.stopPropagation(); setAcQuantity(prev => ({ ...prev, [pos.id]: e.target.value })); }}
                                              onClick={e => e.stopPropagation()}
                                              className="w-28 font-mono"
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {/* Error */}
                                      {acErrors[pos.id] && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-pf bg-loss/10 border border-loss/25">
                                          <AlertTriangle className="size-4 text-loss shrink-0" />
                                          <p className="text-label text-loss">{acErrors[pos.id]}</p>
                                        </div>
                                      )}

                                      {/* Actions */}
                                      <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                                        <Button
                                          type="button"
                                          variant="default"
                                          size="sm"
                                          disabled={acSubmitting[pos.id]}
                                          onClick={e => { e.stopPropagation(); saveAutoCloseRule(pos); }}
                                          className="flex items-center gap-2"
                                        >
                                          {acSubmitting[pos.id] && <Loader2 className="size-3 animate-spin" />}
                                          Save Rules
                                        </Button>
                                        {(autoCloseRules[pos.id] != null) && (
                                          <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            disabled={acSubmitting[pos.id]}
                                            onClick={e => { e.stopPropagation(); deleteAutoCloseRule(pos.id); }}
                                          >
                                            Remove Rules
                                          </Button>
                                        )}
                                      </div>

                                      {/* Disclaimer */}
                                      <div className="flex items-start gap-2 pt-1">
                                        <AlertTriangle className="size-4 text-tertiary shrink-0 mt-1" />
                                        <p className="text-label text-tertiary">Rules execute as market orders on Polymarket</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          {isExpanded && (
                            <tr key={`${pos.id}-detail`}>
                              <td colSpan={8}>
                                <div className="px-4 py-3 bg-surface/50 border-t border-subtle animate-fade-in">
                                  <div className="flex flex-wrap items-start gap-6">
                                    {/* P&L prominent display */}
                                    <div className="flex flex-col">
                                      <span className="text-caption text-tertiary uppercase tracking-wider mb-1">Unrealized P&L</span>
                                      <span className={`text-2xl font-mono font-semibold ${pnlNum >= 0 ? 'text-gain' : 'text-loss'}`}>
                                        {formatPnl(pos.unrealizedPnl)}
                                      </span>
                                      <span className="text-caption text-tertiary mt-1 italic">Unrealized P&L updates are estimated</span>
                                    </div>

                                    {/* Detail stats */}
                                    <div className="flex flex-wrap gap-4 text-label">
                                      <div>
                                        <p className="text-tertiary mb-1">Entry Price</p>
                                        <p className="font-mono text-primary">{entryPrice.toFixed(3)}</p>
                                      </div>
                                      <div>
                                        <p className="text-tertiary mb-1">Current Price</p>
                                        <p className="font-mono text-accent-text">
                                          {currentPrice > 0 ? currentPrice.toFixed(3) : '—'}
                                        </p>
                                      </div>
                                      {timeHeld && (
                                        <div>
                                          <p className="text-tertiary mb-1 flex items-center gap-1">
                                            <Clock className="size-3" /> Time Held
                                          </p>
                                          <p className="font-mono text-primary">{timeHeld}</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-tertiary mb-1">Max Gain</p>
                                        <p className="font-mono text-gain">+${maxGain}</p>
                                      </div>
                                      <div>
                                        <p className="text-tertiary mb-1">Max Loss</p>
                                        <p className="font-mono text-loss">-${maxLoss}</p>
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
                <h2 className="text-base font-semibold text-primary mb-3">Resolved Positions</h2>
                <div className="rounded-pf border border-default overflow-hidden">
                  <table className="w-full text-body-sm" aria-label="Resolved positions">
                    <caption className="sr-only">Resolved positions</caption>
                    <thead>
                      <tr className="border-b border-default bg-surface-elevated">
                        <th className="text-left px-4 py-3 text-label font-medium text-tertiary">Market</th>
                        <th className="text-right px-4 py-3 text-label font-medium text-tertiary">Outcome</th>
                        <th className="text-right px-4 py-3 text-label font-medium text-tertiary">Realized P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolved.map((pos, i) => {
                        const pnl = parseFloat(pos.realizedPnl ?? pos.unrealizedPnl ?? '0');
                        const isWin = pnl > 0;
                        return (
                          <tr key={i} className="border-b border-subtle last:border-0">
                            <td className="px-4 py-3 text-primary text-label">{pos.market?.title ?? pos.marketTitle ?? pos.marketId}</td>
                            <td className="px-4 py-3 text-right text-label font-mono text-secondary">{pos.outcome ?? '-'}</td>
                            <td className={`px-4 py-3 text-right text-label font-mono font-semibold ${isWin ? 'text-gain' : 'text-loss'}`}>
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
            <div className="bg-elevated border border-default rounded-pf p-4">
              <p className="text-label text-secondary uppercase tracking-wider mb-3">P&L Breakdown</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-label text-tertiary mb-1">Realized P&L</p>
                  <span className={`text-xl font-mono font-semibold ${pnlColor(portfolio.totalRealizedPnl)}`}>
                    {formatPnl(portfolio.totalRealizedPnl)}
                  </span>
                </div>
                <div>
                  <p className="text-label text-tertiary mb-1">Unrealized P&L</p>
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
                <div className="bg-surface border border-default rounded-pf px-3 py-2 text-label font-mono shadow-pf">
                  <p className="text-primary font-medium">{name}</p>
                  <p className="text-secondary">${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pct}%)</p>
                </div>
              );
            };

            return (
              <div className="bg-elevated border border-default rounded-pf p-4">
                {/* Section header */}
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="size-4 text-tertiary" />
                  <span className="text-body-md font-medium text-primary">Position Allocation</span>
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
                          {/* dynamic-color: intentional — color is runtime chart palette value */}
                          <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="flex-1 text-body-md text-primary capitalize truncate">{entry.name}</span>
                          <span className="text-label font-mono text-secondary shrink-0">
                            ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-label font-mono text-tertiary w-12 text-right shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Largest Positions table */}
                <div className="mt-5">
                  <p className="text-label text-secondary uppercase tracking-wider mb-2">Largest Positions</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-label" aria-label="Largest positions">
                      <caption className="sr-only">Largest positions</caption>
                      <thead>
                        <tr className="text-left text-tertiary border-b border-subtle">
                          <th className="pb-2 font-medium pr-3">Market</th>
                          <th className="pb-2 font-medium pr-3">Category</th>
                          <th className="pb-2 font-medium pr-3">Side</th>
                          <th className="pb-2 font-medium pr-3">Outcome</th>
                          <th className="pb-2 font-medium text-right pr-3">Size (USDC)</th>
                          <th className="pb-2 font-medium text-right pr-3">Current Price</th>
                          <th className="pb-2 font-medium text-right">Unreal. P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {topPositions.map((pos) => {
                          const category = (pos as any).marketCategory ?? pos.market?.category ?? null;
                          const categoryNorm = category
                            ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
                            : null;
                          const dotColor = categoryNorm
                            ? CATEGORY_COLORS[categoryNorm] ?? CATEGORY_COLORS.Other
                            : CATEGORY_COLORS.Other;
                          return (
                            <tr key={pos.id} className="hover:bg-surface/40 transition-colors">
                              <td className="py-2 pr-3 max-w-col-sm">
                                <span className="truncate block text-primary" title={pos.marketTitle}>{pos.marketTitle}</span>
                              </td>
                              <td className="py-2 pr-3">
                                {categoryNorm ? (
                                  <span className="inline-flex items-center gap-1">
                                    {/* dynamic-color: intentional — color is runtime chart palette value */}
                                    <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} />
                                    <span className="text-secondary">{categoryNorm}</span>
                                  </span>
                                ) : (
                                  <span className="text-tertiary">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                <span className={`inline-flex px-2 py-1 rounded-sm font-medium ${
                                  pos.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                                }`}>
                                  {pos.side}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-secondary font-mono">{pos.outcome ?? '—'}</td>
                              <td className="py-2 pr-3 text-right font-mono text-primary">
                                {parseFloat(pos.size).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono text-accent-text">
                                {pos.currentPrice && parseFloat(pos.currentPrice) > 0
                                  ? `$${parseFloat(pos.currentPrice).toFixed(3)}`
                                  : <span className="text-tertiary">—</span>}
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
                  ? <span className={sharpe >= 1 ? 'text-gain' : sharpe >= 0 ? 'text-primary' : 'text-loss'}>{sharpe.toFixed(2)}</span>
                  : <span className="text-tertiary">—</span>,
              },
              {
                label: 'Max Drawdown',
                value: maxDrawdown != null
                  ? <span className="text-loss">-${Math.abs(maxDrawdown).toFixed(2)}</span>
                  : <span className="text-tertiary">—</span>,
              },
              {
                label: 'Longest Win Streak',
                value: winStreak != null
                  ? <span className="text-gain">{winStreak} trade{winStreak !== 1 ? 's' : ''}</span>
                  : <span className="text-tertiary">—</span>,
              },
              {
                label: 'Longest Loss Streak',
                value: lossStreak != null
                  ? <span className="text-loss">{lossStreak} trade{lossStreak !== 1 ? 's' : ''}</span>
                  : <span className="text-tertiary">—</span>,
              },
              {
                label: 'Avg Hold Time',
                value: avgHold != null
                  ? <span className="text-primary">{avgHold.toFixed(1)} days</span>
                  : <span className="text-tertiary">—</span>,
              },
              {
                label: 'Best Single Trade',
                value: bestTrade != null
                  ? <span className="text-gain">+${bestTrade.toFixed(2)}</span>
                  : <span className="text-tertiary">—</span>,
              },
            ];

            return (
              <div className="bg-elevated border border-default rounded-pf p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-4 text-tertiary" />
                  <span className="text-body-md font-medium text-primary">Advanced Statistics</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {statItems.map((item) => (
                    <div key={item.label} className="bg-surface rounded-pf p-3">
                      <p
                        className="text-label text-tertiary uppercase tracking-wider mb-1"
                        title={item.tooltip}
                      >
                        {item.label}
                        {item.tooltip && (
                          <span className="ml-1 text-tertiary cursor-help" title={item.tooltip}>ⓘ</span>
                        )}
                      </p>
                      <div className="text-lg font-mono font-semibold leading-tight">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ─── Daily Returns Heatmap ─── */}
          <div className="bg-elevated border border-default rounded-pf p-4">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="size-4 text-tertiary" />
              <span className="text-body-md font-medium text-primary">Daily Returns (12 months)</span>
            </div>
            {loadingHeatmap ? (
              <div className="h-32 bg-overlay rounded-sm animate-pulse" />
            ) : heatmapData.length === 0 ? (
              <p className="text-body-sm text-tertiary">No trading data yet</p>
            ) : (
              <HeatmapGrid data={heatmapData} />
            )}
          </div>

          {/* ─── Risk Concentration Heatmap ─── */}
          {(() => {
            const RISK_CATEGORIES = ['Politics', 'Sports', 'Crypto', 'Finance', 'Entertainment', 'Science'];
            const RISK_OUTCOMES: Array<'YES' | 'NO'> = ['YES', 'NO'];

            function riskCellBg(ratio: number): string {
              if (ratio === 0) return 'bg-overlay/20';
              if (ratio <= 0.25) return 'bg-accent/10';
              if (ratio <= 0.50) return 'bg-accent/25';
              if (ratio <= 0.75) return 'bg-accent/45';
              return 'bg-accent/70';
            }

            function formatCellValue(v: number): string {
              if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
              return `$${v.toFixed(2)}`;
            }

            if (loadingRiskHeatmap) {
              return (
                <div className="bg-elevated border border-default rounded-pf p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="size-4 text-accent-text" />
                    <span className="text-body-md font-semibold text-primary">Risk Concentration</span>
                  </div>
                  {/* 2×6 skeleton grid */}
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'auto repeat(6, 1fr)' }}>
                    {/* header row spacer */}
                    <div />
                    {RISK_CATEGORIES.map(c => (
                      <div key={c} className="h-4 bg-overlay rounded-sm animate-pulse" />
                    ))}
                    {RISK_OUTCOMES.map(o => (
                      <>
                        <div key={`lbl-${o}`} className="h-12 w-8 bg-overlay rounded-sm animate-pulse" />
                        {RISK_CATEGORIES.map(c => (
                          <div key={`${o}-${c}`} className="h-12 bg-overlay rounded-sm animate-pulse" />
                        ))}
                      </>
                    ))}
                  </div>
                </div>
              );
            }

            // Empty state — no positions
            if (!riskHeatmap || riskHeatmap.cells.length === 0) {
              return (
                <div className="bg-elevated border border-default rounded-pf p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="size-4 text-accent-text" />
                    <span className="text-body-md font-semibold text-primary">Risk Concentration</span>
                  </div>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <ShieldCheck className="size-8 text-tertiary mb-2" />
                    <p className="text-body-md font-medium text-primary">No open positions — nothing to analyse</p>
                    <p className="text-label text-tertiary mt-1">Open some positions to see your risk concentration.</p>
                  </div>
                </div>
              );
            }

            const { cells, totalValue, maxCellValue } = riskHeatmap;

            // Build lookup: category+outcome → cell
            const cellMap = new Map<string, RiskCell>();
            cells.forEach(c => {
              cellMap.set(`${c.category.toLowerCase()}|${c.outcome}`, c);
            });

            // Column totals per category
            const colTotals = RISK_CATEGORIES.map(cat => {
              return RISK_OUTCOMES.reduce((sum, outcome) => {
                const key = `${cat.toLowerCase()}|${outcome}`;
                return sum + (cellMap.get(key)?.totalValue ?? 0);
              }, 0);
            });
            const maxColTotal = Math.max(...colTotals, 1);

            // High-concentration warning: any single cell > 30% of total
            const highConcentrationCells = cells.filter(c => totalValue > 0 && c.totalValue / totalValue > 0.3);

            return (
              <div className="bg-elevated border border-default rounded-pf p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-accent-text" />
                    <div>
                      <span className="text-body-md font-semibold text-primary">Risk Concentration</span>
                      <p className="text-label text-tertiary mt-1">Exposure by category and outcome</p>
                    </div>
                  </div>
                </div>

                {/* High-concentration warnings */}
                {highConcentrationCells.map(c => {
                  const pct = ((c.totalValue / totalValue) * 100).toFixed(1);
                  return (
                    <div
                      key={`warn-${c.category}-${c.outcome}`}
                      className="flex items-center gap-2 mt-3 px-3 py-2 rounded-pf bg-warning/10 border border-warning/30"
                    >
                      <AlertTriangle className="size-4 text-warning shrink-0" />
                      <p className="text-label text-gold-300">
                        High concentration in{' '}
                        <span className="font-semibold capitalize">{c.category}</span>{' '}
                        <span className="font-semibold">{c.outcome}</span>{' '}
                        (<span className="font-mono">{pct}%</span> of portfolio)
                      </p>
                    </div>
                  );
                })}

                {/* Grid */}
                <div className="mt-4 overflow-x-auto">
                  <div
                    className="grid gap-2 min-w-max"
                    style={{ gridTemplateColumns: `60px repeat(${RISK_CATEGORIES.length}, minmax(88px, 1fr))` }}
                  >
                    {/* Column headers */}
                    <div />
                    {RISK_CATEGORIES.map(cat => (
                      <div key={cat} className="text-center text-label font-medium text-secondary pb-1 capitalize">
                        {cat}
                      </div>
                    ))}

                    {/* Data rows */}
                    {RISK_OUTCOMES.map(outcome => (
                      <>
                        {/* Row label */}
                        <div
                          key={`row-lbl-${outcome}`}
                          className="flex items-center justify-center"
                        >
                          <span className={`text-label font-semibold px-2 py-1 rounded-sm ${
                            outcome === 'YES'
                              ? 'text-gain bg-gain/10'
                              : 'text-loss bg-loss/10'
                          }`}>
                            {outcome}
                          </span>
                        </div>

                        {/* Cells */}
                        {RISK_CATEGORIES.map(cat => {
                          const key = `${cat.toLowerCase()}|${outcome}`;
                          const cell = cellMap.get(key);
                          const ratio = cell && maxCellValue > 0 ? cell.totalValue / maxCellValue : 0;
                          const bgClass = riskCellBg(ratio);

                          if (!cell) {
                            return (
                              <div
                                key={`${outcome}-${cat}`}
                                className={`${bgClass} rounded-pf border border-subtle flex items-center justify-center h-14`}
                              >
                                <span className="text-tertiary text-body-sm">—</span>
                              </div>
                            );
                          }

                          const tooltipText = [
                            `${cat} / ${outcome}`,
                            `Value: ${formatCellValue(cell.totalValue)}`,
                            `Positions: ${cell.positionCount}`,
                            `P&L: ${cell.pnl >= 0 ? '+' : ''}$${cell.pnl.toFixed(2)}`,
                          ].join('\n');

                          return (
                            <div
                              key={`${outcome}-${cat}`}
                              title={tooltipText}
                              className={`${bgClass} rounded-pf border border-subtle h-14 relative p-2 cursor-default transition-opacity hover:opacity-80`}
                            >
                              {/* Dollar value */}
                              <p className="text-primary font-mono text-label leading-tight">{formatCellValue(cell.totalValue)}</p>
                              {/* Position count */}
                              <p className="text-tertiary text-caption leading-tight mt-1">{cell.positionCount} pos</p>
                              {/* P&L badge bottom-right */}
                              <span
                                className={`absolute bottom-1 right-2 text-caption font-mono font-semibold ${
                                  cell.pnl > 0 ? 'text-gain' : cell.pnl < 0 ? 'text-loss' : 'text-tertiary'
                                }`}
                              >
                                {cell.pnl >= 0 ? '+' : ''}{cell.pnl.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>

                {/* Summary row — column totals */}
                <div className="mt-3 overflow-x-auto">
                  <div
                    className="grid gap-2 min-w-max"
                    style={{ gridTemplateColumns: `60px repeat(${RISK_CATEGORIES.length}, minmax(88px, 1fr))` }}
                  >
                    <div className="text-caption text-tertiary flex items-center justify-center">Total</div>
                    {RISK_CATEGORIES.map((cat, i) => {
                      const colTotal = colTotals[i];
                      const pct = totalValue > 0 ? (colTotal / totalValue) * 100 : 0;
                      return (
                        <div key={cat} className="flex flex-col gap-1">
                          <div className="h-2 rounded-full bg-surface overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent/50 transition-all"
                              style={{ width: `${(colTotal / maxColTotal) * 100}%` }}
                            />
                          </div>
                          <p className="text-caption text-tertiary font-mono text-center">
                            {colTotal > 0 ? `${pct.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="text-caption text-tertiary">Low</span>
                  <div className="w-5 h-3 rounded-sm bg-overlay/20 border border-subtle" />
                  <div className="w-5 h-3 rounded-sm bg-accent/10 border border-subtle" />
                  <div className="w-5 h-3 rounded-sm bg-accent/25 border border-subtle" />
                  <div className="w-5 h-3 rounded-sm bg-accent/45 border border-subtle" />
                  <div className="w-5 h-3 rounded-sm bg-accent/70 border border-subtle" />
                  <span className="text-caption text-tertiary">High</span>
                </div>
              </div>
            );
          })()}

          {/* ─── Rebalancing Suggestions ─── */}
          {(() => {
            const visibleSuggestions = suggestions.filter(s => !dismissedIds.includes(s.id));

            function SuggestionTypeIcon({ type }: { type: RebalanceSuggestion['type'] }) {
              if (type === 'reduce') return <TrendingDown className="size-4 shrink-0" />;
              if (type === 'diversify') return <Shuffle className="size-4 shrink-0" />;
              if (type === 'close') return <X className="size-4 shrink-0" />;
              return <Shield className="size-4 shrink-0" />;
            }

            function PriorityBadge({ priority }: { priority: RebalanceSuggestion['priority'] }) {
              const cls =
                priority === 'high' ? 'bg-loss/10 text-loss' :
                priority === 'medium' ? 'bg-warning/10 text-warning' :
                'bg-gain/10 text-gain';
              const label = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
              return (
                <span className={`inline-flex items-center px-2 py-1 rounded-sm text-caption font-semibold uppercase tracking-wide ${cls}`}>
                  {label}
                </span>
              );
            }

            function CurrentTargetBar({ currentPct, targetPct }: { currentPct: number; targetPct: number }) {
              const barColor =
                currentPct > targetPct * 1.5 ? 'bg-loss' :
                currentPct > targetPct ? 'bg-warning' :
                'bg-gain';
              const clampedCurrent = Math.min(currentPct, 100);
              const targetPos = Math.min(targetPct, 100);
              return (
                <div className="relative h-2 rounded-full bg-surface overflow-visible mt-1">
                  {/* filled bar */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all`}
                    style={{ width: `${clampedCurrent}%` }}
                  />
                  {/* target marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-primary rounded-full"
                    style={{ left: `${targetPos}%` }}
                    title={`Target: ${targetPct}%`}
                  />
                </div>
              );
            }

            if (loadingSuggestions) {
              return (
                <div className="bg-elevated border border-default rounded-pf p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="size-4 text-warning" />
                    <span className="text-body-md font-semibold text-primary">Rebalancing Suggestions</span>
                  </div>
                  <div className="space-y-3">
                    {[0, 1].map(i => (
                      <div key={i} className="h-20 bg-overlay rounded-pf animate-pulse" />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-elevated border border-default rounded-pf p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="size-4 text-warning" />
                  <span className="text-body-md font-semibold text-primary">Rebalancing Suggestions</span>
                  {visibleSuggestions.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-warning-subtle text-warning text-caption font-semibold">
                      {visibleSuggestions.length}
                    </span>
                  )}
                </div>

                {visibleSuggestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="size-8 text-gain mb-2" />
                    <p className="text-body-md font-medium text-primary">Your portfolio looks well balanced</p>
                    <p className="text-label text-tertiary mt-1">No rebalancing actions are needed right now.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleSuggestions.map(s => (
                      <div
                        key={s.id}
                        className="rounded-pf border border-default bg-surface p-3"
                      >
                        {/* Card header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <PriorityBadge priority={s.priority} />
                            <span className={`
                              ${s.priority === 'high' ? 'text-loss' :
                                s.priority === 'medium' ? 'text-warning' :
                                'text-secondary'}
                            `}>
                              <SuggestionTypeIcon type={s.type} />
                            </span>
                            <p className="text-body-md font-medium text-primary truncate">{s.title}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Dismiss suggestion"
                            onClick={() => dismissSuggestion(s.id)}
                            className="shrink-0"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>

                        {/* Description */}
                        <p className="text-label text-tertiary mt-2 leading-relaxed">{s.description}</p>

                        {/* Current → Target bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-label text-secondary mb-1">
                            <span>Current: <span className="font-mono font-semibold text-primary">{s.currentPct}%</span></span>
                            <span className="text-tertiary">→</span>
                            <span>Target: <span className="font-mono font-semibold text-primary">{s.targetPct}%</span></span>
                          </div>
                          <CurrentTargetBar currentPct={s.currentPct} targetPct={s.targetPct} />
                        </div>

                        {/* Estimated impact */}
                        <p className="text-label text-tertiary mt-2">
                          <span className="text-secondary font-medium">Impact: </span>
                          {s.estimatedImpact}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Refresh link */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadSuggestions}
                  className="flex items-center gap-1 mt-4"
                >
                  <RefreshCw className="size-3" />
                  Refresh suggestions
                </Button>
              </div>
            );
          })()}

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
              <div className="bg-elevated border border-default rounded-pf p-4">
                <p className="text-label text-secondary uppercase tracking-wider mb-3">Category Exposure</p>
                <div className="space-y-3">
                  {entries.map(([category, { count, exposure }]) => {
                    const barPct = Math.round((exposure / totalExposure) * 100);
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-body-md text-primary capitalize">{category}</span>
                          <span className="text-label text-tertiary font-mono">
                            {exposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} shares &middot; {count} position{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-accent/60"
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
              <div className="bg-elevated border border-default rounded-pf">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-subtle">
                  <PieChart className="size-4 text-tertiary" />
                  <span className="text-body-md font-medium text-primary">Exposure by Market</span>
                </div>
                <div className="divide-y divide-subtle">
                  {sorted.map((m) => {
                    const maxAbs = Math.max(...sorted.map(x => Math.abs(x.pnl)), 1);
                    const barPct = Math.round((Math.abs(m.pnl) / maxAbs) * 100);
                    return (
                      <div key={m.title} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-body-md text-primary truncate" title={m.title}>{m.title}</p>
                          <div className="mt-1 h-2 rounded-full bg-surface overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.pnl >= 0 ? 'bg-gain/60' : 'bg-loss/60'}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-label font-mono font-medium ${pnlColor(String(m.pnl))}`}>
                            {formatPnl(String(m.pnl))}
                          </span>
                          <p className="text-caption text-tertiary">{m.count} position{m.count !== 1 ? 's' : ''}</p>
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
                {[1, 2, 3].map(i => <PortfolioCardSkeleton key={i} />)}
              </div>
              <TableSkeleton />
            </div>
          ) : paper ? (
            <>
              {/* Paper summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-elevated border border-default rounded-pf p-4">
                  <span className="text-label text-secondary uppercase tracking-wider">Paper P&L</span>
                  <span className={`block mt-1 text-xl font-mono font-semibold ${pnlColor(paper.pnl)}`}>
                    {formatPnl(paper.pnl)}
                  </span>
                </div>
                <div className="bg-elevated border border-default rounded-pf p-4">
                  <span className="text-label text-secondary uppercase tracking-wider">Positions</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-primary">{paper.positions.length}</span>
                </div>
                <div className="bg-elevated border border-default rounded-pf p-4">
                  <span className="text-label text-secondary uppercase tracking-wider">Total Orders</span>
                  <span className="block mt-1 text-xl font-mono font-semibold text-primary">{paper.orderCount}</span>
                </div>
                <div className="bg-elevated border border-default rounded-pf p-4 flex items-end justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={resettingPaper}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`size-4 ${resettingPaper ? 'animate-spin' : ''}`} />
                    Reset Paper Account
                  </Button>
                  {showResetConfirm && (
                    <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowResetConfirm(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowResetConfirm(false); }}>
                      <div role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" className="bg-elevated border border-default rounded-pf p-6 max-w-sm mx-4 shadow-elevation-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="size-5 text-loss" />
                          <h2 id="reset-dialog-title" className="text-body-md font-semibold text-primary">Reset Paper Account</h2>
                        </div>
                        <p className="text-body-sm text-secondary mb-4">This will delete all paper positions and orders. This cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                          <Button type="button" variant="danger" size="sm" onClick={resetPaper}>Reset</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Paper positions */}
              {paper.positions.length === 0 ? (
                <div className="bg-elevated border border-default rounded-pf">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Wallet className="size-10 text-tertiary mb-3" />
                    <p className="text-body-md font-medium text-primary">No paper positions</p>
                    <p className="text-label text-tertiary mt-1">Start a strategy in Paper mode to simulate trades.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-elevated border border-default rounded-pf">
                  <div className="px-4 py-3 border-b border-subtle">
                    <span className="text-body-md font-medium text-primary">Paper Positions</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-body-sm" aria-label="Paper positions">
                      <caption className="sr-only">Paper positions</caption>
                      <thead>
                        <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                          <th scope="col" className="px-4 py-3 font-medium">Token</th>
                          <th scope="col" className="px-4 py-3 font-medium">Side</th>
                          <th scope="col" className="px-4 py-3 font-medium text-right">Size</th>
                          <th scope="col" className="px-4 py-3 font-medium text-right">Unreal. P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {paper.positions.map(pos => (
                          <tr key={pos.tokenId} className="hover:bg-surface/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-primary" title={pos.tokenId}>{formatTokenId(pos.tokenId)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-sm text-label font-medium ${
                                pos.side === 'BUY' ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                              }`}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-primary">
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

      {/* Risk disclaimer — compliance (CLAUDE.md hard rule) */}
      <p className="text-label text-tertiary mt-4 italic">
        Past performance does not guarantee future results. Trading on prediction markets involves risk of loss.
      </p>
    </div>
  );
}
