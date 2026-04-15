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
  if (isNaN(v)) return 'text-secondary';
  return v >= 0 ? 'text-gain' : 'text-loss';
}

function pnlSign(pnl: string): string {
  const v = parseFloat(pnl);
  if (isNaN(v)) return pnl;
  const sign = v > 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function rankMedal(rank: number): React.ReactNode {
  if (rank === 1) return <Trophy data-testid="medal-badge" data-medal="gold" className="size-4 text-pf-gold-400" aria-label="Gold medal" />;
  if (rank === 2) return <Trophy data-testid="medal-badge" data-medal="silver" className="size-4 text-secondary" aria-label="Silver medal" />;
  if (rank === 3) return <Trophy data-testid="medal-badge" data-medal="bronze" className="size-4 text-pf-gold-600" aria-label="Bronze medal" />;
  return null;
}

function rankColor(rank: number): string {
  if (rank === 1) return 'text-warning'; /* gold */
  if (rank === 2) return 'text-secondary';
  if (rank === 3) return 'text-pf-gold-600';
  return 'text-tertiary';
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
        stroke={isUp ? 'var(--gain)' : 'var(--loss)'}
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
        <h1 className="text-2xl font-semibold text-primary">Leaderboard</h1>
        {!loading && <span className="text-sm text-tertiary">{total} traders</span>}
      </div>

      {/* Period tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PERIODS.map(p => (
          <Button
            type="button"
            variant="ghost"
            key={p.value}
            role="tab"
            aria-selected={period === p.value}
            onClick={() => changePeriod(p.value)}
            className={`px-3 py-2 rounded-pf-full text-xs font-medium whitespace-nowrap border transition-colors ${
              period === p.value
                ? 'bg-accent/15 text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
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
            className={`px-3 py-2 rounded-pf-full text-xs font-medium whitespace-nowrap border transition-colors ${
              category === cat.value
                ? 'bg-accent/15 text-accent-text border-accent/30'
                : 'bg-elevated text-secondary border-default hover:border-strong'
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
          className="bg-elevated border border-default rounded-pf text-xs text-secondary px-2 py-2"
          aria-label="Minimum trades filter"
        >
          {MIN_TRADES_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div data-testid="leaderboard-table" className="bg-elevated border border-default rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Leaderboard rankings">
            <thead>
              <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wider">
                <th scope="col" data-testid="column-rank" className="px-4 py-3 font-medium text-right w-16">Rank</th>
                <th scope="col" data-testid="column-trader" className="px-4 py-3 font-medium">Trader</th>
                <th scope="col" data-testid="column-score" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Score</th>
                <th scope="col" data-testid="column-pnl" className="px-4 py-3 font-medium text-right">P&L</th>
                <th scope="col" data-testid="column-win-rate" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Win Rate</th>
                <th scope="col" data-testid="column-trend" className="px-4 py-3 font-medium text-right hidden sm:table-cell">Trend</th>
                <th scope="col" data-testid="column-trades" className="px-4 py-3 font-medium text-right">Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading && entries.length === 0 ? (
                Array.from({ length: 10 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Trophy className="size-10 text-tertiary mb-3" />
                      <p className="text-sm font-medium text-primary">No leaderboard data yet</p>
                      <p className="text-xs text-tertiary mt-1">Rankings will appear once traders have resolved positions.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.userId} data-testid="trader-row" data-username={entry.username} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-right">
                      <div data-testid="trader-rank" className={`${rankColor(entry.rank)}`}>
                        {rankMedal(entry.rank) !== null ? (
                          <span className="text-lg"><span className="sr-only">{entry.rank}</span>{rankMedal(entry.rank)}</span>
                        ) : (
                          <span className="font-mono text-xs">{entry.rank}</span>
                        )}
                      </div>
                    </td>
                    <td data-testid="trader-name" className="px-4 py-3">
                      <div className="flex items-center gap-2">
                      <Link to={`/profile/${entry.username}`} data-testid={`trader-${entry.username}`} className="flex items-center gap-3 hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors">
                        {entry.avatarUrl ? (
                          <img src={entry.avatarUrl} alt={`${entry.displayName ?? entry.username} avatar`} className="size-8 rounded-pf-full object-cover" width={32} height={32} loading="lazy" />
                        ) : (
                          <div className="size-8 rounded-pf-full bg-surface flex items-center justify-center text-pf-label font-semibold text-accent-text">
                            {userInitials(entry)}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-primary">{entry.displayName ?? entry.username}</div>
                          {entry.displayName && (
                            <div className="text-xs text-tertiary">@{entry.username}</div>
                          )}
                        </div>
                      </Link>
                      <Link
                        to={`/copy/new?address=${encodeURIComponent(entry.username)}`}
                        title="Copy trade this trader"
                        className="shrink-0 text-pf-caption px-2 py-1 rounded border border-accent/30 bg-accent/8 text-accent-text hover:bg-accent/20 transition-colors font-medium"
                      >
                        Copy Trade
                      </Link>
                      </div>
                    </td>
                    <td data-testid="trader-score" className="px-4 py-3 text-right hidden sm:table-cell">
                      {entry.score != null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-bold ${
                          entry.score >= 80 ? 'text-gain bg-gain/10' :
                          entry.score >= 60 ? 'text-accent-text bg-accent/10' :
                          entry.score >= 40 ? 'text-warning bg-warning/10' :
                          'text-loss bg-loss/10'
                        }`}>
                          <TrendingUp className="size-3" />
                          {entry.score}
                        </span>
                      ) : (
                        <span className="text-xs text-tertiary">&mdash;</span>
                      )}
                    </td>
                    <td data-testid="trader-pnl" className={`px-4 py-3 text-right font-mono ${pnlColor(entry.pnl)}`}>
                      {pnlSign(entry.pnl)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-secondary hidden sm:table-cell">
                      {entry.winRate}%
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {entry.pnlHistory && entry.pnlHistory.length >= 2 ? (
                        <div className="flex justify-end">
                          <MiniSparkline data={entry.pnlHistory} />
                        </div>
                      ) : (
                        <span className="text-xs text-tertiary">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-secondary">
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
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span data-testid="page-indicator" className="text-sm font-mono text-secondary" aria-live="polite">{page} / {totalPages}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="p-2 rounded-pf text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
