import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from 'react-router';
import { Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
const routeNames = {
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
export function AdminTopbar({ onMenuClick }) {
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
    const roleLabel = admin?.role === 'SUPER_ADMIN'
        ? 'Super Admin'
        : admin?.role === 'ADMIN'
            ? 'Admin'
            : 'Viewer';
    return (_jsxs("header", { className: "flex items-center justify-between h-14 px-4 md:px-6 border-b border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [onMenuClick && (_jsx("button", { onClick: onMenuClick, className: "p-2 rounded-pf-sm text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-elevated)] transition-colors md:hidden", "aria-label": "Open menu", children: _jsx(Menu, { size: 20 }) })), _jsx("h1", { className: "text-base font-semibold text-[var(--color-pf-text)]", children: currentPage })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: toggle, className: "p-2 rounded-pf-sm hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] transition-colors", "aria-label": isDark ? 'Switch to light mode' : 'Switch to dark mode', children: isDark ? _jsx(Sun, { size: 16 }) : _jsx(Moon, { size: 16 }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-pf-cyan-500)] text-white text-[11px] font-bold", children: initials }), _jsxs("div", { className: "hidden sm:block", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-pf-text)] leading-tight", children: admin?.displayName }), _jsx("div", { className: "text-[10px] text-[var(--color-pf-text-tertiary)] leading-tight", children: roleLabel })] })] }), _jsx("button", { onClick: logout, className: "p-2 rounded-pf-sm hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:text-pf-danger transition-colors", "aria-label": "Logout", children: _jsx(LogOut, { size: 16 }) })] })] }));
}
