import { useLocation } from 'react-router';
import { Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { useAdminAuthStore } from '@/stores/admin-auth-store';

const routeNames: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  strategies: 'Strategies',
  orders: 'Orders',
  backtests: 'Backtests',
  cache: 'Cache',
  reports: 'Reports',
  logs: 'Logs',
  builder: 'Builder',
  invites: 'Invites',
  tickets: 'Tickets',
  admins: 'Admins',
};

interface TopbarProps {
  onMenuClick?: () => void;
}

export function AdminTopbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  const { isDark, toggle } = useThemeStore();
  const { admin, logout } = useAdminAuthStore();

  const segments = location.pathname.split('/').filter(Boolean);
  const currentPage = routeNames[segments[0] ?? ''] ?? 'Dashboard';

  const initials = admin?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  const roleLabel =
    admin?.role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : admin?.role === 'ADMIN'
        ? 'Admin'
        : 'Viewer';

  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b border-pf-border bg-pf-surface shrink-0">
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 rounded-pf-sm text-pf-text-secondary hover:bg-pf-elevated transition-colors md:hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-base font-semibold text-pf-text">
          {currentPage}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="p-2 rounded-pf-sm hover:bg-pf-elevated text-pf-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-pf-full bg-pf-cyan-500 text-pf-text-contrast text-pf-label font-bold" role="img" aria-label={`Avatar for ${admin?.displayName ?? 'admin'}`}>
            {initials}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-pf-text leading-tight">
              {admin?.displayName}
            </div>
            <div className="text-pf-caption text-pf-text-tertiary leading-tight">
              {roleLabel}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="p-2 rounded-pf-sm hover:bg-pf-elevated text-pf-text-secondary hover:text-pf-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-danger"
          aria-label="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
