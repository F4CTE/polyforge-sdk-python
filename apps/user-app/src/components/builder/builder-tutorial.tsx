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
        <p className="text-body-sm text-secondary leading-relaxed">
          Strategies are built by connecting <strong className="text-primary">blocks</strong> — each representing a piece of trading logic. Blocks are wired together to define execution flow.
        </p>
        <p className="text-body-sm text-secondary leading-relaxed">
          Drag blocks from the palette onto the canvas, then connect them by dragging from the <span className="inline-block size-2 rounded-full bg-accent-text mr-2" aria-hidden="true" /> handles on each block.
        </p>
      </div>
    ),
  },
  {
    title: 'Safety Blocks — Always Active',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-loss/10 border border-loss/25">
          <Shield className="size-4 shrink-0 text-loss" />
          <span className="text-body-md font-medium text-loss">Safety</span>
        </div>
        <p className="text-body-sm text-secondary leading-relaxed">
          Safety blocks are <strong className="text-primary">always enforced globally</strong> — they protect every execution path, every tick. They have no connection handles because they can't be scoped.
        </p>
        <p className="text-body-sm text-secondary leading-relaxed">
          Examples: <em>Daily Loss Limit</em>, <em>Max Open Positions</em>. Add them and they're active — no wiring needed.
        </p>
      </div>
    ),
  },
  {
    title: 'Trigger Blocks — Must Be Wired',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/25">
          <Zap className="size-4 shrink-0 text-warning" />
          <span className="text-body-md font-medium text-warning">Trigger</span>
        </div>
        <p className="text-body-sm text-secondary leading-relaxed">
          Triggers detect when something happens (e.g. price crosses a threshold). They only fire if they have an <strong className="text-primary">outgoing connection</strong> — the wire tells the engine where to route execution.
        </p>
        <div className="flex items-center gap-2 p-2 rounded-pf text-label bg-warning-subtle">
          <Unlink className="size-3 shrink-0 text-warning" />
          <span className="text-warning">Unwired triggers show a &ldquo;Not wired&rdquo; badge and are dimmed — they won&rsquo;t execute.</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Condition Blocks — Global or Scoped',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-subtle border border-accent/25">
          <Filter className="size-4 shrink-0 text-accent" />
          <span className="text-body-md font-medium text-accent">Condition</span>
        </div>
        <p className="text-body-sm text-secondary leading-relaxed">
          Conditions are gates — they let execution through only when their rule passes.
        </p>
        <ul className="space-y-2 text-body-sm text-secondary">
          <li className="flex items-start gap-2">
            <Globe className="size-3 mt-1 shrink-0 text-accent" />
            <span><strong className="text-primary">Unwired:</strong> acts as a <em>global gate</em> — all execution paths must pass it.</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="size-3 mt-1 shrink-0 text-tertiary" />
            <span><strong className="text-primary">Wired:</strong> only gates the specific trigger → action path it's connected to.</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Action Blocks — Must Be Wired',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gain/10 border border-gain/25">
          <Play className="size-4 shrink-0 text-gain" />
          <span className="text-body-md font-medium text-gain">Action</span>
        </div>
        <p className="text-body-sm text-secondary leading-relaxed">
          Actions execute trades — buy, sell, close positions, run sub-strategies. They only execute if they have an <strong className="text-primary">incoming connection</strong> from a trigger or condition.
        </p>
        <div className="flex items-center gap-2 p-2 rounded-pf text-label bg-warning-subtle">
          <Unlink className="size-3 shrink-0 text-warning" />
          <span className="text-warning">Unwired actions are dimmed and won&rsquo;t execute — they need upstream context.</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Market Slots',
    content: (
      <div className="space-y-3">
        <p className="text-body-sm text-secondary leading-relaxed">
          Many blocks have a <strong className="text-primary">Market Slot</strong> field (<code className="text-variable font-mono text-label">$MARKET_A</code> … <code className="text-variable font-mono text-label">$MARKET_E</code>). These are placeholders — you bind them to real markets when you start the strategy.
        </p>
        <p className="text-body-sm text-secondary leading-relaxed">
          This lets a single strategy template trade across different markets without rebuilding the block graph.
        </p>
        <p className="text-body-sm text-secondary leading-relaxed">
          Fields that start with <code className="text-variable font-mono text-label">$</code> are <strong className="text-primary">variables</strong> — shown in purple with a <em>var</em> badge.
        </p>
      </div>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BuilderTutorialProps {
  /** When true, force the tutorial open regardless of localStorage state */
  forceVisible?: boolean;
  /** Called when the user dismisses a force-shown tutorial */
  onDismiss?: () => void;
}

export function BuilderTutorial({ forceVisible, onDismiss }: BuilderTutorialProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      setStep(0);
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch { /* ignore */ }
  }, [forceVisible]);

  function dismiss() {
    setVisible(false);
    onDismiss?.();
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
      className="absolute bottom-4 left-4 z-40 w-80 bg-elevated border border-default rounded-xl shadow-lg flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-body-md font-semibold text-primary">{current.title}</span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded hover:bg-overlay transition-colors text-tertiary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
      <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
        {/* Step dots */}
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
              className={`rounded-full transition-all focus-visible:outline-none h-2 ${
                i === step ? 'w-4 bg-accent' : 'w-2 bg-default'
              }`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-pf text-label font-medium text-secondary hover:text-primary bg-surface border border-default hover:border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ChevronLeft className="size-3" />
              Back
            </button>
          )}
          {isFirst && (
            <button
              type="button"
              onClick={dismiss}
              className="px-3 py-2 rounded-pf text-label font-medium text-tertiary hover:text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-pf text-label font-medium bg-accent text-inverse hover:bg-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {isLast ? 'Got it' : 'Next'}
            {!isLast && <ChevronRight className="size-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
