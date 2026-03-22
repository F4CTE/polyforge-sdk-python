import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Play, ChevronLeft, ChevronRight, History, X, AlertTriangle, XCircle, Loader2,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type BacktestStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface BacktestRun {
  id: string;
  strategyId: string;
  strategyName?: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  status: BacktestStatus;
  progress: number;
  totalPnl: string | null;
  winRate: string | null;
  totalOrders: number | null;
  filledOrders: number | null;
  hasDataGaps?: boolean;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

interface Strategy {
  id: string;
  name: string;
}

interface BacktestsResponse {
  data: BacktestRun[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<BacktestStatus, { text: string; bg: string }> = {
  QUEUED:    { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
  RUNNING:   { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  COMPLETED: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  FAILED:    { text: 'text-red-400', bg: 'bg-red-500/10' },
  CANCELLED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
};

function pnlColor(val: string | null): string {
  if (!val) return 'text-pf-text-muted';
  return parseFloat(val) >= 0 ? 'text-emerald-400' : 'text-red-400';
}

function pnlSign(val: string | null): string {
  if (!val) return '\u2014';
  const v = parseFloat(val);
  return v > 0 ? `+${val}` : val;
}

function winRatePct(val: string | null): string {
  if (!val) return '\u2014';
  return `${(parseFloat(val) * 100).toFixed(1)}%`;
}

function dateRangeLabel(run: BacktestRun): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(run.dateRangeStart)} \u2192 ${fmt(run.dateRangeEnd)}`;
}

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Component() {
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<BacktestRun | null>(null);

  // Form state
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStratId, setSelectedStratId] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadHistory = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/backtests?page=${p}&limit=20`, { credentials: 'include' });
      if (res.ok) {
        const data: BacktestsResponse = await res.json();
        setRuns(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch { toast.error('Failed to load backtests'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory(page);
    // Load strategies for the form
    fetch('/api/v1/strategies?limit=100', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setStrategies(data.data); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadHistory(page); }, [page, loadHistory]);

  const canSubmit = selectedStratId && dateStart && dateEnd && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/backtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategyId: selectedStratId,
          dateRangeStart: new Date(dateStart).toISOString(),
          dateRangeEnd: new Date(dateEnd).toISOString(),
        }),
      });
      if (res.ok) {
        setPage(1);
        loadHistory(1);
      }
    } catch { toast.error('Failed to load data'); }
    setSubmitting(false);
  }

  function selectRun(run: BacktestRun) {
    setSelectedRun(prev => prev?.id === run.id ? null : run);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-pf-text">Backtest</h1>
        {!loading && <span className="text-sm text-pf-text-muted">{total} runs</span>}
      </div>

      {/* New run panel */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Play className="size-4 text-cyan-400" />
          <span className="text-sm font-medium text-pf-text">New Backtest</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Strategy</label>
            <select
              value={selectedStratId}
              onChange={e => setSelectedStratId(e.target.value)}
              className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            >
              <option value="">Select strategy</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block">End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              className="w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full h-9 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Run Backtest
            </button>
          </div>
        </div>
      </div>

      {/* Selected run detail */}
      {selectedRun && (
        <div className="bg-pf-elevated border border-pf-border rounded-pf-lg p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm font-medium text-pf-text">{selectedRun.strategyName ?? 'Unnamed Strategy'}</div>
              <div className="text-xs font-mono text-pf-text-muted mt-1">{dateRangeLabel(selectedRun)}</div>
            </div>
            <button onClick={() => setSelectedRun(null)} className="text-pf-text-muted hover:text-pf-text transition-colors">
              <X className="size-4" />
            </button>
          </div>

          {(selectedRun.status === 'RUNNING' || selectedRun.status === 'QUEUED') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-pf-text-muted">
                  {selectedRun.status === 'QUEUED' ? 'Waiting in queue...' : 'Running...'}
                </span>
                <span className="text-xs font-mono text-cyan-400">{selectedRun.progress}%</span>
              </div>
              <div className="h-1.5 bg-pf-overlay rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${selectedRun.progress}%` }} />
              </div>
            </div>
          )}

          {selectedRun.status === 'COMPLETED' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-pf-surface rounded-pf p-3">
                <span className="text-xs text-pf-text-muted block">Total P&L</span>
                <span className={`text-lg font-mono font-semibold ${pnlColor(selectedRun.totalPnl)}`}>
                  {pnlSign(selectedRun.totalPnl)}
                </span>
              </div>
              <div className="bg-pf-surface rounded-pf p-3">
                <span className="text-xs text-pf-text-muted block">Win Rate</span>
                <span className="text-lg font-mono font-semibold text-pf-text">{winRatePct(selectedRun.winRate)}</span>
              </div>
              <div className="bg-pf-surface rounded-pf p-3">
                <span className="text-xs text-pf-text-muted block">Orders Placed</span>
                <span className="text-lg font-mono font-semibold text-pf-text">{selectedRun.totalOrders ?? '\u2014'}</span>
              </div>
              <div className="bg-pf-surface rounded-pf p-3">
                <span className="text-xs text-pf-text-muted block">Orders Filled</span>
                <span className="text-lg font-mono font-semibold text-pf-text">{selectedRun.filledOrders ?? '\u2014'}</span>
              </div>
              {selectedRun.hasDataGaps && (
                <div className="col-span-full flex items-center gap-2 px-3 py-2 rounded-pf bg-amber-500/10 text-amber-400 text-xs">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Results may be affected by data gaps in the selected date range.
                </div>
              )}
            </div>
          )}

          {selectedRun.status === 'FAILED' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-pf bg-red-500/10 text-red-400 text-sm">
              <XCircle className="size-4 shrink-0" />
              {selectedRun.error ?? 'Backtest failed.'}
            </div>
          )}
        </div>
      )}

      {/* History table */}
      <div className="bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Strategy</th>
                <th className="px-4 py-3 font-medium">Date Range</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium text-right">P&L</th>
                <th className="px-4 py-3 font-medium text-right">Win Rate</th>
                <th className="px-4 py-3 font-medium text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pf-border-subtle">
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-pf-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <History className="size-10 text-pf-text-muted mb-3" />
                      <p className="text-sm font-medium text-pf-text">No backtest runs yet</p>
                      <p className="text-xs text-pf-text-muted mt-1">Select a strategy and date range above, then click Run Backtest.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                runs.map(run => {
                  const ss = STATUS_STYLES[run.status] ?? STATUS_STYLES.QUEUED;
                  return (
                    <tr
                      key={run.id}
                      tabIndex={0}
                      onClick={() => selectRun(run)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectRun(run); }}
                      className={`hover:bg-pf-surface/50 transition-colors cursor-pointer ${
                        selectedRun?.id === run.id ? 'bg-pf-cyan-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-medium text-pf-text">{run.strategyName ?? '\u2014'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-pf-text-muted">{dateRangeLabel(run)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {run.status === 'RUNNING' ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-pf-overlay rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${run.progress}%` }} />
                            </div>
                            <span className="font-mono text-[11px] text-cyan-400">{run.progress}%</span>
                          </div>
                        ) : run.status === 'COMPLETED' ? (
                          <span className="font-mono text-[11px] text-emerald-400">100%</span>
                        ) : (
                          <span className="text-pf-text-muted">\u2014</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pnlColor(run.totalPnl)}`}>
                        {pnlSign(run.totalPnl)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-pf-text-secondary">
                        {winRatePct(run.winRate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[11px] text-pf-text-muted">{formatShortDate(run.createdAt)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-mono text-pf-text-secondary">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
