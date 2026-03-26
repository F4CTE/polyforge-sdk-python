import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { OnboardingChecklist } from '../onboarding/onboarding-checklist';
import { TooltipTour } from '../onboarding/tooltip-tour';
export function AppLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    return (_jsxs("div", { className: "flex h-screen bg-pf-base text-pf-text overflow-hidden", children: [_jsx("div", { className: "hidden md:block", children: _jsx(Sidebar, { collapsed: collapsed, onToggle: () => setCollapsed((v) => !v) }) }), mobileOpen && (_jsxs("div", { className: "fixed inset-0 z-40 md:hidden", children: [_jsx("div", { className: "absolute inset-0 bg-black/50", onClick: () => setMobileOpen(false) }), _jsx("div", { className: "relative z-50 h-full", children: _jsx(Sidebar, { collapsed: false, onToggle: () => setMobileOpen(false) }) })] })), _jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("button", { onClick: () => setMobileOpen(true), className: "p-2 ml-2 rounded-pf-sm text-pf-text-muted hover:bg-pf-elevated hover:text-pf-text transition-colors md:hidden", "aria-label": "Open menu", children: _jsx(Menu, { size: 20 }) }), _jsx("div", { className: "flex-1", children: _jsx(Topbar, {}) })] }), _jsx("main", { className: "flex-1 overflow-y-auto", children: _jsx(Outlet, {}) })] }), _jsx(OnboardingChecklist, {}), _jsx(TooltipTour, {})] }));
}
