import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ReactFlowProvider } from '@xyflow/react';
import { ArrowLeft, Check, Loader2, Pencil, Blocks, Upload, Zap, FlaskConical } from 'lucide-react';
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

  const name = useBuilderStore((s) => s.name);
  const setName = useBuilderStore((s) => s.setName);
  const saving = useBuilderStore((s) => s.saving);
  const loading = useBuilderStore((s) => s.loading);
  const strategyId = useBuilderStore((s) => s.strategyId);
  const loadStrategy = useBuilderStore((s) => s.loadStrategy);
  const save = useBuilderStore((s) => s.save);
  const reset = useBuilderStore((s) => s.reset);

  const [quickTesting, setQuickTesting] = useState(false);
  const [quickResult, setQuickResult] = useState<Record<string, unknown> | null>(null);

  const isEdit = !!id;

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
              <BuilderTutorial />
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
