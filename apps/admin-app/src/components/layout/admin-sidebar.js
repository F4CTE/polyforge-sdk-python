import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink, Link } from 'react-router';
import { LayoutDashboard, Users, Blocks, ShoppingCart, FlaskConical, Database, Flag, ScrollText, Hammer, TicketCheck, Mail, ShieldCheck, PanelLeftClose, PanelLeftOpen, } from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
import { usePollingStore } from '@/stores/polling-store';
const iconSize = 18;
const navSections = [
    {
        title: 'Overview',
        items: [
            { label: 'Dashboard', path: '/dashboard', icon: _jsx(LayoutDashboard, { size: iconSize }) },
        ],
    },
    {
        title: 'Management',
        items: [
            { label: 'Users', path: '/users', icon: _jsx(Users, { size: iconSize }) },
            { label: 'Strategies', path: '/strategies', icon: _jsx(Blocks, { size: iconSize }) },
            { label: 'Orders', path: '/orders', icon: _jsx(ShoppingCart, { size: iconSize }) },
            { label: 'Backtests', path: '/backtests', icon: _jsx(FlaskConical, { size: iconSize }) },
        ],
    },
    {
        title: 'System',
        items: [
            { label: 'Cache', path: '/cache', icon: _jsx(Database, { size: iconSize }) },
            { label: 'Reports', path: '/reports', icon: _jsx(Flag, { size: iconSize }) },
            { label: 'Logs', path: '/logs', icon: _jsx(ScrollText, { size: iconSize }) },
        ],
    },
    {
        title: 'Programs',
        items: [
            { label: 'Builder', path: '/builder', icon: _jsx(Hammer, { size: iconSize }) },
            { label: 'Invites', path: '/invites', icon: _jsx(Mail, { size: iconSize }) },
            { label: 'Tickets', path: '/tickets', icon: _jsx(TicketCheck, { size: iconSize }) },
        ],
    },
    {
        title: 'Access',
        superAdminOnly: true,
        items: [
            { label: 'Admins', path: '/admins', icon: _jsx(ShieldCheck, { size: iconSize }) },
        ],
    },
];
export function AdminSidebar({ collapsed, onToggle, onNavigate }) {
    const { isSuperAdmin, admin } = useAdminAuthStore();
    const openTickets = usePollingStore((s) => s.openTickets);
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
    return (_jsxs("aside", { className: `flex flex-col h-screen border-r border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`, children: [_jsxs("div", { className: "flex items-center gap-2 h-14 px-3 border-b border-[var(--color-pf-border)] shrink-0", children: [_jsxs(Link, { to: "/dashboard", className: "flex items-center gap-2 min-w-0", children: [_jsxs("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", className: "shrink-0", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "var(--color-pf-cyan-500)", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "var(--color-pf-cyan-500)" })] }), !collapsed && (_jsxs("span", { className: "text-sm font-semibold text-[var(--color-pf-text)] whitespace-nowrap", children: ["Polyforge", ' ', _jsx("span", { className: "text-[var(--color-pf-cyan-500)]", children: "Admin" })] }))] }), _jsx("button", { onClick: onToggle, className: "ml-auto p-1 rounded hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] transition-colors", "aria-label": "Toggle sidebar", children: collapsed ? _jsx(PanelLeftOpen, { size: 16 }) : _jsx(PanelLeftClose, { size: 16 }) })] }), _jsx("nav", { className: "flex-1 overflow-y-auto py-2 px-2 space-y-1", children: navSections.map((section) => {
                    if (section.superAdminOnly && !isSuperAdmin)
                        return null;
                    return (_jsxs("div", { className: "mb-2", children: [!collapsed && (_jsx("div", { className: "px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-pf-text-tertiary)]", children: section.title })), section.items.map((item) => (_jsxs(NavLink, { to: item.path, title: collapsed ? item.label : undefined, onClick: onNavigate, className: ({ isActive }) => `flex items-center gap-2.5 px-2.5 py-2 rounded-pf-sm text-sm transition-colors duration-150 ${isActive
                                    ? 'bg-[var(--color-pf-cyan-500)]/10 text-[var(--color-pf-cyan-500)] font-medium'
                                    : 'text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-elevated)] hover:text-[var(--color-pf-text)]'}`, children: [_jsxs("span", { className: "shrink-0 relative", children: [item.icon, collapsed && item.label === 'Tickets' && openTickets > 0 && (_jsx("span", { className: "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded-full bg-[var(--color-pf-cyan-500)] text-[8px] font-bold text-white", children: openTickets }))] }), !collapsed && (_jsxs(_Fragment, { children: [_jsx("span", { className: "truncate", children: item.label }), item.label === 'Tickets' && openTickets > 0 && (_jsx("span", { className: "ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-pf-cyan-500)] text-[10px] font-bold text-white", children: openTickets }))] }))] }, item.path)))] }, section.title));
                }) }), _jsx("div", { className: "border-t border-[var(--color-pf-border)] px-3 py-4 shrink-0", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-pf-elevated)] text-[var(--color-pf-cyan-500)] text-[11px] font-bold shrink-0", children: initials }), !collapsed && (_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-pf-text)] truncate", children: admin?.displayName }), _jsx("div", { className: "text-[11px] text-[var(--color-pf-text-tertiary)]", children: roleLabel })] }))] }) })] }));
}
