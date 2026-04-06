import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface StepDef {
  id: string;
  label: string;
  description: string;
  href: string;
}

/* ─── Config ─────────────────────────────────────────────────────────── */

const STEPS: StepDef[] = [
  {
    id: 'connect',
    label: 'Connect your Polymarket account',
    description: 'Link your wallet to start trading',
    href: '/settings?tab=profile',
  },
  {
    id: 'first-trade',
    label: 'Place your first order',
    description: 'Trade on any prediction market',
    href: '/markets',
  },
  {
    id: 'strategy',
    label: 'Create or copy a strategy',
    description: 'Automate your trading approach',
    href: '/strategies/new',
  },
  {
    id: 'alert',
    label: 'Set a price alert',
    description: 'Get notified on market movements',
    href: '/alerts',
  },
  {
    id: '2fa',
    label: 'Enable two-factor authentication',
    description: 'Secure your account',
    href: '/settings?tab=2fa',
  },
];

const DISMISSED_KEY = 'pf-onboarding-dismissed';
const COMPLETED_KEY = 'pf-onboarding-completed';
const ALERT_VISITED_KEY = 'pf-onboarding-alert-visited';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function loadCompletedFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveCompletedToStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function OnboardingDashboardChecklist() {
  const { user } = useAuthStore();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Completed IDs — starts from localStorage, enriched by data fetches
  const [completed, setCompleted] = useState<Set<string>>(loadCompletedFromStorage);

  // Celebration state: show for 3s when all complete before auto-dismiss
  const [celebrating, setCelebrating] = useState(false);

  // ─── Derive completion from auth store (connect, 2fa) ────────────────

  useEffect(() => {
    if (!user) return;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (user.polymarketConnected) next.add('connect');
      if (user.totpEnabled) next.add('2fa');
      saveCompletedToStorage(next);
      return next;
    });
  }, [user]);

  // ─── Derive completion from portfolio stats (first-trade, strategy) ──

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        // Fetch portfolio positions to check for any trades
        const portfolioRes = await fetch('/api/v1/portfolio', { credentials: 'include' });
        if (!cancelled && portfolioRes.ok) {
          const data = await portfolioRes.json();
          const positions: unknown[] = data?.positions ?? [];
          if (positions.length > 0) {
            setCompleted((prev) => {
              const next = new Set(prev);
              next.add('first-trade');
              saveCompletedToStorage(next);
              return next;
            });
          }
        }
      } catch { /* non-critical */ }

      try {
        // Fetch strategies list to check if user has any
        const strategiesRes = await fetch('/api/v1/strategies?limit=1', { credentials: 'include' });
        if (!cancelled && strategiesRes.ok) {
          const data = await strategiesRes.json();
          const items: unknown[] = data?.data ?? data ?? [];
          const total: number = data?.total ?? items.length;
          if (total > 0) {
            setCompleted((prev) => {
              const next = new Set(prev);
              next.add('strategy');
              saveCompletedToStorage(next);
              return next;
            });
          }
        }
      } catch { /* non-critical */ }

      try {
        // Fetch copy configs to check if user has copied any strategy
        const copyRes = await fetch('/api/v1/copy?limit=1', { credentials: 'include' });
        if (!cancelled && copyRes.ok) {
          const data = await copyRes.json();
          const items: unknown[] = data?.data ?? data ?? [];
          const total: number = data?.total ?? items.length;
          if (total > 0) {
            setCompleted((prev) => {
              const next = new Set(prev);
              next.add('strategy');
              saveCompletedToStorage(next);
              return next;
            });
          }
        }
      } catch { /* non-critical */ }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  // ─── Derive alert step from localStorage flag ─────────────────────────

  useEffect(() => {
    try {
      if (localStorage.getItem(ALERT_VISITED_KEY) === 'true') {
        setCompleted((prev) => {
          const next = new Set(prev);
          next.add('alert');
          saveCompletedToStorage(next);
          return next;
        });
      }
    } catch { /* ignore */ }
  }, []);

  // ─── All-complete celebration & auto-dismiss ───────────────────────────

  const completedCount = STEPS.filter((s) => completed.has(s.id)).length;
  const allDone = completedCount === STEPS.length;

  useEffect(() => {
    if (!allDone) return;
    setCelebrating(true);
    const timer = setTimeout(() => {
      setDismissed(true);
      try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ignore */ }
    }, 3000);
    return () => clearTimeout(timer);
  }, [allDone]);

  // ─── Render guard ──────────────────────────────────────────────────────

  if (dismissed) return null;
  if (allDone && !celebrating) return null;

  // ─── First incomplete step (active step) ─────────────────────────────

  const firstIncompleteIdx = STEPS.findIndex((s) => !completed.has(s.id));

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ignore */ }
  }

  return (
    <div
      role="region"
      aria-label="Getting started checklist"
      className="bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-fade-in"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-pf-cyan-400 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-pf-text">Getting Started</span>
          <span className="text-xs text-pf-text-secondary font-mono">
            {completedCount} / {STEPS.length} complete
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding checklist"
          className="p-1 rounded text-pf-text-muted hover:text-pf-text hover:bg-pf-overlay transition-colors shrink-0"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      <div
        className="w-full h-2 bg-pf-surface rounded-pf-full overflow-hidden mb-4"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-label={`${completedCount} of ${STEPS.length} steps completed`}
      >
        <div
          className="h-full bg-pf-cyan-500 rounded-pf-full transition-all duration-pf-slow"
          style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
        />
      </div>

      {/* ── Celebration ────────────────────────────────────────────── */}
      {celebrating && (
        <div className="text-center py-2 text-sm text-pf-success font-medium animate-fade-in">
          🎉 You're all set!
        </div>
      )}

      {/* ── Steps ──────────────────────────────────────────────────── */}
      {!celebrating && (
        <div className="space-y-1">
          {STEPS.map((step, idx) => {
            const isDone = completed.has(step.id);
            const isActive = idx === firstIncompleteIdx;

            if (isDone) {
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-pf opacity-50"
                >
                  <CheckCircle2 className="size-4 text-pf-success shrink-0" aria-hidden="true" />
                  <span className="text-sm text-pf-text-secondary line-through leading-none">
                    {step.label}
                  </span>
                </div>
              );
            }

            if (isActive) {
              return (
                <Link
                  key={step.id}
                  to={step.href}
                  className="flex items-center gap-3 px-2 py-2 rounded-pf bg-pf-cyan-500/5 border border-pf-cyan-500/20 transition-colors hover:bg-pf-cyan-500/10 group"
                >
                  <Circle className="size-4 text-pf-cyan-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-pf-text leading-none">{step.label}</p>
                    <p className="text-xs text-pf-text-secondary mt-1">{step.description}</p>
                  </div>
                  <ArrowRight className="size-4 text-pf-cyan-400 shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </Link>
              );
            }

            // Upcoming (after active)
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 px-2 py-2 rounded-pf opacity-40"
              >
                <Circle className="size-4 text-pf-text-muted shrink-0" aria-hidden="true" />
                <span className="text-sm text-pf-text-secondary leading-none">{step.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
