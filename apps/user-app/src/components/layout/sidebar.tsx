import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router';
import {
  BarChart3,
  Zap,
  Wallet,
  ClipboardList,
  FlaskConical,
  Compass,
  Newspaper,
  Fish,
  UserPlus,
  Trophy,
  Code,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Settings,
  TrendingUp,
  TrendingDown,
  Store,
  Layers,
  Star,
  Target,
  Sparkles,
  LineChart,
  Bell,
  BellRing,
  Rss,
  Gift,
  Users,
  Library,
  GitMerge,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  icon: LucideIcon;
  route: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Trade',
    items: [
      { label: 'Markets', icon: BarChart3, route: '/markets' },
      { label: 'Watchlist', icon: Star, route: '/watchlist' },
      { label: 'Strategies', icon: Zap, route: '/strategies' },
      { label: 'Portfolio', icon: Wallet, route: '/portfolio' },
      { label: 'Orders', icon: ClipboardList, route: '/orders' },
      { label: 'Notifications', icon: Bell, route: '/notifications' },
      { label: 'Alerts', icon: BellRing, route: '/alerts' },
      { label: 'Smart Orders', icon: Layers, route: '/orders/smart' },
      { label: 'Backtest', icon: FlaskConical, route: '/backtest' },
      { label: 'Copy Trading', icon: UserPlus, route: '/copy' },
      { label: 'Discover', icon: Users, route: '/copy/discover' },
      { label: 'Arbitrage', icon: TrendingDown, route: '/arbitrage' },
      { label: 'Marketplace', icon: Store, route: '/marketplace' },
      { label: 'Collections', icon: Library, route: '/collections' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Accuracy', icon: Target, route: '/accuracy' },
      { label: 'Analytics', icon: LineChart, route: '/analytics' },
      { label: 'Correlation', icon: GitMerge, route: '/analytics/correlation' },
      { label: 'AI Optimizer', icon: Sparkles, route: '/optimizer' },
    ],
  },
  {
    title: 'Social',
    items: [
      { label: 'Feed', icon: Rss, route: '/feed' },
      { label: 'Discover', icon: Compass, route: '/discover' },
      { label: 'News', icon: Newspaper, route: '/news' },
      { label: 'Whales', icon: Fish, route: '/whales' },
      { label: 'Leaderboard', icon: Trophy, route: '/leaderboard' },
    ],
  },
  {
    title: 'Developers',
    items: [{ label: 'API Docs', icon: Code, route: '/api-docs' }],
  },
  {
    title: 'Referrals',
    items: [{ label: 'Referrals', icon: Gift, route: '/referrals' }],
  },
  {
    title: 'Help',
    items: [{ label: 'Support', icon: HelpCircle, route: '/support' }],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [myScore, setMyScore] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/scores/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.score) setMyScore(data.score.score);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <aside
      data-tour="sidebar"
      aria-label="Main navigation"
      className={`flex flex-col h-full bg-pf-elevated border-r border-pf-border transition-all duration-200 ${collapsed ? 'w-16 min-w-16' : 'w-60 min-w-60'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-pf-border">
        <Link to="/markets" className="flex items-center gap-3 min-w-0">
          <div className="text-pf-cyan-500">
            <svg
              className="shrink-0"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                opacity="0.4"
              />
              <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-pf-text font-semibold text-base tracking-tight">
              Polyforge
            </span>
          )}
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4" aria-label="Primary">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="px-2 mb-1 text-pf-label font-semibold uppercase tracking-wider text-pf-text-secondary">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.route}
                  to={item.route}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:rounded-lg ${
                      isActive
                        ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                        : 'text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text'
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom collapse + settings */}
      <div className="border-t border-pf-border px-2 py-2 space-y-1">
        {/* Edge Rating */}
        {myScore !== null && (
          <Link
            to="/profile/me"
            data-tour="edge-rating"
            className="flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-100 text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text"
            title={collapsed ? `Edge Rating: ${myScore}` : undefined}
          >
            <TrendingUp size={18} className={`shrink-0 ${
              myScore >= 80 ? 'text-pf-success' :
              myScore >= 60 ? 'text-pf-cyan-400' :
              myScore >= 40 ? 'text-pf-warning' :
              'text-pf-danger'
            }`} />
            {!collapsed && (
              <span className="flex items-center gap-2">
                <span>Edge Rating</span>
                <span className={`font-mono font-bold text-xs ${
                  myScore >= 80 ? 'text-pf-success' :
                  myScore >= 60 ? 'text-pf-cyan-400' :
                  myScore >= 40 ? 'text-pf-warning' :
                  'text-pf-danger'
                }`}>{myScore}</span>
              </span>
            )}
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-100 text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:rounded-lg"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={18} className="shrink-0" />
          ) : (
            <ChevronLeft size={18} className="shrink-0" />
          )}
        </button>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:rounded-lg ${
              isActive
                ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                : 'text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text'
            }`
          }
        >
          <Settings size={18} className="shrink-0" aria-hidden="true" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
