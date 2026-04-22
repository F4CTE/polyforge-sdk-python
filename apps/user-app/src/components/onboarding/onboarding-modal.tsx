'use client';

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  TrendingUp,
  Cpu,
  Users,
  Search,
  Star,
  BarChart2,
  Grid2x2,
  Play,
  Copy,
  UserCheck,
  Shield,
  ChevronLeft,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Step {
  id: number;
  visual?: React.ReactNode;
  heading: string;
  subtitle: string;
  features: FeatureCard[];
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryPath?: string;
}

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pf-onboarding-complete';

const ICON_CLASS = 'w-5 h-5 text-accent-text shrink-0';

const STEPS: Step[] = [
  {
    id: 1,
    visual: (
      <div className="text-6xl select-none leading-none" aria-hidden="true">
        ✦
      </div>
    ),
    heading: 'Welcome to PolyForge',
    subtitle:
      'The smartest way to trade on Polymarket — strategies, copy trading, and deep analytics.',
    features: [
      {
        icon: <TrendingUp className={ICON_CLASS} />,
        title: 'Trade on real Polymarket prediction markets',
        description: '',
      },
      {
        icon: <Cpu className={ICON_CLASS} />,
        title: 'Build automated strategies with our visual builder',
        description: '',
      },
      {
        icon: <Users className={ICON_CLASS} />,
        title: 'Copy top traders and follow their positions',
        description: '',
      },
    ],
    primaryLabel: 'Get Started →',
  },
  {
    id: 2,
    heading: 'Explore Live Markets',
    subtitle:
      'Polymarket has thousands of active prediction markets. PolyForge gives you powerful tools to find the best ones.',
    features: [
      {
        icon: <Search className={ICON_CLASS} />,
        title: 'Smart Discovery',
        description: 'Filter by category, volume, end date',
      },
      {
        icon: <Star className={ICON_CLASS} />,
        title: 'Watchlist',
        description: 'Track markets and get price alerts',
      },
      {
        icon: <BarChart2 className={ICON_CLASS} />,
        title: 'Deep Analytics',
        description: 'Sentiment, depth charts, correlation matrix',
      },
    ],
    primaryLabel: 'Next →',
    secondaryLabel: 'Browse Markets →',
    secondaryPath: '/markets',
  },
  {
    id: 3,
    heading: 'Build Your First Strategy',
    subtitle:
      'Our visual strategy builder lets you automate your Polymarket trading without writing code.',
    features: [
      {
        icon: <Grid2x2 className={ICON_CLASS} />,
        title: 'Visual Builder',
        description: 'Drag-and-drop logic blocks',
      },
      {
        icon: <Play className={ICON_CLASS} />,
        title: 'Backtesting',
        description: 'Test against historical data before going live',
      },
      {
        icon: <Copy className={ICON_CLASS} />,
        title: 'Marketplace',
        description: 'Buy proven strategies from top traders',
      },
    ],
    primaryLabel: 'Next →',
    secondaryLabel: 'Open Strategy Builder →',
    secondaryPath: '/strategies/builder',
  },
  {
    id: 4,
    heading: 'Copy Top Traders',
    subtitle:
      'Follow expert traders and automatically mirror their positions on Polymarket.',
    features: [
      {
        icon: <UserCheck className={ICON_CLASS} />,
        title: 'Verified Traders',
        description: 'Browse traders with audited track records',
      },
      {
        icon: <Shield className={ICON_CLASS} />,
        title: 'Risk Controls',
        description: 'Set max loss limits and position caps',
      },
      {
        icon: <TrendingUp className={ICON_CLASS} />,
        title: 'Real Returns',
        description: 'Copy real Polymarket trades, not paper trades',
      },
    ],
    primaryLabel: 'Start Trading →',
  },
];

