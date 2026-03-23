import { useLocation } from 'react-router';
import { Sun, Moon, LogOut } from 'lucide-react';
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

export function AdminTopbar() {
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
    <header className="flex items-center justify-between h-14 px-6 border-b border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] shrink-0">
      <h1 className="text-base font-semibold text-[var(--color-pf-text)]">
        {currentPage}
      </h1>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="p-2 rounded-pf-sm hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-pf-cyan-500)] text-white text-[11px] font-bold">
            {initials}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-[var(--color-pf-text)] leading-tight">
              {admin?.displayName}
            </div>
            <div className="text-[10px] text-[var(--color-pf-text-tertiary)] leading-tight">
              {roleLabel}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-pf-sm hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:text-pf-danger transition-colors"
          aria-label="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
