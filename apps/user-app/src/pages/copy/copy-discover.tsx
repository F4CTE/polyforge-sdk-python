import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Users,
  Trophy,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Select, CardSkeleton, SkeletonLine, SkeletonCircle, SkeletonBadge } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TraderCard {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  rank: number;
  pnl: string;
  winRate: string;
  tradeCount: number;
  score?: number;
}

interface LeaderboardResponse {
  data: TraderCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CopyConfig {
  id: string;
  targetWallet: string;
  userId?: string;
}

interface TraderComparisonData {
  userId: string;
  username: string;
  displayName?: string;
  avatarInitials: string;
  edgeScore: number;
  winRate: number;
  totalPnl: string;
  avgTradesPerMonth: number;
  maxDrawdown: string;
  sharpeRatio?: number;
  copyFee: number;
  activeCopiers: number;
  topCategories: string[];
  pnlHistory: number[];
  recentTrades: Array<{
    marketTitle: string;
    outcome: 'YES' | 'NO';
    result: 'win' | 'loss';
    pnl: string;
  }>;
}

type Category = 'All' | 'Politics' | 'Sports' | 'Crypto' | 'Finance' | 'Entertainment';
type WinRateFilter = 'Any' | '50' | '60' | '70' | '80';
type MinTradesFilter = 'Any' | '10' | '25' | '50' | '100';

/* ─── Constants ──────────────────────────────────────────────────────── */

const CATEGORIES: Category[] = ['All', 'Politics', 'Sports', 'Crypto', 'Finance', 'Entertainment'];

const WIN_RATE_OPTIONS: { label: string; value: WinRateFilter }[] = [
  { label: 'Any', value: 'Any' },
  { label: '50%+', value: '50' },
  { label: '60%+', value: '60' },
  { label: '70%+', value: '70' },
  { label: '80%+', value: '80' },
];

const MIN_TRADES_OPTIONS: { label: string; value: MinTradesFilter }[] = [
  { label: 'Any', value: 'Any' },
  { label: '10+', value: '10' },
  { label: '25+', value: '25' },
  { label: '50+', value: '50' },
  { label: '100+', value: '100' },
];

const MAX_COMPARE = 3;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-warning/20 text-warning border border-warning/30';
  if (rank === 2) return 'bg-primary/20 text-primary/70 border border-primary/30';
  if (rank === 3) return 'bg-warning/20 text-warning/80 border border-warning/30';
  return 'bg-overlay text-tertiary border border-default';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-gain';
  if (score >= 60) return 'text-accent-text';
  if (score >= 40) return 'text-warning';
  return 'text-loss';
}

