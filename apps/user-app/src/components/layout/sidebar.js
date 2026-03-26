import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router';
import { BarChart3, Zap, Wallet, ClipboardList, FlaskConical, Compass, Newspaper, Fish, UserPlus, Trophy, Code, HelpCircle, ChevronLeft, ChevronRight, Settings, TrendingUp, } from 'lucide-react';
const navSections = [
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
export function Sidebar({ collapsed, onToggle }) {
    const [myScore, setMyScore] = useState(null);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/scores/me', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.score)
                        setMyScore(data.score.score);
                }
            }
            catch { /* ignore */ }
        })();
    }, []);
    return (_jsxs("aside", { className: "flex flex-col h-full bg-pf-elevated border-r border-pf-border transition-all duration-200", style: { width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240 }, children: [_jsx("div", { className: "flex items-center gap-3 px-4 h-14 border-b border-pf-border", children: _jsxs(Link, { to: "/markets", className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: "text-pf-cyan-500", children: _jsxs("svg", { className: "shrink-0", width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "currentColor", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "currentColor" })] }) }), !collapsed && (_jsx("span", { className: "text-pf-text font-semibold text-base tracking-tight", children: "Polyforge" }))] }) }), _jsx("nav", { className: "flex-1 overflow-y-auto py-2 px-2 space-y-4", children: navSections.map((section) => (_jsxs("div", { children: [!collapsed && (_jsx("div", { className: "px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-pf-text-secondary", children: section.title })), _jsx("div", { className: "space-y-0.5", children: section.items.map((item) => (_jsxs(NavLink, { to: item.route, title: collapsed ? item.label : undefined, className: ({ isActive }) => `flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 ${isActive
                                    ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                                    : 'text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text'}`, children: [_jsx(item.icon, { size: 18, className: "shrink-0" }), !collapsed && _jsx("span", { children: item.label })] }, item.route))) })] }, section.title))) }), _jsxs("div", { className: "border-t border-pf-border px-2 py-2 space-y-0.5", children: [myScore !== null && (_jsxs(Link, { to: "/profile/me", className: "flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text", title: collapsed ? `Edge Rating: ${myScore}` : undefined, children: [_jsx(TrendingUp, { size: 18, className: `shrink-0 ${myScore >= 80 ? 'text-pf-success' :
                                    myScore >= 60 ? 'text-pf-cyan-400' :
                                        myScore >= 40 ? 'text-pf-warning' :
                                            'text-pf-danger'}` }), !collapsed && (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { children: "Edge Rating" }), _jsx("span", { className: `font-mono font-bold text-xs ${myScore >= 80 ? 'text-pf-success' :
                                            myScore >= 60 ? 'text-pf-cyan-400' :
                                                myScore >= 40 ? 'text-pf-warning' :
                                                    'text-pf-danger'}`, children: myScore })] }))] })), _jsx("button", { onClick: onToggle, className: "flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text w-full", "aria-label": "Toggle sidebar", children: collapsed ? (_jsx(ChevronRight, { size: 18, className: "shrink-0" })) : (_jsx(ChevronLeft, { size: 18, className: "shrink-0" })) }), _jsxs(NavLink, { to: "/settings", className: ({ isActive }) => `flex items-center gap-3 px-2 py-2 rounded-pf-sm text-sm transition-colors duration-150 ${isActive
                            ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                            : 'text-pf-text-secondary hover:bg-pf-surface hover:text-pf-text'}`, children: [_jsx(Settings, { size: 18, className: "shrink-0" }), !collapsed && _jsx("span", { children: "Settings" })] })] })] }));
}
