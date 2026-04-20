import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import {
  Play, ChevronLeft, ChevronRight, History, X, AlertTriangle, XCircle, Loader2, Clock,
} from 'lucide-react';
import { Button, Input, Select } from '@polyforge/ui';
import { useBetaUsage } from '@/hooks/use-beta-usage';
import { chartTooltipContentStyle, chartAxisTick } from '@polyforge/ui/lib/chart-styles';

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
  QUEUED:    { text: 'text-tertiary', bg: 'bg-overlay' },
  RUNNING:   { text: 'text-accent-text', bg: 'bg-accent/10' },
  COMPLETED: { text: 'text-gain', bg: 'bg-gain/10' },
  FAILED:    { text: 'text-loss', bg: 'bg-loss/10' },
  CANCELLED: { text: 'text-tertiary', bg: 'bg-overlay' },
};

function pnlColor(val: string | null): string {
  if (!val) return 'text-tertiary';
  return parseFloat(val) >= 0 ? 'text-gain' : 'text-loss';
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
  return `${fmt(run.dateRangeStart)} to ${fmt(run.dateRangeEnd)}`;
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

  const { usage: betaUsage } = useBetaUsage();

  // Form state
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStratId, setSelectedStratId] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Market bindings state
  const [marketSlots, setMarketSlots] = useState<{slot: string; label?: string; defaultMarketId?: string}[]>([]);
  const [marketBindings, setMarketBindings] = useState<Record<string, string>>({});
  const [marketSearch, setMarketSearch] = useState<Record<string, string>>({});
  const [marketResults, setMarketResults] = useState<Record<string, Array<{ id: string; title?: string; question?: string }>>>({});

  const loadHistory = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/backtests?page=${p}&limit=20`, { credentials: 'include', cache: 'no-store' });
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
    // Load strategies for the form (only once on mount)
    fetch('/api/v1/strategies?limit=100', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setStrategies(data.data); })
      .catch(() => {});
  }, []);

  // Load history when page changes (handles initial mount too)
  useEffect(() => { loadHistory(page); }, [page, loadHistory]);

  // Load market slots when strategy is selected
  useEffect(() => {
    if (!selectedStratId) {
      setMarketSlots([]);
      setMarketBindings({});
      setMarketSearch({});
      setMarketResults({});
      return;
    }

    fetch(`/api/v1/strategies/${selectedStratId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const strategy = data.data ?? data;
        const slots = new Set<string>();

        // Scan block configs for marketSlot values (strategy stores blocks as {id, type, config})
        const scanBlocks = (blocks: Array<Record<string, unknown>>) => {
          if (!Array.isArray(blocks)) return;
          blocks.forEach(block => {
            const cfg = (block.config ?? block) as Record<string, unknown>;
            if (cfg.marketSlot && typeof cfg.marketSlot === 'string' && cfg.marketSlot.startsWith('$MARKET_')) {
              slots.add(cfg.marketSlot);
            }
            Object.values(cfg).forEach((v: unknown) => {
              if (typeof v === 'string' && v.startsWith('$MARKET_')) slots.add(v);
            });
          });
        };

        // Strategy stores blocks in separate arrays: triggers, conditions, actions, safety
        scanBlocks(strategy.triggers ?? []);
        scanBlocks(strategy.conditions ?? []);
        scanBlocks(strategy.actions ?? []);
        scanBlocks(strategy.safety ?? []);

        // If no slots found in blocks, offer default $MARKET_A so user can still bind a market
        if (slots.size === 0) slots.add('$MARKET_A');

        const uniqueSlots = Array.from(slots).sort().map(slot => ({ slot, label: slot.replace('$', '').replace(/_/g, ' ') }));
        setMarketSlots(uniqueSlots);
        const newBindings: Record<string, string> = {};
        uniqueSlots.forEach(s => { newBindings[s.slot] = ''; });
        setMarketBindings(newBindings);
      })
      .catch(() => {});
  }, [selectedStratId]);

  async function searchMarkets(slot: string, query: string) {
    if (query.length < 2) { setMarketResults(prev => ({ ...prev, [slot]: [] })); return; }
    try {
      const res = await fetch(`/api/v1/markets?search=${encodeURIComponent(query)}&limit=8`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setMarketResults(prev => ({ ...prev, [slot]: json.data ?? json ?? [] }));
      }
    } catch {}
  }

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
          marketBindings,
        }),
      });
      if (res.ok) {
        toast.success('Backtest queued');
        setPage(1);
        loadHistory(1);
      } else {
        toast.error('Failed to submit backtest');
      }
    } catch { toast.error('Failed to submit backtest'); }
    setSubmitting(false);
  }

  // Equity curve state
  const [equityData, setEquityData] = useState<Array<{equityCurve: string; simulatedAt: string}>>([]);
  const [loadingEquity, setLoadingEquity] = useState(false);

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'COMPLETED') {
      setEquityData([]);
      return;
    }
    setLoadingEquity(true);
    fetch(`/api/v1/backtests/${selectedRun.id}/orders`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{equityCurve: string; simulatedAt: string}>) => { setEquityData(data); })
      .catch(() => { setEquityData([]); })
      .finally(() => { setLoadingEquity(false); });
  }, [selectedRun?.id, selectedRun?.status]);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  function selectRun(run: BacktestRun) {
    setSelectedRun(prev => prev?.id === run.id ? null : run);
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Backtest</h1>
        {!loading && <span className="text-body-sm text-tertiary">{total} runs</span>}
      </div>

      {/* New run panel */}
      <div className="bg-elevated border border-default rounded-pf p-5">
        <div className="flex items-center gap-2 mb-4">
          <Play className="size-4 text-accent-text" />
          <span className="text-body-md font-medium text-primary">New Backtest</span>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="backtest-strategy" className="text-label text-secondary uppercase tracking-wider mb-2 block">Strategy</label>
              <Select
                id="backtest-strategy"
                value={selectedStratId}
                onChange={e => setSelectedStratId(e.target.value)}
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50"
              >
                <option value="">Select strategy</option>
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="backtest-start" className="text-label text-secondary uppercase tracking-wider mb-2 block">Start Date</label>
              <input
                id="backtest-start"
                type="date"
                lang="en"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50"
              />
            </div>
            <div>
              <label htmlFor="backtest-end" className="text-label text-secondary uppercase tracking-wider mb-2 block">End Date</label>
              <input
                id="backtest-end"
                type="date"
                lang="en"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-md text-primary focus-visible:outline-none focus-visible:border-accent/50"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="w-full h-9 rounded-pf bg-accent text-inverse text-body-md font-medium hover:bg-accent-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run Backtest
              </Button>
            </div>
          </div>

          {marketSlots.length > 0 && (
            <div className="space-y-3">
              <span className="text-label text-secondary font-medium uppercase tracking-wider" id="market-bindings-label">Market Bindings</span>
              {marketSlots.map(slot => (
                <div key={slot.slot} className="space-y-1">
                  <label htmlFor={`market-binding-${slot.slot}`} className="text-label text-tertiary">{slot.label || slot.slot}</label>
                  <div className="relative">
                    <Input
                      id={`market-binding-${slot.slot}`}
                      type="text"
                      value={marketSearch[slot.slot] ?? marketBindings[slot.slot] ?? ''}
                      onChange={e => {
                        setMarketSearch(prev => ({ ...prev, [slot.slot]: e.target.value }));
                        searchMarkets(slot.slot, e.target.value);
                      }}
                      placeholder="Search markets..."
                      className="w-full h-9 px-3 rounded-pf bg-surface border border-default text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
                    />
                    {marketBindings[slot.slot] && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-caption text-accent-text font-mono">bound</span>
                    )}
                  </div>
                  {(marketResults[slot.slot] ?? []).length > 0 && (
                    <div className="bg-elevated border border-default rounded-pf max-h-40 overflow-y-auto">
                      {marketResults[slot.slot].map((m) => (
                        <Button
                          type="button"
                          variant="ghost"
                          key={m.id}
                          onClick={() => {
                            setMarketBindings(prev => ({ ...prev, [slot.slot]: m.id }));
                            setMarketSearch(prev => ({ ...prev, [slot.slot]: m.title ?? m.question ?? '' }));
                            setMarketResults(prev => ({ ...prev, [slot.slot]: [] }));
                          }}
                          className="w-full text-left px-3 py-2 text-label text-primary hover:bg-surface cursor-pointer transition-colors border-b border-subtle last:border-b-0"
                        >
                          {m.title ?? m.question}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected run detail */}
      {selectedRun && (
        <div className="bg-elevated border border-default rounded-pf p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-body-md font-medium text-primary">{selectedRun.strategyName ?? 'Unnamed Strategy'}</div>
              <div className="text-caption font-mono text-tertiary mt-1">{dateRangeLabel(selectedRun)}</div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedRun(null)} aria-label="Close run details" className="text-tertiary hover:text-primary transition-colors">
              <X className="size-4" />
            </Button>
          </div>

          {(selectedRun.status === 'RUNNING' || selectedRun.status === 'QUEUED') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-label text-tertiary flex items-center gap-1">
                  {selectedRun.status === 'QUEUED' ? (
                    <>
                      <Clock className="size-3 shrink-0" aria-hidden="true" />
                      Queued — waiting for a free slot
                      {betaUsage && (
                        <span className="text-tertiary/70">
                          ({betaUsage.backtests.maxConcurrent} concurrent max)
                        </span>
                      )}
                    </>
                  ) : 'Running...'}
                </span>
                <span className="text-label font-mono text-accent-text">{selectedRun.progress}%</span>
              </div>
              <div className="h-2 bg-overlay rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${selectedRun.progress}%` }} />
              </div>
            </div>
          )}

          {selectedRun.status === 'COMPLETED' && (
            <>
              {/* Simulated results badge — compliance (CLAUDE.md hard rule) */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-label font-medium bg-warning/10 text-warning px-2 py-1 rounded-sm">Simulated</span>
                <span className="text-label text-tertiary">Results based on historical data replay</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface rounded-pf p-3">
                  <span className="text-label text-tertiary block">Total P&L</span>
                  <span data-testid="result-pnl" className={`text-lg font-mono font-semibold ${pnlColor(selectedRun.totalPnl)}`}>
                    {pnlSign(selectedRun.totalPnl)}
                  </span>
                </div>
                <div className="bg-surface rounded-pf p-3">
                  <span className="text-label text-tertiary block">Win Rate</span>
                  <span className="text-lg font-mono font-semibold text-primary">{winRatePct(selectedRun.winRate)}</span>
                </div>
                <div className="bg-surface rounded-pf p-3">
                  <span className="text-label text-tertiary block">Orders Placed</span>
                  <span className="text-lg font-mono font-semibold text-primary">{selectedRun.totalOrders ?? '\u2014'}</span>
                </div>
                <div className="bg-surface rounded-pf p-3">
                  <span className="text-label text-tertiary block">Orders Filled</span>
                  <span className="text-lg font-mono font-semibold text-primary">{selectedRun.filledOrders ?? '\u2014'}</span>
                </div>
                {selectedRun.hasDataGaps && (
                  <div className="col-span-full flex items-center gap-2 px-3 py-2 rounded-pf bg-warning/10 text-warning text-label">
                    <AlertTriangle className="size-4 shrink-0" />
                    Results may be affected by data gaps in the selected date range.
                  </div>
                )}
              </div>
              {equityData.length > 1 && (
                <div className="mt-4">
                  <div className="text-label text-tertiary mb-2 font-medium">Equity Curve</div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={equityData.map(p => ({ time: new Date(p.simulatedAt).toLocaleDateString(), value: parseFloat(p.equityCurve) }))}>
                        <defs>
                          <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-text)" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="var(--accent-text)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" tick={chartAxisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} width={45} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                        <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} contentStyle={chartTooltipContentStyle} />
                        <Area type="monotone" dataKey="value" stroke="var(--accent-text)" strokeWidth={1.5} fill="url(#btGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {loadingEquity && (
                <div className="mt-4 h-40 bg-overlay rounded-pf animate-pulse" />
              )}
              {/* Simulated performance disclaimer — compliance (CLAUDE.md hard rule) */}
              <p className="text-label text-tertiary mt-4 italic">
                Simulated performance based on historical data. Past results do not guarantee future performance. Trading involves risk of loss.
              </p>
            </>
          )}

          {selectedRun.status === 'FAILED' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-pf bg-loss/10 text-loss text-body-md">
              <XCircle className="size-4 shrink-0" />
              {selectedRun.error ?? 'Backtest failed.'}
            </div>
          )}
        </div>
      )}

      {/* History table */}
      <div className="bg-elevated border border-default rounded-pf overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-primary">Backtest History</h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setCompareMode(!compareMode); setCompareA(null); setCompareB(null); }}
              className={`text-label px-3 py-2 rounded-pf border transition-colors ${compareMode ? 'bg-accent-subtle border-accent/30 text-accent-text' : 'border-default text-secondary hover:text-primary'}`}
            >
              {compareMode ? 'Exit Compare' : 'Compare Runs'}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm" aria-label="Backtest history">
            <thead>
              <tr className="bg-surface text-left text-label text-secondary uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 font-medium">Strategy</th>
                <th scope="col" className="px-4 py-3 font-medium">Date Range</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Progress</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">P&L</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Win Rate</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Created</th>
                {compareMode && <th scope="col" className="px-3 py-2 text-right text-label font-medium text-tertiary">Compare</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: compareMode ? 8 : 7 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-overlay rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={compareMode ? 8 : 7}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <History className="size-10 text-tertiary mb-3" />
                      <p className="text-body-md font-medium text-primary">No backtest runs yet</p>
                      <p className="text-caption text-tertiary mt-1">Select a strategy and date range above, then click Run Backtest.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                runs.map(run => {
                  const ss = STATUS_STYLES[run.status] ?? STATUS_STYLES.QUEUED;
                  return (
                    <tr
                      key={run.id}
                      data-testid="backtest-history-row"
                      data-backtest-id={run.id}
                      tabIndex={0}
                      onClick={() => selectRun(run)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectRun(run); }}
                      aria-label={run.strategyName ?? strategies.find(s => s.id === run.strategyId)?.name ?? 'Backtest run'}
                      className={`hover:bg-surface/50 transition-colors cursor-pointer ${
                        selectedRun?.id === run.id ? 'bg-accent-subtle' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-body-sm font-medium text-primary">
                          {run.strategyName
                            ?? strategies.find(s => s.id === run.strategyId)?.name
                            ?? (run.strategyId ? `${run.strategyId.slice(0, 8)}...` : '\u2014')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-label text-tertiary">{dateRangeLabel(run)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {run.status === 'QUEUED' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-label font-medium ${ss.bg} ${ss.text}`}
                            title={betaUsage ? `Concurrent limit: ${betaUsage.backtests.maxConcurrent} backtest at a time` : undefined}
                          >
                            <Clock className="size-3 shrink-0" aria-hidden="true" />
                            Queued
                          </span>
                        ) : (
                          <span className={`inline-flex px-2 py-1 rounded text-label font-medium ${ss.bg} ${ss.text}`}>
                            {run.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {run.status === 'RUNNING' ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-overlay rounded-full overflow-hidden">
                              <div className="h-full bg-accent rounded-full" style={{ width: `${run.progress}%` }} />
                            </div>
                            <span className="font-mono text-label text-accent-text">{run.progress}%</span>
                          </div>
                        ) : run.status === 'COMPLETED' ? (
                          <span className="font-mono text-label text-gain">100%</span>
                        ) : (
                          <span className="text-tertiary">\u2014</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pnlColor(run.totalPnl)}`}>
                        {pnlSign(run.totalPnl)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-secondary">
                        {winRatePct(run.winRate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-label text-tertiary">{formatShortDate(run.createdAt)}</span>
                      </td>
                      {compareMode && (
                        <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setCompareA(run.id === compareA ? null : run.id)}
                              className={`text-caption px-2 py-1 rounded border transition-colors ${compareA === run.id ? 'bg-info/20 border-info/40 text-info' : 'border-default text-tertiary hover:text-primary'}`}
                            >A</Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setCompareB(run.id === compareB ? null : run.id)}
                              className={`text-caption px-2 py-1 rounded border transition-colors ${compareB === run.id ? 'bg-variable-subtle border-variable/40 text-variable-text' : 'border-default text-tertiary hover:text-primary'}`}
                            >B</Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compare panel */}
      {compareMode && compareA && compareB && (
        <div className="mt-6 rounded-pf border border-accent/30 bg-surface p-4">
          <h3 className="text-body-md font-semibold text-primary mb-4">Comparison</h3>
          {(() => {
            const runA = runs.find((r: BacktestRun) => r.id === compareA);
            const runB = runs.find((r: BacktestRun) => r.id === compareB);
            if (!runA || !runB) return null;
            const pnlA = parseFloat(runA.totalPnl ?? '0');
            const pnlB = parseFloat(runB.totalPnl ?? '0');
            const winner = pnlA > pnlB ? 'A' : pnlA < pnlB ? 'B' : null;
            const metrics = [
              { label: 'Strategy', a: runA.strategyName ?? strategies.find(s => s.id === runA.strategyId)?.name ?? '-', b: runB.strategyName ?? strategies.find(s => s.id === runB.strategyId)?.name ?? '-', isNumeric: false },
              { label: 'Date Range', a: dateRangeLabel(runA), b: dateRangeLabel(runB), isNumeric: false },
              { label: 'P&L', a: pnlSign(runA.totalPnl), b: pnlSign(runB.totalPnl), isNumeric: true },
              { label: 'Win Rate', a: winRatePct(runA.winRate), b: winRatePct(runB.winRate), isNumeric: false },
              { label: 'Total Orders', a: runA.totalOrders?.toString() ?? '\u2014', b: runB.totalOrders?.toString() ?? '\u2014', isNumeric: false },
              { label: 'Filled Orders', a: runA.filledOrders?.toString() ?? '\u2014', b: runB.filledOrders?.toString() ?? '\u2014', isNumeric: false },
            ];
            return (
              <>
                {winner && (
                  <div className="mb-3 text-label text-secondary">
                    Run <span className={`font-semibold ${winner === 'A' ? 'text-info' : 'text-variable-text'}`}>{winner}</span> outperforms by <span className="font-mono text-gain">{Math.abs(pnlA - pnlB).toFixed(2)}</span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-label" aria-label="Backtest results">
                    <thead>
                      <tr className="border-b border-default">
                        <th className="text-left py-2 pr-4 font-medium text-tertiary">Metric</th>
                        <th className="text-center py-2 px-4 font-medium text-info">Run A</th>
                        <th className="text-center py-2 px-4 font-medium text-variable-text">Run B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map(m => (
                        <tr key={m.label} className="border-b border-subtle last:border-0">
                          <td className="py-2 pr-4 text-tertiary">{m.label}</td>
                          <td className={`py-2 px-4 text-center font-mono ${m.isNumeric && pnlA > pnlB ? 'text-gain font-semibold' : 'text-primary'}`}>{m.a}</td>
                          <td className={`py-2 px-4 text-center font-mono ${m.isNumeric && pnlB > pnlA ? 'text-gain font-semibold' : 'text-primary'}`}>{m.b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}

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
          <span className="text-body-sm font-mono text-secondary" aria-live="polite">Page {page} of {totalPages}</span>
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
