import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Trophy, TrendingUp } from 'lucide-react';
import { Button, Select } from '@polyforge/ui';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Period = '7d' | '30d' | 'allTime';
type Category = 'politics' | 'sports' | 'crypto' | 'finance' | 'entertainment' | 'science' | null;

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  rank: number;
  pnl: string;
  winRate: string;
  tradeCount: number;
  score?: number;
  pnlHistory?: number[];
}

interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: 'All Time', value: 'allTime' },
];

const CATEGORIES: { label: string; value: Category }[] = [
  { label: 'All', value: null },
  { label: 'Politics', value: 'politics' },
  { label: 'Sports', value: 'sports' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Finance', value: 'finance' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'Science', value: 'science' },
];

const MIN_TRADES_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any trades', value: 0 },
  { label: '5+ trades', value: 5 },
  { label: '10+ trades', value: 10 },
  { label: '25+ trades', value: 25 },
  { label: '50+ trades', value: 50 },
];

function pnlColor(pnl: string): string {
  const v = parseFloat(pnl);
  if (isNaN(v)) return 'text-pf-text-secondary';
  return v >= 0 ? 'text-pf-success' : 'text-pf-danger';
}

function pnlSign(pnl: string): string {
  const v = parseFloat(pnl);
  if (isNaN(v)) return pnl;
  const sign = v > 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function rankMedal(rank: number): React.ReactNode {
  if (rank === 1) return <Trophy className="size-3.5 text-pf-gold-400" aria-label="Gold medal" />;
  if (rank === 2) return <Trophy className="size-3.5 text-pf-text-secondary" aria-label="Silver medal" />;
  if (rank === 3) return <Trophy className="size-3.5 text-pf-gold-600" aria-label="Bronze medal" />;
  return null;
}

function rankColor(rank: number): string {
  if (rank === 1) return 'text-pf-warning'; /* gold */
  if (rank === 2) return 'text-pf-text-secondary';
  if (rank === 3) return 'text-pf-gold-600';
  return 'text-pf-text-muted';
}

function userInitials(e: LeaderboardEntry): string {
  return (e.displayName ?? e.username).slice(0, 2).toUpperCase();
}

/* ─── MiniSparkline ──────────────────────────────────────────────────── */

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 48, h = 20;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={isUp ? 'var(--color-pf-success)' : 'var(--color-pf-danger)'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>('7d');
  const [category, setCategory] = useState<Category>(null);
  const [minTrades, setMinTrades] = useState<number>(0);

  const load = useCallback(async (p: number, per: Period, cat: Category, mt: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period: per, page: String(p) });
      if (cat) params.set('category', cat);
      if (mt > 0) params.set('minTrades', String(mt));
      const res = await fetch(`/api/v1/leaderboard?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        setEntries(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setEntries([]);
        toast.error('Failed to load leaderboard');
      }
    } catch {
      setEntries([]);
      toast.error('Failed to load data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, period, category, minTrades); }, [page, period, category, minTrades, load]);

  function changePeriod(p: Period) {
    setPeriod(p);
    setPage(1);
  }

  function changeCategory(cat: Category) {
    setCategory(cat);
    setPage(1);
  }

  function changeMinTrades(mt: number) {
    setMinTrades(mt);
    setPage(1);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Leaderboard</h1>
        {!loading && <span className="text-sm text-pf-text-muted">{total} traders</span>}
      </div>

      {/* Period tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PERIODS.map(p => (
          <Button
            type="button"
            variant="ghost"
            key={p.value}
            onClick={() => changePeriod(p.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              period === p.value
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <Button
            type="button"
            variant="ghost"
            key={String(cat.value)}
            onClick={() => changeCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              category === cat.value
                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'
            }`}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select
          value={String(minTrades)}
          onChange={e => changeMinTrades(Number(e.target.value))}
          className="bg-pf-elevated border border-pf-border rounded-pf text-xs text-pf-text-secondary px-2 py-1.5"
          aria-label="Minimum trades filter"
        >
          {MIN_TRADES_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Leaderboard rankings">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium text-right w-16">Rank</th>
                <th scope="col" className="px-4 py-3 font-medium">Trader</th>
                <th scope="col" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Score</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">P&L</th>
                <th scope="col" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Win Rate</th>
                <th scope="col" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Trend</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {loading && entries.length === 0 ? (
                Array.from({ length: 10 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Trophy className="size-10 text-pf-text-muted mb-3" />
                      <p className="text-sm font-medium text-pf-text">No leaderboard data yet</p>
                      <p className="text-xs text-pf-text-muted mt-1">Rankings will appear once traders have resolved positions.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.userId} className="hover:bg-pf-surface/50 transition-colors">
                    <td className="px-4 py-3 text-right">
                      <div className={`${rankColor(entry.rank)}`}>
                        {rankMedal(entry.rank) !== null ? (
                          <span className="text-lg">{rankMedal(entry.rank)}</span>
                        ) : (
                          <span className="font-mono text-xs">{entry.rank}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                      <Link to={`/profile/${entry.username}`} className="flex items-center gap-3 hover:text-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 transition-colors">
                        {entry.avatarUrl ? (
                          <img src={entry.avatarUrl} alt={`${entry.displayName ?? entry.username} avatar`} className="size-8 rounded-full object-cover" width={32} height={32} loading="lazy" />
                        ) : (
                          <div className="size-8 rounded-full bg-pf-surface flex items-center justify-center text-[11px] font-semibold text-pf-cyan-400">
                            {userInitials(entry)}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-pf-text">{entry.displayName ?? entry.username}</div>
                          {entry.displayName && (
                            <div className="text-xs text-pf-text-muted">@{entry.username}</div>
                          )}
                        </div>
                      </Link>
                      <Link
                        to={`/copy/new?address=${encodeURIComponent(entry.username)}`}
                        title="Copy trade this trader"
                        className="shrink-0 text-[10px] px-2 py-1 rounded border border-pf-cyan-500/30 bg-pf-cyan-500/8 text-pf-cyan-400 hover:bg-pf-cyan-500/20 transition-colors font-medium"
                      >
                        Copy Trade
                      </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {entry.score != null ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold ${
                          entry.score >= 80 ? 'text-pf-success bg-pf-success/10' :
                          entry.score >= 60 ? 'text-pf-cyan-400 bg-pf-cyan-500/10' :
                          entry.score >= 40 ? 'text-pf-warning bg-pf-warning/10' :
                          'text-pf-danger bg-pf-danger/10'
                        }`}>
                          <TrendingUp className="size-3" />
                          {entry.score}
                        </span>
                      ) : (
                        <span className="text-xs text-pf-text-muted">&mdash;</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${pnlColor(entry.pnl)}`}>
                      {pnlSign(entry.pnl)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-pf-text-secondary hidden sm:table-cell">
                      {entry.winRate}%
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {entry.pnlHistory && entry.pnlHistory.length >= 2 ? (
                        <div className="flex justify-end">
                          <MiniSparkline data={entry.pnlHistory} />
                        </div>
                      ) : (
                        <span className="text-xs text-pf-text-muted">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">
                      {entry.tradeCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-mono text-pf-text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