const TOTAL_STEPS = STEPS.length;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding progress">
      {STEPS.map((step) => {
        const isComplete = step.id < current;
        const isCurrent = step.id === current;
        return (
          <div
            key={step.id}
            role="tab"
            aria-selected={isCurrent}
            aria-label={`Step ${step.id} of ${TOTAL_STEPS}`}
            className={[
              'rounded-full transition-all duration-slow',
              isComplete || isCurrent
                ? 'w-6 h-2 bg-accent'
                : 'w-2 h-2 bg-default',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

function FeatureCardRow({ feature, asBullet }: { feature: FeatureCard; asBullet?: boolean }) {
  if (asBullet) {
    return (
      <li className="flex items-start gap-3">
        <span className="mt-1">{feature.icon}</span>
        <span className="text-secondary text-body-sm leading-snug">{feature.title}</span>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-pf border border-default bg-surface p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2">
        {feature.icon}
        <span className="text-primary text-body-md font-semibold">{feature.title}</span>
      </div>
      {feature.description && (
        <p className="text-tertiary text-label leading-relaxed">{feature.description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const navigate = useNavigate();

  // Drive enter/exit animation from the `open` prop
  useEffect(() => {
    if (open) {
      // Allow a single rAF so the element mounts before we add the visible class
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const handleClose = useCallback(
    (markComplete: boolean) => {
      if (markComplete) {
        localStorage.setItem(STORAGE_KEY, 'true');
        fetch('/api/v1/users/onboarding-complete', {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {
          // fire-and-forget — ignore errors
        });
        toast.success('Welcome to PolyForge!');
      } else {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
      setExiting(true);
      setTimeout(() => {
        setExiting(false);
        setVisible(false);
        setCurrentStep(1);
        onClose();
      }, 200);
    },
    [onClose],
  );

  const handleSkip = useCallback(() => handleClose(false), [handleClose]);

  const handleComplete = useCallback(() => handleClose(true), [handleClose]);

  const handlePrimary = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const handleSecondary = useCallback(
    (path: string) => {
      handleClose(false);
      navigate(path);
    },
    [handleClose, navigate],
  );

  // Keyboard handling
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') {
        if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, currentStep, handleSkip]);

  if (!open && !visible) return null;

  const step = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;
  const showSkip = !isLastStep;
  const showBack = !isFirstStep;

  const overlayOpacity = visible && !exiting ? 'opacity-100' : 'opacity-0';
  const cardTransform =
    visible && !exiting
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-4';

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'backdrop-blur-sm bg-black/60',
        'transition-opacity duration-panel',
        overlayOpacity,
      ].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      <div
        className={[
          'relative w-full max-w-lg',
          'bg-elevated border border-default rounded-2xl p-8',
          'transition-all duration-slow',
          cardTransform,
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top chrome: progress + skip */}
        <div className="flex items-center justify-between mb-6">
          <ProgressDots current={currentStep} />
          <span className="text-tertiary text-label">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          {showSkip && (
            <button
              onClick={handleSkip}
              className="text-tertiary text-label hover:text-primary transition-colors focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm px-1"
              aria-label="Skip onboarding"
            >
              Skip for now
            </button>
          )}
        </div>

        {/* Step visual (step 1 only) */}
        {step.visual && (
          <div className="flex justify-center mb-6 text-accent-text">
            {step.visual}
          </div>
        )}

        {/* Heading */}
        <h2
          id="onboarding-heading"
          className="text-primary text-xl font-semibold mb-2 leading-tight"
        >
          {step.heading}
        </h2>
        <p className="text-secondary text-body-sm leading-relaxed mb-6">
          {step.subtitle}
        </p>

        {/* Features */}
        {isFirstStep ? (
          <ul className="flex flex-col gap-3 mb-8" aria-label="What you can do with PolyForge">
            {step.features.map((f) => (
              <FeatureCardRow key={f.title} feature={f} asBullet />
            ))}
          </ul>
        ) : (
          <div
            className="flex gap-3 mb-8"
            role="list"
            aria-label={`${step.heading} features`}
          >
            {step.features.map((f) => (
              <div key={f.title} role="listitem" className="flex-1 min-w-0">
                <FeatureCardRow feature={f} />
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className={[
                'flex items-center gap-1 px-3 py-2 rounded-pf',
                'text-secondary text-body-sm',
                'border border-default hover:border-strong',
                'hover:text-primary transition-colors',
                'focus-visible:outline-none focus-visible:shadow-focus-ring',
              ].join(' ')}
              aria-label="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {step.secondaryLabel && step.secondaryPath && (
              <button
                onClick={() => handleSecondary(step.secondaryPath!)}
                className={[
                  'text-accent-text text-body-md font-medium',
                  'hover:text-accent transition-colors',
                  'focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm px-1',
                ].join(' ')}
              >
                {step.secondaryLabel}
              </button>
            )}

            <button
              onClick={handlePrimary}
              className={[
                'px-5 py-3 rounded-pf',
                'bg-accent text-inverse text-body-md font-semibold',
                'hover:opacity-90 active:scale-95 transition-all',
                'focus-visible:outline-none focus-visible:shadow-focus-ring',
              ].join(' ')}
            >
              {step.primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
