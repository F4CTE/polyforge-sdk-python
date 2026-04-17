import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router';
import { PolyforgeLogomark } from '@polyforge/ui';
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
      className={`flex flex-col h-full bg-surface border-r border-default transition-all duration-panel ${collapsed ? 'w-12 min-w-12' : 'w-[220px] min-w-[220px]'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-default">
        <Link to="/markets" className="flex items-center gap-3 min-w-0">
          <PolyforgeLogomark size={28} className="shrink-0 text-accent" />
          {!collapsed && (
            <span className="text-primary font-semibold text-base tracking-tight">
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
              <div className="px-2 mb-1 text-label font-semibold uppercase tracking-wider text-tertiary">
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
                    `flex items-center gap-3 px-3 py-2 rounded-sm text-body-sm transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded-lg ${
                      isActive
                        ? 'bg-accent/10 text-accent-text'
                        : 'text-secondary hover:bg-surface hover:text-primary'
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
      <div className="border-t border-default px-2 py-2 space-y-1">
        {/* Edge Rating */}
        {myScore !== null && (
          <Link
            to="/profile/me"
            data-tour="edge-rating"
            className="flex items-center gap-3 px-2 py-2 rounded-sm text-body-sm transition-colors duration-micro text-secondary hover:bg-surface hover:text-primary"
            title={collapsed ? `Edge Rating: ${myScore}` : undefined}
          >
            <TrendingUp size={18} className={`shrink-0 ${
              myScore >= 80 ? 'text-gain' :
              myScore >= 60 ? 'text-accent-text' :
              myScore >= 40 ? 'text-warning' :
              'text-loss'
            }`} />
            {!collapsed && (
              <span className="flex items-center gap-2">
                <span>Edge Rating</span>
                <span className={`font-mono font-semibold text-label ${
                  myScore >= 80 ? 'text-gain' :
                  myScore >= 60 ? 'text-accent-text' :
                  myScore >= 40 ? 'text-warning' :
                  'text-loss'
                }`}>{myScore}</span>
              </span>
            )}
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 px-2 py-2 rounded-sm text-body-sm transition-colors duration-micro text-secondary hover:bg-surface hover:text-primary w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded-lg"
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
            `flex items-center gap-3 px-3 py-2 rounded-sm text-body-sm transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:rounded-lg ${
              isActive
                ? 'bg-accent/10 text-accent-text'
                : 'text-secondary hover:bg-surface hover:text-primary'
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
