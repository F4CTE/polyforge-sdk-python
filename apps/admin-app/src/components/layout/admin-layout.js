import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { usePollingStore } from '@/stores/polling-store';
export function Component() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { start, stop } = usePollingStore();
    useEffect(() => {
        start();
        return () => stop();
    }, [start, stop]);
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-[var(--color-pf-bg)]", children: [_jsx("div", { className: "hidden md:block", children: _jsx(AdminSidebar, { collapsed: collapsed, onToggle: () => setCollapsed((v) => !v) }) }), mobileOpen && (_jsxs("div", { className: "fixed inset-0 z-40 md:hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black/50", onClick: () => setMobileOpen(false) }), _jsx("div", { className: "relative z-50 h-full", children: _jsx(AdminSidebar, { collapsed: false, onToggle: () => setMobileOpen(false), onNavigate: () => setMobileOpen(false) }) })] })), _jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [_jsx(AdminTopbar, { onMenuClick: () => setMobileOpen(true) }), _jsx("main", { className: "flex-1 overflow-y-auto p-6", children: _jsx("div", { className: "animate-fade-in", children: _jsx(Outlet, {}) }) })] })] }));
}
