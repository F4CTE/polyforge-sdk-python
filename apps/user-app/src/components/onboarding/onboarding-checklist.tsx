import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, X,
  User, BarChart3, Cpu, FileText, FlaskConical, Bell,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'completeProfile',
    label: 'Complete your profile',
    description: 'Add a display name, avatar, and bio so other traders can find you.',
    icon: <User className="size-4" />,
    route: '/settings',
  },
  {
    key: 'browseMarkets',
    label: 'Browse prediction markets',
    description: 'Explore real Polymarket events — politics, crypto, sports, and more.',
    icon: <BarChart3 className="size-4" />,
    route: '/markets',
  },
  {
    key: 'createStrategy',
    label: 'Build your first strategy',
    description: 'Drag-and-drop triggers, conditions, and safety blocks in the visual builder.',
    icon: <Cpu className="size-4" />,
    route: '/strategies/new',
  },
  {
    key: 'runBacktest',
    label: 'Backtest your strategy',
    description: 'Replay it against historical market data to see how it would have performed.',
    icon: <FlaskConical className="size-4" />,
    route: '/backtest',
  },
  {
    key: 'runPaperTrade',
    label: 'Start a paper trade',
    description: 'Deploy your strategy in simulation mode — real prices, no real money.',
    icon: <FileText className="size-4" />,
    route: '/strategies',
  },
  {
    key: 'setupNotifications',
    label: 'Set up notifications',
    description: 'Get alerts when orders fill, strategies trigger, or prices spike.',
    icon: <Bell className="size-4" />,
    route: '/settings',
  },
];

const STORAGE_KEY = 'polyforge:onboarding:completed';
const DISMISSED_KEY = 'polyforge:onboarding:dismissed';

/* ─── Component ──────────────────────────────────────────────────────── */

export function OnboardingChecklist() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCompleted(JSON.parse(stored));
      const wasDismissed = localStorage.getItem(DISMISSED_KEY);
      if (wasDismissed === 'true') setDismissed(true);
    } catch { /* ignore parse errors */ }
  }, []);

  // Only show for users who joined within the last 7 days
  if (!user) return null;
  const joinDate = new Date(user.createdAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (joinDate < sevenDaysAgo) return null;

  // Don't show if dismissed
  if (dismissed) return null;

  const completedCount = CHECKLIST_ITEMS.filter(item => completed[item.key]).length;
  const allDone = completedCount === CHECKLIST_ITEMS.length;

  // Auto-dismiss when all items checked
  if (allDone) {
    setTimeout(() => {
      setDismissed(true);
      localStorage.setItem(DISMISSED_KEY, 'true');
    }, 2000);
  }

  function toggleItem(key: string) {
    const next = { ...completed, [key]: !completed[key] };
    setCompleted(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }

  function handleNavigate(route: string) {
    navigate(route);
  }

  return (
    <div role="region" aria-label="Getting started checklist" className="fixed bottom-4 right-4 z-50 w-80 bg-pf-elevated border border-pf-border rounded-pf-lg shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-pf-text">Getting Started</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pf-cyan-500/15 text-pf-cyan-400 font-medium">
            {completedCount}/{CHECKLIST_ITEMS.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-pf-overlay transition-colors active:scale-95 text-pf-text-muted hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-pf-overlay transition-colors active:scale-95 text-pf-text-muted hover:text-pf-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
            aria-label="Dismiss checklist"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2">
        <div className="w-full h-1.5 bg-pf-overlay rounded-full overflow-hidden" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={CHECKLIST_ITEMS.length} aria-label={`${completedCount} of ${CHECKLIST_ITEMS.length} steps completed`}>
          <div
            className="h-full bg-pf-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 py-2 space-y-1 max-h-[320px] overflow-y-auto scrollbar-none">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item.key}
              className="flex items-start gap-2.5 py-2 group"
            >
              <button
                onClick={() => toggleItem(item.key)}
                className="mt-0.5 shrink-0 transition-colors"
                aria-label={`Mark "${item.label}" as ${completed[item.key] ? 'incomplete' : 'complete'}`}
              >
                {completed[item.key] ? (
                  <CheckCircle2 className="size-4 text-pf-success" />
                ) : (
                  <Circle className="size-4 text-pf-text-muted group-hover:text-pf-cyan-400 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleNavigate(item.route)}
                  className={`text-sm text-left font-medium transition-colors ${
                    completed[item.key]
                      ? 'text-pf-text-muted line-through'
                      : 'text-pf-text hover:text-pf-cyan-400'
                  }`}
                >
                  {item.label}
                </button>
                {!completed[item.key] && (
                  <p className="text-xs text-pf-text-secondary mt-0.5 leading-relaxed">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer — "Take a tour" link */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-t border-pf-border-subtle">
          <button
            onClick={() => {
              const event = new CustomEvent('polyforge:start-tour');
              window.dispatchEvent(event);
            }}
            className="text-xs text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors font-medium"
          >
            Take a tour of the platform
          </button>
        </div>
      )}

      {/* All done message */}
      {allDone && (
        <div className="px-4 py-3 text-center">
          <p className="text-sm text-pf-success font-medium">All done! You're ready to trade.</p>
        </div>
      )}
    </div>
  );
}
