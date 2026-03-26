import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, User, BarChart3, Cpu, FileText, FlaskConical, Bell, } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
const CHECKLIST_ITEMS = [
    {
        key: 'completeProfile',
        label: 'Complete your profile',
        description: 'Add a display name and bio to stand out.',
        icon: _jsx(User, { className: "size-4" }),
        route: '/settings',
    },
    {
        key: 'browseMarkets',
        label: 'Browse markets',
        description: 'Explore prediction markets to trade on.',
        icon: _jsx(BarChart3, { className: "size-4" }),
        route: '/markets',
    },
    {
        key: 'createStrategy',
        label: 'Create your first strategy',
        description: 'Use the visual builder to design a trading strategy.',
        icon: _jsx(Cpu, { className: "size-4" }),
        route: '/strategies/new',
    },
    {
        key: 'runPaperTrade',
        label: 'Run a paper trade',
        description: 'Test your strategy in simulation mode.',
        icon: _jsx(FileText, { className: "size-4" }),
        route: '/portfolio',
    },
    {
        key: 'runBacktest',
        label: 'Run a backtest',
        description: 'Replay your strategy against historical data.',
        icon: _jsx(FlaskConical, { className: "size-4" }),
        route: '/backtest',
    },
    {
        key: 'setupNotifications',
        label: 'Set up notifications',
        description: 'Configure alerts for orders and strategies.',
        icon: _jsx(Bell, { className: "size-4" }),
        route: '/settings',
    },
];
const STORAGE_KEY = 'polyforge:onboarding:completed';
const DISMISSED_KEY = 'polyforge:onboarding:dismissed';
/* ─── Component ──────────────────────────────────────────────────────── */
export function OnboardingChecklist() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [completed, setCompleted] = useState({});
    const [collapsed, setCollapsed] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    // Load state from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored)
                setCompleted(JSON.parse(stored));
            const wasDismissed = localStorage.getItem(DISMISSED_KEY);
            if (wasDismissed === 'true')
                setDismissed(true);
        }
        catch { /* ignore parse errors */ }
    }, []);
    // Only show for users who joined within the last 7 days
    if (!user)
        return null;
    const joinDate = new Date(user.createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    if (joinDate < sevenDaysAgo)
        return null;
    // Don't show if dismissed
    if (dismissed)
        return null;
    const completedCount = CHECKLIST_ITEMS.filter(item => completed[item.key]).length;
    const allDone = completedCount === CHECKLIST_ITEMS.length;
    // Auto-dismiss when all items checked
    if (allDone) {
        setTimeout(() => {
            setDismissed(true);
            localStorage.setItem(DISMISSED_KEY, 'true');
        }, 2000);
    }
    function toggleItem(key) {
        const next = { ...completed, [key]: !completed[key] };
        setCompleted(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    function handleDismiss() {
        setDismissed(true);
        localStorage.setItem(DISMISSED_KEY, 'true');
    }
    function handleNavigate(route) {
        navigate(route);
    }
    return (_jsxs("div", { className: "fixed bottom-4 right-4 z-50 w-80 bg-pf-elevated border border-pf-border rounded-pf-lg shadow-2xl animate-fade-in", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-semibold text-pf-text", children: "Getting Started" }), _jsxs("span", { className: "text-[10px] px-1.5 py-0.5 rounded-full bg-pf-cyan-500/15 text-pf-cyan-400 font-medium", children: [completedCount, "/", CHECKLIST_ITEMS.length] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setCollapsed(!collapsed), className: "p-1 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text", "aria-label": collapsed ? 'Expand checklist' : 'Collapse checklist', children: collapsed ? _jsx(ChevronUp, { className: "size-4" }) : _jsx(ChevronDown, { className: "size-4" }) }), _jsx("button", { onClick: handleDismiss, className: "p-1 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text", "aria-label": "Dismiss checklist", children: _jsx(X, { className: "size-4" }) })] })] }), _jsx("div", { className: "px-4 pt-2", children: _jsx("div", { className: "w-full h-1.5 bg-pf-overlay rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-pf-cyan-500 rounded-full transition-all duration-500", style: { width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` } }) }) }), !collapsed && (_jsx("div", { className: "px-4 py-2 space-y-1 max-h-[320px] overflow-y-auto scrollbar-none", children: CHECKLIST_ITEMS.map(item => (_jsxs("div", { className: "flex items-start gap-2.5 py-2 group", children: [_jsx("button", { onClick: () => toggleItem(item.key), className: "mt-0.5 shrink-0 transition-colors", "aria-label": `Mark "${item.label}" as ${completed[item.key] ? 'incomplete' : 'complete'}`, children: completed[item.key] ? (_jsx(CheckCircle2, { className: "size-4 text-pf-success" })) : (_jsx(Circle, { className: "size-4 text-pf-text-muted group-hover:text-pf-cyan-400 transition-colors" })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("button", { onClick: () => handleNavigate(item.route), className: `text-sm text-left font-medium transition-colors ${completed[item.key]
                                        ? 'text-pf-text-muted line-through'
                                        : 'text-pf-text hover:text-pf-cyan-400'}`, children: item.label }), !completed[item.key] && (_jsx("p", { className: "text-xs text-pf-text-secondary mt-0.5 leading-relaxed", children: item.description }))] })] }, item.key))) })), !collapsed && (_jsx("div", { className: "px-4 py-2.5 border-t border-pf-border-subtle", children: _jsx("button", { onClick: () => {
                        const event = new CustomEvent('polyforge:start-tour');
                        window.dispatchEvent(event);
                    }, className: "text-xs text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors font-medium", children: "Take a tour of the platform" }) })), allDone && (_jsx("div", { className: "px-4 py-3 text-center", children: _jsx("p", { className: "text-sm text-pf-success font-medium", children: "All done! You're ready to trade." }) }))] }));
}
