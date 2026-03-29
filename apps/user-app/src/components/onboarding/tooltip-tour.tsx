import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TourStep {
  /** CSS selector for the target element to highlight */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description shown in the tooltip */
  content: string;
  /** Preferred placement relative to the target */
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: 'Navigation',
    content: 'Your home base. Jump to markets, strategies, portfolio, copy trading, whale tracking, and more from here.',
    placement: 'right',
  },
  {
    target: '[data-tour="market-card"]',
    title: 'Prediction Markets',
    content: 'Real Polymarket events updated in real time. Click any card to see live prices, order books, and charts.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="strategy-builder"]',
    title: 'Visual Strategy Builder',
    content: 'Drag-and-drop blocks to build automated trading strategies — triggers, conditions, safety stops, and more. No code required.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="edge-rating"]',
    title: 'Your Edge Rating',
    content: 'This score reflects your overall trading edge based on win rate, returns, and strategy diversity. Higher is better.',
    placement: 'right',
  },
  {
    target: '[data-tour="portfolio-summary"]',
    title: 'Portfolio Overview',
    content: 'Track your open positions, P&L, and win rate at a glance. Click any position to see details or close it.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="copy-trading"]',
    title: 'Copy Trading',
    content: 'Follow top-performing strategies and automatically replicate their trades. Set your own allocation limits.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    title: 'Theme & Settings',
    content: 'Switch between dark and light mode, manage your account, connect your wallet, and configure notifications.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notification-bell"]',
    title: 'Live Notifications',
    content: 'Real-time alerts when orders fill, strategies trigger, prices hit your targets, or whales make big moves.',
    placement: 'bottom',
  },
];

const STORAGE_KEY = 'polyforge:tour:seen';

/* ─── Tooltip position calculation ────────────────────────────────────── */

function getTooltipPosition(
  targetEl: Element,
  placement: TourStep['placement'],
): { top: number; left: number } {
  const rect = targetEl.getBoundingClientRect();
  const tooltipW = 320;
  const tooltipH = 140;
  const gap = 12;

  switch (placement) {
    case 'right':
      return {
        top: rect.top + rect.height / 2 - tooltipH / 2,
        left: rect.right + gap,
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2 - tooltipH / 2,
        left: rect.left - tooltipW - gap,
      };
    case 'top':
      return {
        top: rect.top - tooltipH - gap,
        left: rect.left + rect.width / 2 - tooltipW / 2,
      };
    case 'bottom':
    default:
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2 - tooltipW / 2,
      };
  }
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function TooltipTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Listen for start event from onboarding checklist
  useEffect(() => {
    function handleStart() {
      setActive(true);
      setStepIndex(0);
    }

    window.addEventListener('polyforge:start-tour', handleStart);
    return () => window.removeEventListener('polyforge:start-tour', handleStart);
  }, []);

  // Check if tour was already seen
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      // If not seen and no explicit start, show on first visit
      if (seen === 'true') return;
    } catch { /* ignore */ }
  }, []);

  // Position the tooltip when step changes
  const updatePosition = useCallback(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    const target = document.querySelector(step.target);
    if (target) {
      setPosition(getTooltipPosition(target, step.placement));

      // Highlight the target
      target.classList.add('tour-highlight');
      return () => target.classList.remove('tour-highlight');
    }
  }, [active, stepIndex]);

  useEffect(() => {
    const cleanup = updatePosition();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [updatePosition]);

  // Remove highlight from previous step when moving
  useEffect(() => {
    return () => {
      document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
      });
    };
  }, [stepIndex]);

  function closeTour() {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    // Clean up all highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });
  }

  /** Find the next step index that has a visible target element on the page */
  function findNextVisible(from: number, direction: 1 | -1): number | null {
    let i = from;
    while (i >= 0 && i < TOUR_STEPS.length) {
      if (document.querySelector(TOUR_STEPS[i].target)) return i;
      i += direction;
    }
    return null;
  }

  function nextStep() {
    // Remove highlight from current
    const currentStep = TOUR_STEPS[stepIndex];
    if (currentStep) {
      const target = document.querySelector(currentStep.target);
      if (target) target.classList.remove('tour-highlight');
    }

    const next = findNextVisible(stepIndex + 1, 1);
    if (next !== null) {
      setStepIndex(next);
    } else {
      closeTour();
    }
  }

  function prevStep() {
    const currentStep = TOUR_STEPS[stepIndex];
    if (currentStep) {
      const target = document.querySelector(currentStep.target);
      if (target) target.classList.remove('tour-highlight');
    }

    const prev = findNextVisible(stepIndex - 1, -1);
    if (prev !== null) {
      setStepIndex(prev);
    }
  }

  if (!active) return null;

  const step = TOUR_STEPS[stepIndex];
  const visibleSteps = TOUR_STEPS.filter(s => document.querySelector(s.target));
  const visibleIndex = visibleSteps.indexOf(step);
  const isLast = findNextVisible(stepIndex + 1, 1) === null;
  const isFirst = findNextVisible(stepIndex - 1, -1) === null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 transition-opacity"
        onClick={closeTour}
        role="presentation"
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        role="dialog"
        aria-label={`Tour step: ${step.title}`}
        className="fixed z-[9999] w-80 bg-pf-elevated border border-pf-border rounded-pf-lg shadow-2xl animate-fade-in"
        style={{
          top: `${Math.max(8, position.top)}px`,
          left: `${Math.max(8, Math.min(position.left, window.innerWidth - 340))}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
          <span className="text-sm font-semibold text-pf-text">{step.title}</span>
          <button type="button"
            onClick={closeTour}
            className="p-1 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
            aria-label="Close tour"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm text-pf-text-secondary leading-relaxed">{step.content}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-pf-border-subtle">
          <span className="text-xs text-pf-text-muted">
            {visibleIndex + 1} of {visibleSteps.length}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button type="button"
                onClick={prevStep}
                className="flex items-center gap-1 px-3 py-1.5 rounded-pf text-xs font-medium text-pf-text-secondary hover:text-pf-text bg-pf-surface border border-pf-border hover:border-pf-border-strong transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
              >
                <ChevronLeft className="size-3" />
                Back
              </button>
            )}
            <button type="button"
              onClick={nextStep}
              className="flex items-center gap-1 px-3 py-1.5 rounded-pf text-xs font-medium bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-elevated"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <ChevronRight className="size-3" />}
            </button>
          </div>
        </div>
      </div>

    </>
  );
}
