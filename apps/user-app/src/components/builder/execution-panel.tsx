import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Play, Square, Pause, RotateCcw, ChevronUp, ChevronDown,
  FlaskConical, Radio, Loader2, AlertTriangle, XCircle,
  TrendingUp, TrendingDown, BarChart3, Target, Clock,
  Activity, Search,
} from 'lucide-react';
import { wsManager, type WsMessage } from '../../lib/websocket';
import { useBuilderStore } from '../../stores/builder-store';
import { useExecutionStore } from '../../stores/execution-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

type BacktestStatus = 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface BacktestState {
  runId: string | null;
  status: BacktestStatus;
  progress: number;
  totalPnl: string | null;
  winRate: string | null;
  maxDrawdown: string | null;
  sharpeRatio: string | null;
  totalOrders: number | null;
  filledOrders: number | null;
  hasDataGaps: boolean;
  error: string | null;
  equityCurve: { tick: number; equity: number }[];
  trades: { time: string; side: string; price: string; amount: string; pnl: string }[];
}

type StrategyLiveStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'STOPPING' | 'ERROR';

interface LiveState {
  status: StrategyLiveStatus;
  mode: 'PAPER' | 'LIVE';
  positions: { tokenId: string; market: string; side: string; size: string; avgPrice: string; pnl: string }[];
  recentTrades: { time: string; side: string; market: string; price: string; amount: string; pnl: string }[];
  totalPnl: string;
  sessionPnl: string;
  ordersPlaced: number;
  ordersFilled: number;
  lastTick: number | null;
  error: string | null;
}

/* ─── Initial state ──────────────────────────────────────────────────── */

const INITIAL_BACKTEST: BacktestState = {
  runId: null, status: 'IDLE', progress: 0, totalPnl: null, winRate: null,
  maxDrawdown: null, sharpeRatio: null, totalOrders: null, filledOrders: null,
  hasDataGaps: false, error: null, equityCurve: [], trades: [],
};

