import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ReactFlowProvider } from '@xyflow/react';
import { ArrowLeft, Check, Loader2, Pencil, Blocks, Upload, Zap, FlaskConical, HelpCircle, Target, RotateCcw, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

import { StrategyCanvas } from '../../components/builder/strategy-canvas';
import { BlockPalette } from '../../components/builder/block-palette';
import { BuilderTutorial } from '../../components/builder/builder-tutorial';
import { ExecutionPanel } from '../../components/builder/execution-panel';
import { useBuilderStore } from '../../stores/builder-store';

// ─── Component ───────────────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [panelOpen, setPanelOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Execution panel state
  const [execPanelExpanded, setExecPanelExpanded] = useState(false);
  const [execTab, setExecTab] = useState<'backtest' | 'live'>('backtest');
  const [showTutorial, setShowTutorial] = useState(false);

  const name = useBuilderStore((s) => s.name);
  const setName = useBuilderStore((s) => s.setName);
  const saving = useBuilderStore((s) => s.saving);
  const loading = useBuilderStore((s) => s.loading);
  const strategyId = useBuilderStore((s) => s.strategyId);
  const loadStrategy = useBuilderStore((s) => s.loadStrategy);
  const save = useBuilderStore((s) => s.save);
  const reset = useBuilderStore((s) => s.reset);

  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const historyLength = useBuilderStore((s) => s._history.length);
  const futureLength = useBuilderStore((s) => s._future.length);

  const marketId = useBuilderStore((s) => s.marketId);
  const setMarketId = useBuilderStore((s) => s.setMarketId);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketResults, setMarketResults] = useState<Array<{id: string; title: string; category: string}>>([]);
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [pinnedMarket, setPinnedMarket] = useState<{id: string; title: string} | null>(null);

  const [quickTesting, setQuickTesting] = useState(false);
  const [quickResult, setQuickResult] = useState<Record<string, unknown> | null>(null);

  const isEdit = !!id;
  const isNewStrategy = !isEdit;

  const [wizardStep, setWizardStep] = useState<'template' | 'builder'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const TEMPLATES = [
    {
      id: 'momentum',
      name: 'Simple Momentum',
      description: 'Buys YES when price crosses above a threshold. Best for trending markets.',
      icon: '📈',
      trigger: 'Event',
      difficulty: 'Beginner',
    },
    {
      id: 'mean-reversion',
      name: 'Mean Reversion',
      description: 'Buys when price dips below the recent average. Profits from temporary overselling.',
      icon: '↩️',
      trigger: 'Tick',
      difficulty: 'Beginner',
    },
    {
      id: 'news-reactive',
      name: 'News Reactive',
      description: 'Trades on AI-detected high-confidence news signals.',
      icon: '📰',
      trigger: 'Event',
      difficulty: 'Intermediate',
    },
    {
      id: 'whale-follower',
      name: 'Whale Follower',
      description: 'Copies whale trades with configurable size and risk filters.',
      icon: '🐋',
      trigger: 'Event',
      difficulty: 'Intermediate',
    },
    {
      id: 'blank',
      name: 'Start from Scratch',
      description: 'Open the strategy builder with a blank canvas.',
      icon: '⬜',
      trigger: null,
      difficulty: 'Advanced',
    },
  ] as const;

  // Count canvas issues: unwired trigger/action blocks + active blocks with empty required fields.
  const canvasIssues = useBuilderStore((s) => {
    const connectedIds = new Set<string>([
      ...s.edges.map((e) => e.source),
      ...s.edges.map((e) => e.target),
    ]);
    let orphaned = 0;
    let misconfigured = 0;
    for (const n of s.nodes) {
      if (n.type !== 'blockNode') continue;
      const nd = n.data as import('../../stores/builder-store').BlockNodeData;
      const isOrphaned = (nd.section === 'triggers' || nd.section === 'actions') && !connectedIds.has(n.id);
      if (isOrphaned) { orphaned++; continue; }
      // For active (non-orphaned) blocks, check for empty required fields
      const hasEmpty = nd.fields.some((f) => !(nd.config[f.key] ?? ''));
      if (hasEmpty) misconfigured++;
    }
    return { orphaned, misconfigured };
  });

  // Load or reset on mount
  useEffect(() => {
    if (id) {
      loadStrategy(id).catch(() => {
        toast.error('Failed to load strategy');
        navigate('/strategies');
      });
    } else {
      reset();
    }

    // Cleanup on unmount
    return () => {
      reset();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn on unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useBuilderStore.getState().dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!marketSearch.trim() || marketSearch.length < 2) { setMarketResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/v1/markets?search=${encodeURIComponent(marketSearch)}&limit=8`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setMarketResults(d?.data ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [marketSearch]);

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!marketId) { setPinnedMarket(null); return; }
    fetch(`/api/v1/markets/${marketId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPinnedMarket({ id: d.id, title: d.title }); })
      .catch(() => {});
  }, [marketId]);

  const onSave = useCallback(async () => {
    try {
      const result = await save();
      toast.success(isEdit ? 'Strategy saved' : 'Strategy created');
      const savedId = (result as Record<string, unknown>)?.id ?? strategyId;
      if (savedId) {
        navigate(`/strategies/${savedId}`);
      } else {
        navigate('/strategies');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      if (message === 'SESSION_EXPIRED') {
        toast.error('Session expired — your work is preserved', {
          description: 'Log in again to save your strategy.',
          duration: Infinity,
          action: { label: 'Log in', onClick: () => { window.location.href = '/login'; } },
        });
      } else {
        toast.error(message, { duration: 6000 });
      }
    }
  }, [save, isEdit, strategyId, navigate]);

  const onQuickTest = useCallback(async () => {
    if (!strategyId) {
      toast.error('Save the strategy first to run a quick test');
      return;
    }
    setQuickTesting(true);
    setQuickResult(null);
    try {
      const res = await fetch('/api/v1/backtests/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategyId, quickMode: true }),
      });
      if (res.ok) {
        const result = await res.json();
        setQuickResult(result);
        toast.success('Quick test complete');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Quick test failed');
      }
    } catch {
      toast.error('Quick test failed');
    }
    setQuickTesting(false);
  }, [strategyId]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.polyforge') && !file.name.endsWith('.json')) {
      toast.error('Please drop a .polyforge or .json file');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.strategy?.name) {
        toast.error('Invalid strategy file format');
        return;
      }

      const userAccepted = await new Promise<boolean>((resolve) => {
        const msg = `Load strategy "${data.strategy.name}"? This will replace the current blocks.`;
        // Use toast with action for non-blocking confirm
        toast(msg, {
          action: { label: 'Load', onClick: () => resolve(true) },
          cancel: { label: 'Cancel', onClick: () => resolve(false) },
          onDismiss: () => resolve(false),
          duration: 15000,
        });
      });
      if (!userAccepted) return;

      const res = await fetch('/api/v1/strategies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Failed to import strategy');
        return;
      }

      const created = await res.json();
      toast.success('Strategy imported successfully');
      navigate(`/strategies/${created.id}/edit`);
    } catch {
      toast.error('Invalid strategy file');
    }
  }, [navigate]);

  // ─── Template wizard (new strategy only) ─────────────────────────────

  if (wizardStep === 'template' && isNewStrategy) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-xl font-bold text-pf-text mb-1">New Strategy</h1>
        <p className="text-sm text-pf-text-secondary mb-6">Choose a starting point</p>
        <div className="grid grid-cols-1 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={async () => {
                if (t.id !== 'blank') {
                  // Load from template
                  const r = await fetch(`/api/v1/strategies/templates`, { credentials: 'include' });
                  // Find matching template and pre-fill
                }
                setSelectedTemplate(t.id);
                setWizardStep('builder');
              }}
              className="flex items-center gap-4 p-4 rounded-pf border border-pf-border bg-pf-surface hover:border-pf-cyan-500/50 hover:bg-pf-surface-hover transition-all text-left group"
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-pf-text group-hover:text-pf-cyan-400 transition-colors">{t.name}</span>
                  {t.trigger && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-pf-surface-elevated border border-pf-border text-pf-text-muted">{t.trigger}</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    t.difficulty === 'Beginner' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                    t.difficulty === 'Intermediate' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                    'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>{t.difficulty}</span>
                </div>
                <p className="text-xs text-pf-text-muted mt-0.5">{t.description}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pf-text-muted group-hover:text-pf-cyan-400 flex-shrink-0 transition-colors"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-pf-text-muted">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Loading strategy...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-pf-border-subtle bg-pf-elevated/50 shrink-0">
        <Link
          to="/strategies"
          className="flex items-center gap-1.5 text-xs text-pf-text-secondary hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm transition-colors"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Strategies
        </Link>

        <div className="w-px h-4 bg-pf-border-subtle" />

        {editingName ? (
          <input
            aria-label="Strategy name"
            className="text-lg font-semibold bg-transparent border-b border-pf-cyan-500 outline-none text-pf-text px-1 flex-1 min-w-0"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="text-lg font-semibold cursor-pointer hover:text-pf-cyan-400 transition-colors group flex items-center gap-2 truncate flex-1 text-left text-pf-text bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm"
            onClick={() => setEditingName(true)}
            aria-label={`Edit strategy name: ${name || 'Untitled Strategy'}`}
          >
            <h1 className="text-lg font-semibold truncate">{name || 'Untitled Strategy'}</h1>
            <Pencil size={14} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {/* Panel toggle */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={`p-1.5 rounded-pf-sm transition-colors ${
              panelOpen
                ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                : 'text-pf-text-muted hover:text-pf-text-secondary hover:bg-pf-overlay'
            }`}
            aria-label={panelOpen ? 'Hide blocks panel' : 'Show blocks panel'}
            title={panelOpen ? 'Hide blocks' : 'Show blocks'}
          >
            <Blocks className="size-4" />
          </button>

          {/* Execution panel toggle */}
          <button
            type="button"
            onClick={() => { setExecPanelExpanded((v) => !v); }}
            className={`p-1.5 rounded-pf-sm transition-colors ${
              execPanelExpanded
                ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                : 'text-pf-text-muted hover:text-pf-text-secondary hover:bg-pf-overlay'
            }`}
            aria-label={execPanelExpanded ? 'Collapse execution panel' : 'Expand execution panel'}
            title={execPanelExpanded ? 'Collapse execution panel' : 'Backtest & Live'}
          >
            <FlaskConical className="size-4" />
          </button>

          {/* Tutorial help */}
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="p-1.5 rounded-pf-sm text-pf-text-muted hover:text-pf-text-secondary hover:bg-pf-overlay transition-colors"
            aria-label="Show builder tutorial"
            title="How the builder works"
          >
            <HelpCircle className="size-4" />
          </button>

          <div className="w-px h-4 bg-pf-border-subtle" />

          {/* Undo */}
          <button
            type="button"
            onClick={undo}
            disabled={historyLength === 0}
            className="p-1.5 rounded text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={`Undo (${historyLength} step${historyLength !== 1 ? 's' : ''})`}
            title={`Undo (Ctrl+Z) — ${historyLength} step${historyLength !== 1 ? 's' : ''}`}
          >
            <RotateCcw className="size-3.5" />
          </button>

          {/* Redo */}
          <button
            type="button"
            onClick={redo}
            disabled={futureLength === 0}
            className="p-1.5 rounded text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={`Redo (${futureLength} step${futureLength !== 1 ? 's' : ''})`}
            title={`Redo (Ctrl+Y) — ${futureLength} step${futureLength !== 1 ? 's' : ''}`}
          >
            <RotateCw className="size-3.5" />
          </button>

          <div className="w-px h-4 bg-pf-border-subtle" />

          <button
            type="button"
            onClick={onQuickTest}
            disabled={quickTesting || !strategyId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm bg-pf-elevated border border-pf-border text-xs font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 transition-colors"
            title="Run a 7-day quick backtest"
          >
            {quickTesting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Zap className="size-3" />
            )}
            Quick Test
          </button>

          <Link
            to="/strategies"
            className="px-3 py-1.5 text-xs text-pf-text-secondary hover:text-pf-text rounded-pf-sm hover:bg-pf-overlay transition-colors"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm bg-pf-cyan-500 text-black text-xs font-medium hover:bg-pf-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            {isEdit ? 'Save Changes' : 'Create Strategy'}
          </button>
        </div>
      </div>

      {/* ─── Canvas + Panel ─────────────────────────────────────────────── */}
      <ReactFlowProvider>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Canvas */}
            <div
              className="flex-1 relative min-w-0 isolate"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Canvas issue banner — unwired blocks and/or misconfigured fields */}
              {(canvasIssues.orphaned > 0 || canvasIssues.misconfigured > 0) && (
                <div
                  className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none border ${
                    canvasIssues.misconfigured > 0
                      ? 'bg-pf-danger/10 border-pf-danger/25 text-pf-danger'
                      : 'bg-pf-warning/10 border-pf-warning/25 text-pf-warning'
                  }`}
                  role="status"
                >
                  {canvasIssues.orphaned > 0 && (
                    <span>
                      {canvasIssues.orphaned} block{canvasIssues.orphaned !== 1 ? 's' : ''} not wired
                    </span>
                  )}
                  {canvasIssues.orphaned > 0 && canvasIssues.misconfigured > 0 && (
                    <span className="opacity-40">·</span>
                  )}
                  {canvasIssues.misconfigured > 0 && (
                    <span>
                      {canvasIssues.misconfigured} block{canvasIssues.misconfigured !== 1 ? 's' : ''} need{canvasIssues.misconfigured === 1 ? 's' : ''} setup
                    </span>
                  )}
                </div>
              )}
              <StrategyCanvas />
              <BuilderTutorial forceVisible={showTutorial} onDismiss={() => setShowTutorial(false)} />
              {dragOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-pf-surface/80 backdrop-blur-sm border-2 border-dashed border-pf-cyan-500 rounded-pf-lg pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-pf-cyan-400">
                    <Upload className="size-8" />
                    <span className="text-sm font-medium">Drop .polyforge file to import</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick test results overlay */}
            {quickResult && (
              <div className="absolute bottom-4 left-4 z-40 bg-pf-elevated border border-pf-border rounded-pf-lg p-4 shadow-pf-lg max-w-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-pf-text uppercase tracking-wider">Quick Test Results</span>
                  <button type="button" onClick={() => setQuickResult(null)} className="text-pf-text-muted hover:text-pf-text text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 rounded-pf-sm" aria-label="Close quick test results">&times;</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-pf-surface rounded-pf p-2">
                    <span className="text-pf-text-secondary block">P&L</span>
                    <span className={`font-mono font-semibold ${parseFloat(String(quickResult.totalPnl ?? '0')) >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                      {parseFloat(String(quickResult.totalPnl ?? '0')) >= 0 ? '+' : ''}{String(quickResult.totalPnl)}
                    </span>
                  </div>
                  <div className="bg-pf-surface rounded-pf p-2">
                    <span className="text-pf-text-secondary block">Win Rate</span>
                    <span className="font-mono font-semibold text-pf-text">{String(quickResult.winRate)}%</span>
                  </div>
                  <div className="bg-pf-surface rounded-pf p-2">
                    <span className="text-pf-text-secondary block">Orders</span>
                    <span className="font-mono font-semibold text-pf-text">{String(quickResult.totalOrders)}</span>
                  </div>
                  <div className="bg-pf-surface rounded-pf p-2">
                    <span className="text-pf-text-secondary block">Filled</span>
                    <span className="font-mono font-semibold text-pf-text">{String(quickResult.filledOrders)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Side panel — always mounted, collapsed via width to prevent React Flow reflow issues */}
            <div className={`transition-all duration-200 overflow-hidden ${panelOpen ? 'w-80' : 'w-0'}`}>
              <BlockPalette open={panelOpen} onClose={() => setPanelOpen(false)} />
              {/* Market Picker */}
              <div className="border-t border-pf-border mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMarketPickerOpen(p => !p)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-pf-text-secondary hover:text-pf-text transition-colors"
                >
                  <Target className="size-3.5 text-pf-cyan-400" aria-hidden="true" />
                  Pinned Market
                  {pinnedMarket && <span className="ml-auto text-[10px] bg-pf-cyan-500/15 text-pf-cyan-400 px-1.5 py-0.5 rounded-full truncate max-w-[90px]">{pinnedMarket.title.slice(0, 20)}{pinnedMarket.title.length > 20 ? '…' : ''}</span>}
                </button>
                {marketPickerOpen && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {pinnedMarket ? (
                      <div className="flex items-center gap-1.5 bg-pf-elevated border border-pf-cyan-500/25 rounded-pf p-2">
                        <span className="text-[11px] text-pf-text flex-1 truncate">{pinnedMarket.title}</span>
                        <button
                          type="button"
                          onClick={() => { setMarketId(''); setPinnedMarket(null); }}
                          className="text-pf-text-muted hover:text-pf-danger transition-colors"
                          title="Unpin market"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Search markets…"
                          value={marketSearch}
                          onChange={e => setMarketSearch(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-pf bg-pf-elevated border border-pf-border text-pf-text placeholder:text-pf-text-muted focus:border-pf-cyan-500/50 focus:outline-none"
                        />
                        {marketResults.length > 0 && (
                          <div className="max-h-40 overflow-y-auto space-y-0.5">
                            {marketResults.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setMarketId(m.id); setPinnedMarket({ id: m.id, title: m.title }); setMarketSearch(''); setMarketResults([]); }}
                                className="w-full text-left px-2 py-1.5 text-[11px] rounded-pf hover:bg-pf-overlay text-pf-text transition-colors truncate"
                              >
                                {m.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Execution Panel (bottom) ─────────────────────────────────── */}
          <ExecutionPanel
            strategyId={strategyId}
            expanded={execPanelExpanded}
            onToggle={() => setExecPanelExpanded((v) => !v)}
            activeTab={execTab}
            onTabChange={setExecTab}
          />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