function pnlIsPositive(pnl: string): boolean {
  const num = parseFloat(pnl.replace(/[^0-9.-]/g, ''));
  return !pnl.startsWith('-') && num >= 0;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Parse a numeric value out of a stat string for best/worst highlighting. */
function statNumeric(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const str = String(value);
  const n = parseFloat(str.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

/** Among a list of numbers, return the index of the max (or min if lowerIsBetter). */
function bestIndex(values: (number | null)[], lowerIsBetter = false): number | null {
  const defined = values.filter((v) => v !== null) as number[];
  if (defined.length < 2) return null;
  const target = lowerIsBetter ? Math.min(...defined) : Math.max(...defined);
  return values.findIndex((v) => v === target);
}

function worstIndex(values: (number | null)[], lowerIsBetter = false): number | null {
  const defined = values.filter((v) => v !== null) as number[];
  if (defined.length < 2) return null;
  const target = lowerIsBetter ? Math.max(...defined) : Math.min(...defined);
  return values.findIndex((v) => v === target);
}

/** Build an inline SVG sparkline from an array of numbers. */
function buildSparklinePath(data: number[], width: number, height: number): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(' L ')}`;
}

const CATEGORY_EMOJI: Record<string, string> = {
  crypto: '₿',
  politics: '🏛',
  sports: '⚽',
  finance: '📈',
  entertainment: '🎬',
  science: '🔬',
  tech: '💻',
  weather: '🌤',
};

function categoryEmoji(cat: string): string {
  return CATEGORY_EMOJI[cat.toLowerCase()] ?? '🏷';
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

function CopyDiscoverSkeleton() {
  return (
    <CardSkeleton>
      <div className="flex items-center gap-3">
        <SkeletonCircle />
        <div className="flex-1 space-y-2">
          <SkeletonLine h="h-4" w="w-[55%]" />
          <SkeletonLine w="w-[35%]" />
        </div>
        <SkeletonBadge w="w-10" />
      </div>
      <SkeletonLine w="w-[40%]" />
      <div className="flex gap-3">
        <SkeletonLine h="h-4" w="w-[30%]" />
        <SkeletonLine h="h-4" w="w-[25%]" />
        <SkeletonLine h="h-4" w="w-[20%]" />
      </div>
      <div className="flex gap-2 pt-1">
        <SkeletonLine h="h-8" className="rounded-pf" />
        <SkeletonLine h="h-8" w="w-24" className="rounded-pf shrink-0" />
      </div>
    </CardSkeleton>
  );
}

/* ─── Comparison loading skeleton ────────────────────────────────────── */

function ComparisonSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4 animate-shimmer">
      {/* Header row */}
      <div className={`grid gap-4`} style={{ gridTemplateColumns: `180px repeat(${count}, 1fr)` }}>
        <div />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-overlay" />
            <div className="h-4 bg-overlay rounded w-20" />
            <div className="h-3 bg-overlay rounded w-14" />
          </div>
        ))}
      </div>
      {/* Stat rows */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
        <div key={r} className="grid gap-4 border-t border-subtle pt-3"
          style={{ gridTemplateColumns: `180px repeat(${count}, 1fr)` }}>
          <div className="h-4 bg-overlay rounded w-28" />
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-4 bg-overlay rounded w-16 mx-auto" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Mini Sparkline ─────────────────────────────────────────────────── */

function MiniSparkline({ data }: { data: number[] }) {
  const W = 48;
  const H = 24;
  if (!data || data.length < 2) {
    return <div className="w-12 h-6 bg-overlay rounded" />;
  }
  const path = buildSparklinePath(data, W, H);
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={isUp ? 'var(--gain)' : 'var(--loss)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── ComparisonPanel ────────────────────────────────────────────────── */

interface ComparisonPanelProps {
  data: TraderComparisonData[];
  loading: boolean;
  onBack: () => void;
}

interface StatRow {
  label: string;
  key: keyof TraderComparisonData | string;
  format: (t: TraderComparisonData) => string;
  /** numeric raw value for highlighting */
  raw: (t: TraderComparisonData) => number | null;
  lowerIsBetter?: boolean;
}

const STAT_ROWS: StatRow[] = [
  {
    label: 'Edge Score',
    key: 'edgeScore',
    format: (t) => String(t.edgeScore),
    raw: (t) => t.edgeScore,
  },
  {
    label: 'Win Rate',
    key: 'winRate',
    format: (t) => `${t.winRate}%`,
    raw: (t) => t.winRate,
  },
  {
    label: 'Total P&L',
    key: 'totalPnl',
    format: (t) => t.totalPnl,
    raw: (t) => statNumeric(t.totalPnl),
  },
  {
    label: 'Avg Trades / mo',
    key: 'avgTradesPerMonth',
    format: (t) => String(t.avgTradesPerMonth),
    raw: (t) => t.avgTradesPerMonth,
  },
  {
    label: 'Max Drawdown',
    key: 'maxDrawdown',
    format: (t) => t.maxDrawdown,
    raw: (t) => statNumeric(t.maxDrawdown),
    lowerIsBetter: true,
  },
  {
    label: 'Sharpe Ratio',
    key: 'sharpeRatio',
    format: (t) => (t.sharpeRatio !== undefined ? t.sharpeRatio.toFixed(2) : '—'),
    raw: (t) => t.sharpeRatio ?? null,
  },
  {
    label: 'Copy Fee',
    key: 'copyFee',
    format: (t) => `${t.copyFee}%`,
    raw: (t) => t.copyFee,
    lowerIsBetter: true,
  },
  {
    label: 'Active Copiers',
    key: 'activeCopiers',
    format: (t) => t.activeCopiers.toLocaleString(),
    raw: (t) => t.activeCopiers,
  },
];

function ComparisonPanel({ data, loading, onBack }: ComparisonPanelProps) {
  const navigate = useNavigate();
  const count = data.length || 2;

  if (loading) {
    return (
      <div className="bg-elevated border border-default rounded-pf p-6 space-y-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2 text-body-sm text-secondary hover:text-primary transition-colors mb-2"
        >
          <ChevronLeft className="size-4" />
          Back to traders
        </Button>
        <ComparisonSkeleton count={count} />
      </div>
    );
  }

  if (data.length === 0) return null;

  const colTemplate = `180px repeat(${data.length}, 1fr)`;

  return (
    <div className="bg-elevated border border-default rounded-pf overflow-hidden">
      {/* Back button */}
      <div className="px-6 pt-5 pb-3 border-b border-subtle">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2 text-body-sm text-secondary hover:text-primary transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to traders
        </Button>
      </div>

      <div className="p-6 space-y-6 overflow-x-auto">
        {/* ── Header: avatars + names ───────────────────────────────── */}
        <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: colTemplate }}>
          <div className="flex items-end pb-1">
            <span className="text-label font-semibold text-tertiary uppercase tracking-wider">
              Trader
            </span>
          </div>
          {data.map((t) => (
            <div key={t.userId} className="flex flex-col items-center gap-2 text-center">
              <div className="size-12 rounded-full bg-accent/20 text-accent-text flex items-center justify-center text-base font-semibold select-none">
                {t.avatarInitials}
              </div>
              <div>
                <p className="text-body-md font-semibold text-primary">
                  {t.displayName ?? t.username}
                </p>
                <p className="text-label text-tertiary">@{t.username}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats table ───────────────────────────────────────────── */}
        <div className="space-y-0 min-w-max">
          {STAT_ROWS.map((row, ri) => {
            const raws = data.map((t) => row.raw(t));
            const bi = bestIndex(raws, row.lowerIsBetter);
            const wi = worstIndex(raws, row.lowerIsBetter);
            return (
              <div
                key={row.label}
                className={`grid gap-4 py-3 ${ri > 0 ? 'border-t border-subtle' : ''}`}
                style={{ gridTemplateColumns: colTemplate }}
              >
                <span className="text-label text-secondary self-center">{row.label}</span>
                {data.map((t, ci) => {
                  const isBest = bi === ci;
                  const isWorst = wi === ci;
                  return (
                    <div key={t.userId} className="flex items-center justify-center">
                      <span
                        className={`text-body-md font-mono font-semibold px-2 py-1 rounded ${
                          isBest
                            ? 'bg-gain/10 text-gain'
                            : isWorst
                            ? 'bg-loss/10 text-loss'
                            : 'text-primary'
                        }`}
                      >
                        {row.format(t)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Sparkline row ─────────────────────────────────────────── */}
        <div className="border-t border-default pt-4">
          <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: colTemplate }}>
            <span className="text-label text-secondary self-center">P&L Trend</span>
            {data.map((t) => (
              <div key={t.userId} className="flex items-center justify-center">
                <MiniSparkline data={t.pnlHistory} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Top categories row ────────────────────────────────────── */}
        <div className="border-t border-default pt-4">
          <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: colTemplate }}>
            <span className="text-label text-secondary self-center">Top Categories</span>
            {data.map((t) => (
              <div key={t.userId} className="flex flex-wrap justify-center gap-1">
                {t.topCategories.slice(0, 4).map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-label bg-overlay text-secondary border border-default"
                  >
                    {categoryEmoji(cat)} {cat}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent trades ─────────────────────────────────────────── */}
        <div className="border-t border-default pt-4">
          <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: colTemplate }}>
            <span className="text-label text-secondary self-start pt-1">Recent Trades</span>
            {data.map((t) => (
              <div key={t.userId} className="space-y-2">
                {t.recentTrades.slice(0, 3).map((trade, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-overlay rounded-pf px-3 py-2"
                  >
                    <span
                      className={`text-caption font-semibold px-2 py-1 rounded shrink-0 ${
                        trade.result === 'win'
                          ? 'bg-gain-subtle text-gain'
                          : 'bg-loss-subtle text-loss'
                      }`}
                    >
                      {trade.result === 'win' ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-label text-secondary truncate flex-1 max-w-[120px]">
                      {trade.marketTitle}
                    </span>
                    <span
                      className={`text-label font-mono shrink-0 ${
                        pnlIsPositive(trade.pnl) ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {trade.pnl}
                    </span>
                  </div>
                ))}
                {t.recentTrades.length === 0 && (
                  <p className="text-label text-tertiary text-center py-1">No recent trades</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA buttons ───────────────────────────────────────────── */}
        <div className="border-t border-default pt-5">
          <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: colTemplate }}>
            <div />
            {data.map((t) => (
              <div key={t.userId} className="flex flex-col items-center gap-2">
                <Button
                  type="button"
                  onClick={() => navigate(`/copy/setup/${t.userId}`)}
                  className="w-full px-4 py-2 rounded-pf text-body-md font-semibold bg-accent text-inverse hover:bg-accent-text transition-colors"
                >
                  Copy @{t.username}
                </Button>
                <Link
                  to={`/profile/${t.username}`}
                  className="text-label text-secondary hover:text-primary transition-colors"
                >
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Trader Card ────────────────────────────────────────────────────── */

function TraderCardItem({
  trader,
  isCopying,
  compareMode,
  isSelected,
  isDisabled,
  onToggle,
}: {
  trader: TraderCard;
  isCopying: boolean;
  compareMode: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (id: string) => void;
}) {
  const navigate = useNavigate();
  const positive = pnlIsPositive(trader.pnl);

  return (
    <div
      className={`relative bg-elevated border rounded-pf p-4 hover:border-strong transition-colors flex flex-col gap-3 ${
        compareMode && isSelected
          ? 'border-accent/50 ring-1 ring-accent/20'
          : 'border-default'
      } ${compareMode && isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
      role={compareMode ? 'checkbox' : undefined}
      aria-checked={compareMode ? isSelected : undefined}
      onClick={compareMode ? () => onToggle(trader.userId) : undefined}
      style={{ cursor: compareMode ? 'pointer' : undefined }}
    >
      {/* Compare mode checkbox overlay */}
      {compareMode && (
        <div className="absolute top-3 left-3 z-10">
          <div
            className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-accent border-accent'
                : 'bg-overlay border-strong'
            }`}
          >
            {isSelected && <Check className="size-3 text-inverse" strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* Avatar + name + rank */}
      <div className={`flex items-center gap-3 ${compareMode ? 'pl-7' : ''}`}>
        {trader.avatarUrl ? (
          <img
            src={trader.avatarUrl}
            alt={trader.displayName ?? trader.username}
            className="size-10 rounded-full object-cover shrink-0 bg-overlay"
          />
        ) : (
          <div className="size-10 rounded-full bg-accent/20 text-accent-text flex items-center justify-center text-body-md font-semibold shrink-0 select-none">
            {initials(trader.displayName ?? trader.username)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-body-md font-medium text-primary truncate">
            {trader.displayName ?? trader.username}
          </p>
          <p className="text-label text-tertiary truncate">@{trader.username}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-label font-semibold shrink-0 ${rankBadgeClass(trader.rank)}`}
          title={`Rank #${trader.rank}`}
        >
          {trader.rank <= 3 && <Trophy className="size-3" aria-hidden="true" />}#
          {trader.rank}
        </span>
      </div>

      {/* Edge Score badge */}
      {trader.score !== undefined && (
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-tertiary" aria-hidden="true" />
          <span className="text-label text-secondary">Edge Score</span>
          <span className={`text-label font-mono font-semibold ${scoreColor(trader.score)}`}>
            {trader.score}
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-label">
        <span className="flex flex-col gap-1">
          <span className="text-tertiary">P&amp;L</span>
          <span className={`font-mono font-semibold ${positive ? 'text-gain' : 'text-loss'}`}>
            {trader.pnl}
          </span>
        </span>
        <span className="text-strong">|</span>
        <span className="flex flex-col gap-1">
          <span className="text-tertiary">Win Rate</span>
          <span className="font-mono text-primary">{trader.winRate}</span>
        </span>
        <span className="text-strong">|</span>
        <span className="flex flex-col gap-1">
          <span className="text-tertiary">Trades</span>
          <span className="font-mono text-primary">{trader.tradeCount}</span>
        </span>
      </div>

      {/* Actions — hidden in compare mode so card click does toggling */}
      {!compareMode && (
        <div className="flex items-center gap-2 pt-1 border-t border-subtle">
          <Link
            to={`/profile/${trader.username}`}
            className="flex-1 text-center px-3 py-2 rounded-pf text-label font-medium text-secondary bg-overlay hover:bg-surface hover:text-primary transition-colors"
          >
            View Profile
          </Link>
          {isCopying ? (
            <span className="flex items-center gap-1 px-3 py-2 rounded-pf text-label font-medium bg-gain/10 text-gain border border-gain/20 shrink-0">
              Already Copying
            </span>
          ) : (
            <Button
              type="button"
              onClick={() => navigate(`/copy/new?address=${trader.username}`)}
              className="px-3 py-2 rounded-pf text-label font-medium bg-accent text-inverse hover:bg-accent-text transition-colors shrink-0"
            >
              Copy Trade
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [traders, setTraders] = useState<TraderCard[]>([]);
  const [copyConfigs, setCopyConfigs] = useState<CopyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  /* Filters */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [winRate, setWinRate] = useState<WinRateFilter>('Any');
  const [minTrades, setMinTrades] = useState<MinTradesFilter>('Any');

  /* Compare mode */
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<TraderComparisonData[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  /* Fetch existing copy configs once to detect "already copying" */
  useEffect(() => {
    fetch('/api/v1/copy?limit=100&page=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.data) setCopyConfigs(res.data);
      })
      .catch(() => {/* ignore — non-critical */});
  }, []);

  const load = useCallback(
    (p: number = 1) => {
      setLoading(true);
      const params = new URLSearchParams({
        period: 'allTime',
        page: String(p),
        limit: '20',
      });
      if (category !== 'All') params.set('category', category);
      if (winRate !== 'Any') params.set('minWinRate', winRate);
      if (minTrades !== 'Any') params.set('minTrades', minTrades);
      if (search.trim()) params.set('q', search.trim());

      fetch(`/api/v1/leaderboard?${params}`, { credentials: 'include' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((res: LeaderboardResponse) => {
          setTraders(res.data ?? []);
          setTotalPages(res.totalPages ?? 0);
          setLoading(false);
        })
        .catch(() => {
          toast.error('Failed to load traders');
          setTraders([]);
          setLoading(false);
        });
    },
    [category, winRate, minTrades, search],
  );

  useEffect(() => {
    setPage(1);
    load(1);
  }, [load]);

  function onPageChange(next: number) {
    setPage(next);
    load(next);
  }

  /* Client-side search filter applied on top of whatever the API returns */
  const visibleTraders = search.trim()
    ? traders.filter(
        (t) =>
          t.username.toLowerCase().includes(search.trim().toLowerCase()) ||
          (t.displayName ?? '').toLowerCase().includes(search.trim().toLowerCase()),
      )
    : traders;

  /* Determine which traders are already being copied */
  const copiedUserIds = new Set(copyConfigs.map((c) => c.userId).filter(Boolean));
  const copiedWallets = new Set(copyConfigs.map((c) => c.targetWallet));

  function isCopying(trader: TraderCard): boolean {
    return copiedUserIds.has(trader.userId) || copiedWallets.has(trader.username);
  }

  /* ── Compare mode handlers ──────────────────────────────────────── */

  function enterCompareMode() {
    setCompareMode(true);
    setSelectedIds([]);
    setShowComparison(false);
    setCompareData([]);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([]);
    setShowComparison(false);
    setCompareData([]);
  }

  function toggleSelection(userId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, userId];
    });
  }

  async function openComparison() {
    if (selectedIds.length < 2) {
      toast.error('Select at least 2 traders to compare');
      return;
    }
    setLoadingCompare(true);
    setShowComparison(true);
    try {
      const res = await fetch('/api/v1/copy/compare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCompareData(json.data ?? []);
    } catch {
      toast.error('Failed to load comparison data');
      setShowComparison(false);
    } finally {
      setLoadingCompare(false);
    }
  }

  function handleBackFromComparison() {
    setShowComparison(false);
    setCompareData([]);
  }

  /* Selected trader name chips for the sticky bar */
  const selectedTraders = traders.filter((t) => selectedIds.includes(t.userId));

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Users className="size-6 text-accent-text mt-1 shrink-0" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-primary">Discover Traders</h1>
            <p className="text-body-sm text-tertiary mt-1">Find top performers to copy</p>
          </div>
        </div>

        {/* Compare toggle */}
        {!compareMode ? (
          <Button
            type="button"
            variant="secondary"
            onClick={enterCompareMode}
            className="flex items-center gap-2 px-3 py-2 rounded-pf text-body-sm font-medium border border-default text-secondary bg-elevated hover:text-primary hover:border-strong transition-colors shrink-0"
          >
            <GitCompare className="size-4" />
            Compare
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={exitCompareMode}
            className="flex items-center gap-2 px-3 py-2 rounded-pf text-body-md font-medium border border-accent/30 text-accent-text bg-accent/10 hover:bg-accent/20 transition-colors shrink-0"
          >
            <X className="size-4" />
            Exit Compare
          </Button>
        )}
      </div>

      {/* Compare mode hint banner */}
      {compareMode && !showComparison && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-pf bg-accent-subtle border border-accent/20 text-body-md text-accent-text">
          <GitCompare className="size-4 shrink-0" />
          Select 2–3 traders to compare side by side. Click a card to select it.
        </div>
      )}

      {/* Filter bar — hidden while showing comparison panel */}
      {!showComparison && (
        <div className="space-y-3">
          {/* Search */}
          <Input
            type="search"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-sm px-3 py-2 rounded-pf bg-elevated border border-default text-primary text-body-sm placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-1 focus-visible:ring-accent/20 transition-colors"
          />

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                type="button"
                variant="ghost"
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 text-body-sm rounded-full border transition-colors cursor-pointer ${
                  category === cat
                    ? 'bg-accent/10 border-accent/30 text-accent-text'
                    : 'border-default text-secondary hover:text-primary'
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Win Rate + Min Trades selects */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-label text-secondary whitespace-nowrap" htmlFor="win-rate-filter">
                Win Rate
              </label>
              <Select
                id="win-rate-filter"
                value={winRate}
                onChange={(e) => setWinRate(e.target.value as WinRateFilter)}
                className="px-3 py-2 rounded-pf bg-elevated border border-default text-primary text-body-md focus-visible:outline-none focus-visible:border-accent/50 transition-colors cursor-pointer"
              >
                {WIN_RATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-label text-secondary whitespace-nowrap" htmlFor="min-trades-filter">
                Min Trades
              </label>
              <Select
                id="min-trades-filter"
                value={minTrades}
                onChange={(e) => setMinTrades(e.target.value as MinTradesFilter)}
                className="px-3 py-2 rounded-pf bg-elevated border border-default text-primary text-body-md focus-visible:outline-none focus-visible:border-accent/50 transition-colors cursor-pointer"
              >
                {MIN_TRADES_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Panel */}
      {showComparison && (
        <ComparisonPanel
          data={compareData}
          loading={loadingCompare}
          onBack={handleBackFromComparison}
        />
      )}

      {/* Loading skeletons */}
      {!showComparison && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CopyDiscoverSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!showComparison && !loading && visibleTraders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="size-10 text-tertiary mb-4" aria-hidden="true" />
          <p className="text-primary font-medium">No traders found matching your filters</p>
          <p className="text-body-sm text-tertiary mt-1">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Trader cards grid */}
      {!showComparison && !loading && visibleTraders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {visibleTraders.map((trader) => {
            const isSelected = selectedIds.includes(trader.userId);
            const isDisabled = compareMode && !isSelected && selectedIds.length >= MAX_COMPARE;
            return (
              <TraderCardItem
                key={trader.userId}
                trader={trader}
                isCopying={isCopying(trader)}
                compareMode={compareMode}
                isSelected={isSelected}
                isDisabled={isDisabled}
                onToggle={toggleSelection}
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!showComparison && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-body-sm font-mono text-secondary" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Spacer so last card row clears sticky bar */}
      {compareMode && selectedIds.length >= 2 && !showComparison && <div className="h-20" />}

      {/* Sticky bottom compare bar */}
      {compareMode && selectedIds.length >= 2 && !showComparison && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-default bg-surface/95 backdrop-blur-sm px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
            <span className="text-body-sm font-medium text-secondary shrink-0">
              Comparing {selectedIds.length} trader{selectedIds.length !== 1 ? 's' : ''}
            </span>

            {/* Trader chips */}
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              {selectedTraders.map((t) => (
                <span
                  key={t.userId}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-label font-medium bg-accent/10 text-accent-text border border-accent/25"
                >
                  @{t.username}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleSelection(t.userId)}
                    aria-label={`Remove ${t.username}`}
                    className="text-accent-text/60 hover:text-accent-text transition-colors"
                  >
                    <X className="size-3" />
                  </Button>
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedIds([])}
                className="px-3 py-2 rounded-pf text-body-sm text-secondary hover:text-primary border border-default hover:border-strong bg-elevated transition-colors"
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={openComparison}
                className="flex items-center gap-2 px-4 py-2 rounded-pf text-body-md font-semibold bg-accent text-inverse hover:bg-accent-text transition-colors"
              >
                <GitCompare className="size-4" />
                Compare
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