const INITIAL_LIVE: LiveState = {
  status: 'IDLE', mode: 'PAPER', positions: [], recentTrades: [],
  totalPnl: '0', sessionPnl: '0', ordersPlaced: 0, ordersFilled: 0,
  lastTick: null, error: null,
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function pnlColor(val: string | null): string {
  if (!val) return 'text-pf-text-muted';
  return parseFloat(val) >= 0 ? 'text-pf-success' : 'text-pf-danger';
}

function pnlSign(val: string | null): string {
  if (!val) return '\u2014';
  const v = parseFloat(val);
  return v > 0 ? `+${val}` : val;
}

/* ─── Component ──────────────────────────────────────────────────────── */

interface ExecutionPanelProps {
  strategyId: string | null;
  expanded: boolean;
  onToggle: () => void;
  activeTab: 'backtest' | 'live';
  onTabChange: (tab: 'backtest' | 'live') => void;
}

export function ExecutionPanel({ strategyId, expanded, onToggle, activeTab, onTabChange }: ExecutionPanelProps) {
  // ─── Backtest state ────────────────────────────────────────────────
  const [bt, setBt] = useState<BacktestState>(INITIAL_BACKTEST);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Market bindings
  const [marketSlots, setMarketSlots] = useState<{ slot: string; label?: string }[]>([]);
  const [marketBindings, setMarketBindings] = useState<Record<string, string>>({});
  const [marketSearch, setMarketSearch] = useState<Record<string, string>>({});
  const [marketResults, setMarketResults] = useState<Record<string, any[]>>({});

  // ─── Live state ────────────────────────────────────────────────────
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);

  // ─── Sync execution state to global store (for block highlights) ───
  const setExecBtRunning = useExecutionStore((s) => s.setBacktestRunning);
  const setExecLiveRunning = useExecutionStore((s) => s.setLiveRunning);
  const fireBlock = useExecutionStore((s) => s.fireBlock);

  useEffect(() => {
    setExecBtRunning(bt.status === 'RUNNING' || bt.status === 'QUEUED');
  }, [bt.status, setExecBtRunning]);

  useEffect(() => {
    setExecLiveRunning(live.status === 'RUNNING' || live.status === 'PAUSED');
  }, [live.status, setExecLiveRunning]);

  // Clean up on unmount
  useEffect(() => () => { setExecBtRunning(false); setExecLiveRunning(false); }, [setExecBtRunning, setExecLiveRunning]);

  // ─── Backtest polling ref ──────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Scan strategy blocks for market slots ─────────────────────────
  const nodes = useBuilderStore((s) => s.nodes);

  useEffect(() => {
    const slots = new Set<string>();
    for (const node of nodes) {
      const cfg = (node.data as any)?.config;
      if (!cfg) continue;
      Object.values(cfg).forEach((v: any) => {
        if (typeof v === 'string' && v.startsWith('$MARKET_')) slots.add(v);
      });
    }
    if (slots.size === 0) slots.add('$MARKET_A');
    const sorted = Array.from(slots).sort().map(s => ({ slot: s, label: s.replace('$', '').replace(/_/g, ' ') }));
    setMarketSlots(sorted);
    const bindings: Record<string, string> = {};
    sorted.forEach(s => { bindings[s.slot] = marketBindings[s.slot] ?? ''; });
    setMarketBindings(bindings);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch strategy live status on mount/tab change ────────────────
  useEffect(() => {
    if (!strategyId || activeTab !== 'live') return;
    fetch(`/api/v1/strategies/${strategyId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const s = data.data ?? data;
        if (s.status === 'RUNNING') {
          setLive(prev => ({ ...prev, status: 'RUNNING', mode: s.execMode === 'PAPER' ? 'PAPER' : 'LIVE' }));
        } else if (s.status === 'PAUSED') {
          setLive(prev => ({ ...prev, status: 'PAUSED' }));
        }
      })
      .catch(() => {});
  }, [strategyId, activeTab]);

  // ─── WebSocket listener ────────────────────────────────────────────
  useEffect(() => {
    function handleMsg(msg: WsMessage) {
      // Backtest events
      if (msg.type === 'BACKTEST_PROGRESS') {
        const data = (msg.data ?? msg) as any;
        setBt(prev => {
          if (prev.runId && data.runId && data.runId !== prev.runId) return prev;
          return {
            ...prev,
            status: 'RUNNING',
            progress: parseFloat(data.progress ?? prev.progress),
          };
        });
        // Flash trigger blocks to visualise the strategy evaluating each tick
        nodes
          .filter((n) => n.type === 'blockNode' && (n.data as any).section === 'triggers')
          .forEach((n) => fireBlock(n.id));
      }
      if (msg.type === 'BACKTEST_COMPLETED') {
        const data = (msg.data ?? msg) as any;
        setBt(prev => {
          if (prev.runId && data.runId && data.runId !== prev.runId) return prev;
          return {
            ...prev,
            status: 'COMPLETED',
            progress: 100,
            totalPnl: data.totalPnl ?? prev.totalPnl,
            winRate: data.winRate ?? prev.winRate,
            maxDrawdown: data.maxDrawdown ?? prev.maxDrawdown,
            sharpeRatio: data.sharpeRatio ?? prev.sharpeRatio,
            totalOrders: data.totalOrders != null ? Number(data.totalOrders) : prev.totalOrders,
            filledOrders: data.filledOrders != null ? Number(data.filledOrders) : prev.filledOrders,
            hasDataGaps: !!data.hasDataGaps,
          };
        });
        toast.success('Backtest completed');
      }
      if (msg.type === 'BACKTEST_FAILED') {
        const data = (msg.data ?? msg) as any;
        setBt(prev => {
          if (prev.runId && data.runId && data.runId !== prev.runId) return prev;
          return { ...prev, status: 'FAILED', error: data.error ?? data.reason ?? 'Backtest failed' };
        });
        toast.error('Backtest failed');
      }

      // Strategy events
      if (msg.type === 'STRATEGY_STARTED') {
        const data = (msg.data ?? msg) as any;
        if (data.strategyId === strategyId) {
          setLive(prev => ({ ...prev, status: 'RUNNING', error: null }));
        }
      }
      if (msg.type === 'STRATEGY_STOPPED') {
        const data = (msg.data ?? msg) as any;
        if (data.strategyId === strategyId) {
          setLive(prev => ({ ...prev, status: 'IDLE' }));
        }
      }
      if (msg.type === 'STRATEGY_PAUSED') {
        const data = (msg.data ?? msg) as any;
        if (data.strategyId === strategyId) {
          setLive(prev => ({ ...prev, status: 'PAUSED' }));
        }
      }
      if (msg.type === 'STRATEGY_RESUMED') {
        const data = (msg.data ?? msg) as any;
        if (data.strategyId === strategyId) {
          setLive(prev => ({ ...prev, status: 'RUNNING', error: null }));
        }
      }
      if (msg.type === 'STRATEGY_ERROR') {
        const data = (msg.data ?? msg) as any;
        if (data.strategyId === strategyId) {
          setLive(prev => ({ ...prev, status: 'ERROR', error: data.reason ?? 'Strategy error' }));
        }
      }

      // Order events (for live trades)
      if (msg.type === 'ORDER_FILLED') {
        const data = (msg.data ?? msg) as any;
        setLive(prev => ({
          ...prev,
          ordersFilled: prev.ordersFilled + 1,
          recentTrades: [
            { time: new Date().toISOString(), side: data.side ?? '?', market: data.tokenId ?? '', price: data.price ?? '0', amount: data.amount ?? '0', pnl: data.pnl ?? '0' },
            ...prev.recentTrades,
          ].slice(0, 50),
          totalPnl: data.totalPnl ?? prev.totalPnl,
        }));
        // Flash action blocks when an order fills — confirms execution reached the action
        nodes
          .filter((n) => n.type === 'blockNode' && (n.data as any).section === 'actions')
          .forEach((n) => fireBlock(n.id));
      }
      if (msg.type === 'ORDER_PLACED') {
        setLive(prev => ({ ...prev, ordersPlaced: prev.ordersPlaced + 1 }));
        // Flash action blocks on placement too (shows action dispatched)
        nodes
          .filter((n) => n.type === 'blockNode' && (n.data as any).section === 'actions')
          .forEach((n) => fireBlock(n.id));
      }
    }

    wsManager.addListener(handleMsg);
    if (strategyId) {
      wsManager.subscribeStrategy(strategyId);
    }

    return () => {
      wsManager.removeListener(handleMsg);
      if (strategyId) {
        wsManager.unsubscribeStrategy(strategyId);
      }
    };
  }, [strategyId, nodes, fireBlock]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Poll backtest status (fallback for missed WS events) ──────────
  useEffect(() => {
    if (bt.status === 'QUEUED' || bt.status === 'RUNNING') {
      pollRef.current = setInterval(async () => {
        if (!bt.runId) return;
        try {
          const res = await fetch(`/api/v1/backtests/${bt.runId}`, { credentials: 'include' });
          if (!res.ok) return;
          const data = await res.json();
          const run = data.data ?? data;
          if (run.status === 'COMPLETED') {
            setBt(prev => ({
              ...prev,
              status: 'COMPLETED',
              progress: 100,
              totalPnl: run.totalPnl,
              winRate: run.winRate,
              maxDrawdown: run.maxDrawdown,
              sharpeRatio: run.sharpeRatio,
              totalOrders: run.totalOrders,
              filledOrders: run.filledOrders,
              hasDataGaps: !!run.hasDataGaps,
            }));
            toast.success('Backtest completed');
          } else if (run.status === 'FAILED') {
            setBt(prev => ({ ...prev, status: 'FAILED', error: run.error ?? 'Failed' }));
          } else {
            setBt(prev => ({ ...prev, progress: run.progress ?? prev.progress }));
          }
        } catch {}
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bt.status, bt.runId]);

  // ─── Market search ─────────────────────────────────────────────────
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

  // ─── Submit backtest ───────────────────────────────────────────────
  const submitBacktest = useCallback(async () => {
    if (!strategyId) { toast.error('Save the strategy first'); return; }
    if (!dateStart || !dateEnd) { toast.error('Select a date range'); return; }
    setSubmitting(true);
    setBt({ ...INITIAL_BACKTEST, status: 'QUEUED' });
    try {
      const res = await fetch('/api/v1/backtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          strategyId,
          dateRangeStart: new Date(dateStart).toISOString(),
          dateRangeEnd: new Date(dateEnd).toISOString(),
          marketBindings,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBt(prev => ({ ...prev, runId: data.runId ?? data.id }));
        toast.success('Backtest queued');
      } else {
        const err = await res.json().catch(() => ({}));
        setBt(prev => ({ ...prev, status: 'FAILED', error: err.message ?? 'Submit failed' }));
        toast.error(err.message ?? 'Failed to start backtest');
      }
    } catch {
      setBt(prev => ({ ...prev, status: 'FAILED', error: 'Network error' }));
      toast.error('Failed to start backtest');
    }
    setSubmitting(false);
  }, [strategyId, dateStart, dateEnd, marketBindings]);

  // ─── Live controls ─────────────────────────────────────────────────
  const startLive = useCallback(async (mode: 'PAPER' | 'LIVE') => {
    if (!strategyId) { toast.error('Save the strategy first'); return; }
    setLive(prev => ({ ...INITIAL_LIVE, status: 'STARTING', mode }));
    try {
      const res = await fetch(`/api/v1/strategies/${strategyId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode, marketBindings }),
      });
      if (res.ok) {
        setLive(prev => ({ ...prev, status: 'RUNNING' }));
        toast.success(`Strategy started (${mode.toLowerCase()} mode)`);
      } else {
        const err = await res.json().catch(() => ({}));
        setLive(prev => ({ ...prev, status: 'ERROR', error: err.message ?? 'Start failed' }));
        toast.error(err.message ?? 'Failed to start');
      }
    } catch {
      setLive(prev => ({ ...prev, status: 'ERROR', error: 'Network error' }));
    }
  }, [strategyId, marketBindings]);

  const stopLive = useCallback(async () => {
    if (!strategyId) return;
    setLive(prev => ({ ...prev, status: 'STOPPING' }));
    try {
      await fetch(`/api/v1/strategies/${strategyId}/stop`, { method: 'POST', credentials: 'include' });
      setLive(prev => ({ ...prev, status: 'IDLE' }));
      toast.success('Strategy stopped');
    } catch {
      toast.error('Failed to stop');
    }
  }, [strategyId]);

  const pauseLive = useCallback(async () => {
    if (!strategyId) return;
    try {
      await fetch(`/api/v1/strategies/${strategyId}/pause`, { method: 'POST', credentials: 'include' });
    } catch { toast.error('Failed to pause'); }
  }, [strategyId]);

  const resumeLive = useCallback(async () => {
    if (!strategyId) return;
    try {
      await fetch(`/api/v1/strategies/${strategyId}/resume`, { method: 'POST', credentials: 'include' });
    } catch { toast.error('Failed to resume'); }
  }, [strategyId]);

  // ─── Render ────────────────────────────────────────────────────────

  const isBacktestActive = bt.status === 'QUEUED' || bt.status === 'RUNNING';
  const isLiveActive = live.status === 'RUNNING' || live.status === 'PAUSED' || live.status === 'STARTING' || live.status === 'STOPPING';

  return (
    <div className="flex flex-col border-t border-pf-border bg-pf-elevated shrink-0">
      {/* ─── Header / toggle bar ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-pf-surface/50 transition-colors select-none"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('backtest'); if (!expanded) onToggle(); }}
              className={`px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors ${
                activeTab === 'backtest'
                  ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                  : 'text-pf-text-muted hover:text-pf-text-secondary'
              }`}
            >
              <FlaskConical className="size-3 inline mr-1" />
              Backtest
              {isBacktestActive && (
                <span className="ml-1.5 inline-flex size-1.5 rounded-full bg-pf-cyan-400 animate-pulse" />
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('live'); if (!expanded) onToggle(); }}
              className={`px-2.5 py-1 rounded-pf-sm text-xs font-medium transition-colors ${
                activeTab === 'live'
                  ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                  : 'text-pf-text-muted hover:text-pf-text-secondary'
              }`}
            >
              <Radio className="size-3 inline mr-1" />
              Live
              {isLiveActive && (
                <span className={`ml-1.5 inline-flex size-1.5 rounded-full animate-pulse ${
                  live.status === 'PAUSED' ? 'bg-pf-warning' : 'bg-pf-success'
                }`} />
              )}
            </button>
          </div>

          {/* Mini status in header */}
          {!expanded && bt.status === 'RUNNING' && (
            <span className="text-[11px] font-mono text-pf-cyan-400">
              Backtest {bt.progress}%
            </span>
          )}
          {!expanded && bt.status === 'COMPLETED' && (
            <span className={`text-[11px] font-mono ${pnlColor(bt.totalPnl)}`}>
              P&L: {pnlSign(bt.totalPnl)}
            </span>
          )}
          {!expanded && isLiveActive && (
            <span className={`text-[11px] font-mono ${live.status === 'RUNNING' ? 'text-pf-success' : 'text-pf-warning'}`}>
              {live.mode} {live.status}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown className="size-3.5 text-pf-text-muted" /> : <ChevronUp className="size-3.5 text-pf-text-muted" />}
      </div>

      {/* ─── Panel content ────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-3 overflow-y-auto" style={{ maxHeight: '320px' }}>
          {activeTab === 'backtest' ? (
            <BacktestTab
              bt={bt}
              dateStart={dateStart}
              dateEnd={dateEnd}
              setDateStart={setDateStart}
              setDateEnd={setDateEnd}
              marketSlots={marketSlots}
              marketBindings={marketBindings}
              setMarketBindings={setMarketBindings}
              marketSearch={marketSearch}
              setMarketSearch={setMarketSearch}
              marketResults={marketResults}
              setMarketResults={setMarketResults}
              searchMarkets={searchMarkets}
              submitting={submitting}
              onSubmit={submitBacktest}
              onReset={() => setBt(INITIAL_BACKTEST)}
              strategyId={strategyId}
            />
          ) : (
            <LiveTab
              live={live}
              strategyId={strategyId}
              onStart={startLive}
              onStop={stopLive}
              onPause={pauseLive}
              onResume={resumeLive}
              marketSlots={marketSlots}
              marketBindings={marketBindings}
              setMarketBindings={setMarketBindings}
              marketSearch={marketSearch}
              setMarketSearch={setMarketSearch}
              marketResults={marketResults}
              setMarketResults={setMarketResults}
              searchMarkets={searchMarkets}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Backtest Tab
   ═══════════════════════════════════════════════════════════════════════ */

function BacktestTab({
  bt, dateStart, dateEnd, setDateStart, setDateEnd,
  marketSlots, marketBindings, setMarketBindings,
  marketSearch, setMarketSearch, marketResults, setMarketResults, searchMarkets,
  submitting, onSubmit, onReset, strategyId,
}: {
  bt: BacktestState;
  dateStart: string; dateEnd: string;
  setDateStart: (v: string) => void; setDateEnd: (v: string) => void;
  marketSlots: { slot: string; label?: string }[];
  marketBindings: Record<string, string>;
  setMarketBindings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  marketSearch: Record<string, string>;
  setMarketSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  marketResults: Record<string, any[]>;
  setMarketResults: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  searchMarkets: (slot: string, query: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onReset: () => void;
  strategyId: string | null;
}) {
  if (bt.status === 'IDLE') {
    return (
      <div className="space-y-3 pt-1">
        {/* Form row */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] text-pf-text-secondary uppercase tracking-wider mb-1 block">Start Date</label>
            <input
              type="date"
              lang="en"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              aria-label="Start date"
              className="w-full h-8 px-2.5 rounded-pf-sm bg-pf-surface border border-pf-border text-xs text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] text-pf-text-secondary uppercase tracking-wider mb-1 block">End Date</label>
            <input
              type="date"
              lang="en"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              aria-label="End date"
              className="w-full h-8 px-2.5 rounded-pf-sm bg-pf-surface border border-pf-border text-xs text-pf-text focus:outline-none focus:border-pf-cyan-500/50"
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting || !strategyId || !dateStart || !dateEnd}
            className="h-8 px-4 rounded-pf-sm bg-pf-cyan-500 text-black text-xs font-medium hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shrink-0"
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
            Run Backtest
          </button>
        </div>

        {/* Market bindings */}
        {marketSlots.length > 0 && (
          <MarketBindingsSection
            marketSlots={marketSlots}
            marketBindings={marketBindings}
            setMarketBindings={setMarketBindings}
            marketSearch={marketSearch}
            setMarketSearch={setMarketSearch}
            marketResults={marketResults}
            setMarketResults={setMarketResults}
            searchMarkets={searchMarkets}
          />
        )}
      </div>
    );
  }

  if (bt.status === 'QUEUED' || bt.status === 'RUNNING') {
    return (
      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-pf-cyan-400" />
            <span className="text-xs text-pf-text-secondary">
              {bt.status === 'QUEUED' ? 'Waiting in queue...' : 'Running backtest...'}
            </span>
          </div>
          <span className="text-xs font-mono text-pf-cyan-400">{bt.progress}%</span>
        </div>
        <div className="h-2 bg-pf-surface rounded-full overflow-hidden" role="progressbar" aria-valuenow={bt.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Backtest progress">
          <div
            className="h-full bg-gradient-to-r from-pf-cyan-500 to-pf-cyan-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${bt.progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (bt.status === 'COMPLETED') {
    return (
      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-pf-success flex items-center gap-1.5">
            <BarChart3 className="size-3" /> Backtest Complete
          </span>
          <button
            onClick={onReset}
            className="text-[10px] text-pf-text-muted hover:text-pf-text-secondary flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="size-2.5" /> New Run
          </button>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          <MetricCard label="Total P&L" value={pnlSign(bt.totalPnl)} color={pnlColor(bt.totalPnl)} icon={<TrendingUp className="size-3" />} />
          <MetricCard
            label="Win Rate"
            value={bt.winRate ? `${(parseFloat(bt.winRate) * 100).toFixed(1)}%` : '\u2014'}
            color="text-pf-text"
            icon={<Target className="size-3" />}
          />
          <MetricCard
            label="Max Drawdown"
            value={bt.maxDrawdown ? pnlSign(bt.maxDrawdown) : '\u2014'}
            color="text-pf-danger"
            icon={<TrendingDown className="size-3" />}
          />
          <MetricCard
            label="Sharpe"
            value={bt.sharpeRatio ? parseFloat(bt.sharpeRatio).toFixed(2) : '\u2014'}
            color="text-pf-text"
            icon={<Activity className="size-3" />}
          />
          <MetricCard
            label="Orders"
            value={bt.totalOrders != null ? String(bt.totalOrders) : '\u2014'}
            color="text-pf-text"
            icon={<BarChart3 className="size-3" />}
          />
          <MetricCard
            label="Filled"
            value={bt.filledOrders != null ? String(bt.filledOrders) : '\u2014'}
            color="text-pf-text"
            icon={<BarChart3 className="size-3" />}
          />
        </div>

        {bt.hasDataGaps && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-pf-sm bg-pf-warning/10 text-pf-warning text-[11px]">
            <AlertTriangle className="size-3 shrink-0" />
            Results may be affected by data gaps in the selected date range.
          </div>
        )}
      </div>
    );
  }

  // FAILED
  return (
    <div className="pt-2 space-y-3">
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-pf-sm bg-pf-danger/10 text-pf-danger text-xs">
        <XCircle className="size-3.5 shrink-0" />
        {bt.error ?? 'Backtest failed'}
      </div>
      <button
        onClick={onReset}
        className="text-[10px] text-pf-text-muted hover:text-pf-text-secondary flex items-center gap-1 transition-colors"
      >
        <RotateCcw className="size-2.5" /> Try Again
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Live Tab
   ═══════════════════════════════════════════════════════════════════════ */

function LiveTab({
  live, strategyId, onStart, onStop, onPause, onResume,
  marketSlots, marketBindings, setMarketBindings,
  marketSearch, setMarketSearch, marketResults, setMarketResults, searchMarkets,
}: {
  live: LiveState;
  strategyId: string | null;
  onStart: (mode: 'PAPER' | 'LIVE') => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  marketSlots: { slot: string; label?: string }[];
  marketBindings: Record<string, string>;
  setMarketBindings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  marketSearch: Record<string, string>;
  setMarketSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  marketResults: Record<string, any[]>;
  setMarketResults: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  searchMarkets: (slot: string, query: string) => void;
}) {
  if (live.status === 'IDLE') {
    return (
      <div className="space-y-3 pt-1">
        {/* Market bindings */}
        {marketSlots.length > 0 && (
          <MarketBindingsSection
            marketSlots={marketSlots}
            marketBindings={marketBindings}
            setMarketBindings={setMarketBindings}
            marketSearch={marketSearch}
            setMarketSearch={setMarketSearch}
            marketResults={marketResults}
            setMarketResults={setMarketResults}
            searchMarkets={searchMarkets}
          />
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => onStart('PAPER')}
            disabled={!strategyId}
            className="flex-1 h-8 rounded-pf-sm bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text hover:border-pf-cyan-500/50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Play className="size-3" />
            Paper Trade
          </button>
          <button
            onClick={() => onStart('LIVE')}
            disabled={!strategyId}
            className="flex-1 h-8 rounded-pf-sm bg-pf-success/10 border border-pf-success/30 text-xs font-medium text-pf-success hover:bg-pf-success/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Play className="size-3" />
            Live Trade
          </button>
        </div>

        <p className="text-[10px] text-pf-text-muted leading-relaxed">
          Paper mode simulates trades without real funds. Live mode places real orders on Polymarket.
        </p>
      </div>
    );
  }

  if (live.status === 'STARTING' || live.status === 'STOPPING') {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <Loader2 className="size-4 animate-spin text-pf-cyan-400" />
        <span className="text-xs text-pf-text-secondary">
          {live.status === 'STARTING' ? 'Starting strategy...' : 'Stopping strategy...'}
        </span>
      </div>
    );
  }

  // RUNNING / PAUSED / ERROR
  return (
    <div className="space-y-3 pt-1">
      {/* Status bar + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex size-2 rounded-full ${
            live.status === 'RUNNING' ? 'bg-pf-success animate-pulse' :
            live.status === 'PAUSED' ? 'bg-pf-warning' : 'bg-pf-danger'
          }`} />
          <span className="text-xs font-medium text-pf-text">
            {live.mode === 'PAPER' ? 'Paper' : 'Live'} — {live.status}
          </span>
          {live.lastTick && (
            <span className="text-[10px] text-pf-text-muted flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {new Date(live.lastTick).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {live.status === 'RUNNING' && (
            <button
              onClick={onPause}
              className="p-1.5 rounded-pf-sm text-pf-text-muted hover:text-pf-warning hover:bg-pf-warning/10 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
              title="Pause"
              aria-label="Pause execution"
            >
              <Pause className="size-3" />
            </button>
          )}
          {live.status === 'PAUSED' && (
            <button
              onClick={onResume}
              className="p-1.5 rounded-pf-sm text-pf-text-muted hover:text-pf-success hover:bg-pf-success/10 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
              title="Resume"
              aria-label="Resume execution"
            >
              <Play className="size-3" />
            </button>
          )}
          <button
            onClick={onStop}
            className="p-1.5 rounded-pf-sm text-pf-text-muted hover:text-pf-danger hover:bg-pf-danger/10 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40"
            title="Stop"
            aria-label="Stop execution"
          >
            <Square className="size-3" />
          </button>
        </div>
      </div>

      {live.error && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-pf-sm bg-pf-danger/10 text-pf-danger text-[11px]">
          <XCircle className="size-3 shrink-0" />
          {live.error}
        </div>
      )}

      {/* Live metrics */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Session P&L" value={pnlSign(live.sessionPnl)} color={pnlColor(live.sessionPnl)} icon={<TrendingUp className="size-3" />} />
        <MetricCard label="Total P&L" value={pnlSign(live.totalPnl)} color={pnlColor(live.totalPnl)} icon={<BarChart3 className="size-3" />} />
        <MetricCard label="Placed" value={String(live.ordersPlaced)} color="text-pf-text" icon={<Target className="size-3" />} />
        <MetricCard label="Filled" value={String(live.ordersFilled)} color="text-pf-text" icon={<Activity className="size-3" />} />
      </div>

      {/* Recent trades */}
      {live.recentTrades.length > 0 && (
        <div>
          <span className="text-[10px] text-pf-text-secondary uppercase tracking-wider mb-1.5 block">Recent Trades</span>
          <div className="bg-pf-surface rounded-pf-sm overflow-hidden max-h-[120px] overflow-y-auto">
            <table className="w-full text-[11px]" aria-label="Trade history">
              <thead>
                <tr className="text-pf-text-muted text-left">
                  <th className="px-2 py-1 font-medium">Time</th>
                  <th className="px-2 py-1 font-medium">Side</th>
                  <th className="px-2 py-1 font-medium text-right">Price</th>
                  <th className="px-2 py-1 font-medium text-right">Amount</th>
                  <th className="px-2 py-1 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border-subtle">
                {live.recentTrades.slice(0, 10).map((t, i) => (
                  <tr key={i} className="text-pf-text">
                    <td className="px-2 py-1 font-mono text-pf-text-muted">
                      {new Date(t.time).toLocaleTimeString()}
                    </td>
                    <td className={`px-2 py-1 font-medium ${t.side === 'BUY' ? 'text-pf-success' : 'text-pf-danger'}`}>
                      {t.side}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{t.price}</td>
                    <td className="px-2 py-1 text-right font-mono">{t.amount}</td>
                    <td className={`px-2 py-1 text-right font-mono ${pnlColor(t.pnl)}`}>{pnlSign(t.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════════════════════════════ */

function MetricCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-pf-surface rounded-pf-sm p-2">
      <span className="text-[10px] text-pf-text-muted flex items-center gap-1">{icon}{label}</span>
      <span className={`text-sm font-mono font-semibold ${color} block mt-0.5`}>{value}</span>
    </div>
  );
}

function MarketBindingsSection({
  marketSlots, marketBindings, setMarketBindings,
  marketSearch, setMarketSearch, marketResults, setMarketResults, searchMarkets,
}: {
  marketSlots: { slot: string; label?: string }[];
  marketBindings: Record<string, string>;
  setMarketBindings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  marketSearch: Record<string, string>;
  setMarketSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  marketResults: Record<string, any[]>;
  setMarketResults: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  searchMarkets: (slot: string, query: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-pf-text-secondary uppercase tracking-wider flex items-center gap-1">
        <Search className="size-2.5" /> Market Bindings
      </label>
      <div className="flex flex-wrap gap-2">
        {marketSlots.map(slot => (
          <div key={slot.slot} className="flex-1 min-w-[200px] relative">
            <label className="text-[10px] text-pf-text-muted mb-0.5 block">{slot.label || slot.slot}</label>
            <input
              type="text"
              value={marketSearch[slot.slot] ?? ''}
              onChange={e => {
                setMarketSearch(prev => ({ ...prev, [slot.slot]: e.target.value }));
                searchMarkets(slot.slot, e.target.value);
              }}
              placeholder="Search markets..."
              className="w-full h-7 px-2 rounded-pf-sm bg-pf-surface border border-pf-border text-[11px] text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
            />
            {marketBindings[slot.slot] && (
              <span className="absolute right-2 top-[22px] text-[9px] text-pf-cyan-400 font-mono">bound</span>
            )}
            {(marketResults[slot.slot] ?? []).length > 0 && (
              <div className="absolute z-50 w-full mt-0.5 bg-pf-elevated border border-pf-border rounded-pf-sm max-h-32 overflow-y-auto shadow-pf-lg">
                {marketResults[slot.slot].map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMarketBindings(prev => ({ ...prev, [slot.slot]: m.id }));
                      setMarketSearch(prev => ({ ...prev, [slot.slot]: m.title ?? m.question }));
                      setMarketResults(prev => ({ ...prev, [slot.slot]: [] }));
                    }}
                    className="w-full text-left px-2 py-1.5 text-[11px] text-pf-text hover:bg-pf-surface transition-colors border-b border-pf-border-subtle last:border-b-0"
                  >
                    {m.title ?? m.question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
