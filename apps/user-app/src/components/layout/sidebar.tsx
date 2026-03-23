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
      { label: 'Strategies', icon: Zap, route: '/strategies' },
      { label: 'Portfolio', icon: Wallet, route: '/portfolio' },
      { label: 'Orders', icon: ClipboardList, route: '/orders' },
      { label: 'Backtest', icon: FlaskConical, route: '/backtest' },
      { label: 'Copy Trading', icon: UserPlus, route: '/copy' },
    ],
  },
  {
    title: 'Social',
    items: [
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
    title: 'Help',
    items: [{ label: 'Support', icon: HelpCircle, route: '/support' }],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full bg-pf-elevated border-r border-pf-border transition-all duration-200"
      style={{ width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240 }}
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
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-pf-text-secondary">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.route}
                  to={item.route}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 ${
                      isActive
                        ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                        : 'text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text'
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom collapse + settings */}
      <div className="border-t border-pf-border px-2 py-2 space-y-0.5">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text w-full"
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <ChevronRight size={18} className="shrink-0" />
          ) : (
            <ChevronLeft size={18} className="shrink-0" />
          )}
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 ${
              isActive
                ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                : 'text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text'
            }`
          }
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
