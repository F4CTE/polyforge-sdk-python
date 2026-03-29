import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Globe, Unlink, Shield, Zap, Filter, Play } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'polyforge:builder-tutorial:seen';

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TutorialStep {
  title: string;
  content: React.ReactNode;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Building Strategies',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Strategies are built by connecting <strong className="text-pf-text">blocks</strong> — each representing a piece of trading logic. Blocks are wired together to define execution flow.
        </p>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Drag blocks from the palette onto the canvas, then connect them by dragging from the <span className="inline-block size-1.5 rounded-full bg-pf-cyan-400 mr-1.5" aria-hidden="true" /> handles on each block.
        </p>
      </div>
    ),
  },
  {
    title: 'Safety Blocks — Always Active',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-pf-md" style={{ backgroundColor: '#ef444422', border: '1px solid #ef444444' }}>
          <Shield className="size-4 shrink-0" style={{ color: '#ef4444' }} />
          <span className="text-sm font-medium" style={{ color: '#ef4444' }}>Safety</span>
        </div>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Safety blocks are <strong className="text-pf-text">always enforced globally</strong> — they protect every execution path, every tick. They have no connection handles because they can't be scoped.
        </p>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Examples: <em>Daily Loss Limit</em>, <em>Max Open Positions</em>. Add them and they're active — no wiring needed.
        </p>
      </div>
    ),
  },
  {
    title: 'Trigger Blocks — Must Be Wired',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-pf-md" style={{ backgroundColor: '#f59e0b22', border: '1px solid #f59e0b44' }}>
          <Zap className="size-4 shrink-0" style={{ color: '#f59e0b' }} />
          <span className="text-sm font-medium" style={{ color: '#f59e0b' }}>Trigger</span>
        </div>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Triggers detect when something happens (e.g. price crosses a threshold). They only fire if they have an <strong className="text-pf-text">outgoing connection</strong> — the wire tells the engine where to route execution.
        </p>
        <div className="flex items-center gap-2 p-2 rounded-pf text-xs" style={{ backgroundColor: '#f59e0b11' }}>
          <Unlink className="size-3 shrink-0" style={{ color: '#f59e0b' }} />
          <span style={{ color: '#f59e0b' }}>Unwired triggers show a "Not wired" badge and are dimmed — they won't execute.</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Condition Blocks — Global or Scoped',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-pf-md" style={{ backgroundColor: '#06b6d422', border: '1px solid #06b6d444' }}>
          <Filter className="size-4 shrink-0" style={{ color: '#06b6d4' }} />
          <span className="text-sm font-medium" style={{ color: '#06b6d4' }}>Condition</span>
        </div>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Conditions are gates — they let execution through only when their rule passes.
        </p>
        <ul className="space-y-2 text-sm text-pf-text-secondary">
          <li className="flex items-start gap-2">
            <Globe className="size-3 mt-0.5 shrink-0" style={{ color: '#06b6d4' }} />
            <span><strong className="text-pf-text">Unwired:</strong> acts as a <em>global gate</em> — all execution paths must pass it.</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="size-3 mt-0.5 shrink-0 text-pf-text-muted" />
            <span><strong className="text-pf-text">Wired:</strong> only gates the specific trigger → action path it's connected to.</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Action Blocks — Must Be Wired',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-pf-md" style={{ backgroundColor: '#22c55e22', border: '1px solid #22c55e44' }}>
          <Play className="size-4 shrink-0" style={{ color: '#22c55e' }} />
          <span className="text-sm font-medium" style={{ color: '#22c55e' }}>Action</span>
        </div>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Actions execute trades — buy, sell, close positions, run sub-strategies. They only execute if they have an <strong className="text-pf-text">incoming connection</strong> from a trigger or condition.
        </p>
        <div className="flex items-center gap-2 p-2 rounded-pf text-xs" style={{ backgroundColor: '#f59e0b11' }}>
          <Unlink className="size-3 shrink-0" style={{ color: '#f59e0b' }} />
          <span style={{ color: '#f59e0b' }}>Unwired actions are dimmed and won't execute — they need upstream context.</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Market Slots',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Many blocks have a <strong className="text-pf-text">Market Slot</strong> field (<code className="text-pf-purple-500 font-mono text-xs">$MARKET_A</code> … <code className="text-pf-purple-500 font-mono text-xs">$MARKET_E</code>). These are placeholders — you bind them to real markets when you start the strategy.
        </p>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          This lets a single strategy template trade across different markets without rebuilding the block graph.
        </p>
        <p className="text-sm text-pf-text-secondary leading-relaxed">
          Fields that start with <code className="text-pf-purple-500 font-mono text-xs">$</code> are <strong className="text-pf-text">variables</strong> — shown in purple with a <em>var</em> badge.
        </p>
      </div>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function BuilderTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch { /* ignore */ }
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label="Strategy builder tutorial"
      className="absolute bottom-4 left-4 z-40 w-80 bg-pf-elevated border border-pf-border rounded-pf-lg shadow-pf-lg flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-pf-text">{current.title}</span>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
          aria-label="Dismiss tutorial"
          title="Don't show again"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 flex-1">
        {current.content}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-pf-border-subtle">
        {/* Step dots */}
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
              className="rounded-full transition-all focus-visible:outline-none"
              style={{
                width: i === step ? 16 : 6,
                height: 6,
                backgroundColor: i === step ? 'var(--color-pf-cyan-500)' : 'var(--color-pf-border)',
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-pf text-xs font-medium text-pf-text-secondary hover:text-pf-text bg-pf-surface border border-pf-border hover:border-pf-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
            >
              <ChevronLeft className="size-3" />
              Back
            </button>
          )}
          {isFirst && (
            <button
              onClick={dismiss}
              className="px-2.5 py-1.5 rounded-pf text-xs font-medium text-pf-text-muted hover:text-pf-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
            >
              Skip
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-pf text-xs font-medium bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
          >
            {isLast ? 'Got it' : 'Next'}
            {!isLast && <ChevronRight className="size-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
