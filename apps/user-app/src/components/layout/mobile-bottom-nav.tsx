import { NavLink } from 'react-router';
import { BarChart2, Briefcase, Blocks, Trophy, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface BottomNavItem {
  label: string;
  icon: LucideIcon;
  route: string;
}

const STATIC_NAV: BottomNavItem[] = [
  { label: 'Markets', icon: BarChart2, route: '/markets' },
  { label: 'Portfolio', icon: Briefcase, route: '/portfolio' },
  { label: 'Strategies', icon: Blocks, route: '/strategies' },
  { label: 'Leaderboard', icon: Trophy, route: '/leaderboard' },
];

export function MobileBottomNav() {
  const user = useAuthStore((s) => s.user);
  const profileRoute = user?.username ? `/profile/${user.username}` : '/settings';

  const navItems: BottomNavItem[] = [
    ...STATIC_NAV,
    { label: 'Profile', icon: User, route: profileRoute },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-surface border-t border-default flex items-stretch h-16 pb-safe-area"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.route}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-pf-caption font-medium transition-colors duration-pf-fast -mt-px ${
              isActive
                ? 'text-accent-text border-t-2 border-accent'
                : 'text-tertiary hover:text-secondary border-t-2 border-transparent'
            }`
          }
          aria-label={item.label}
        >
          <item.icon size={20} aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
