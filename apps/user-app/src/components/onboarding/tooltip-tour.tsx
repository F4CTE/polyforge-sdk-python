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
    title: 'Sidebar Navigation',
    content: 'Access all sections of the platform from here: markets, strategies, portfolio, and more.',
    placement: 'right',
  },
  {
    target: '[data-tour="market-card"]',
    title: 'Market Cards',
    content: 'Each card shows a prediction market. Click to see details, price charts, and run strategies.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="strategy-builder"]',
    title: 'Strategy Builder',
    content: 'Design automated trading strategies with our visual drag-and-drop builder. Combine triggers, conditions, and actions.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="theme-toggle"]',
    title: 'Theme Toggle',
    content: 'Switch between dark and light themes to suit your preference.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notification-bell"]',
    title: 'Notifications',
    content: 'Stay informed about order fills, strategy events, and price alerts in real time.',
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

  function nextStep() {
    // Remove highlight from current
    const currentStep = TOUR_STEPS[stepIndex];
    if (currentStep) {
      const target = document.querySelector(currentStep.target);
      if (target) target.classList.remove('tour-highlight');
    }

    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
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

    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }

  if (!active) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 transition-opacity"
        onClick={closeTour}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[9999] w-80 bg-pf-elevated border border-pf-border rounded-pf-lg shadow-2xl animate-fade-in"
        style={{
          top: `${Math.max(8, position.top)}px`,
          left: `${Math.max(8, Math.min(position.left, window.innerWidth - 340))}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
          <span className="text-sm font-semibold text-pf-text">{step.title}</span>
          <button
            onClick={closeTour}
            className="p-1 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text"
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
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="flex items-center gap-1 px-3 py-1.5 rounded-pf text-xs font-medium text-pf-text-secondary hover:text-pf-text bg-pf-surface border border-pf-border hover:border-pf-border-strong transition-colors"
              >
                <ChevronLeft className="size-3" />
                Back
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex items-center gap-1 px-3 py-1.5 rounded-pf text-xs font-medium bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <ChevronRight className="size-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Inline styles for tour highlight */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 9999 !important;
          box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1) !important;
          border-radius: 8px;
        }
      `}</style>
    </>
  );
}
