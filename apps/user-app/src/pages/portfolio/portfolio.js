import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, } from 'recharts';
import { Wallet, BarChart3, RefreshCw, Loader2, AlertTriangle, Fuel, } from 'lucide-react';
import { toast } from 'sonner';
import { useThemeStore } from '@/stores/theme-store';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const PERIODS = [
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: 'All', value: 'allTime' },
];
function pnlColor(val) {
    const n = parseFloat(val);
    if (n > 0)
        return 'text-pf-success';
    if (n < 0)
        return 'text-pf-danger';
    return 'text-pf-text-muted';
}
function pnlBorderColor(val) {
    const n = parseFloat(val);
    if (n > 0)
        return 'border-l-pf-success';
    if (n < 0)
        return 'border-l-pf-danger';
    return 'border-l-pf-text-muted';
}
function formatPnl(val) {
    const n = parseFloat(val);
    return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
}
function winRatePct(val) {
    return `${(parseFloat(val) * 100).toFixed(1)}%`;
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-pulse h-20" });
}
function TableSkeleton() {
    return (_jsx("div", { className: "space-y-2 p-4", children: [1, 2, 3].map(i => (_jsx("div", { className: "h-10 bg-pf-overlay rounded animate-pulse" }, i))) }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    // Memoize CSS variable reads — avoids layout-triggering getComputedStyle on every render
    const { isDark } = useThemeStore();
    const themeColors = useMemo(() => {
        const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
        return {
            textMuted: s?.getPropertyValue('--color-pf-text-muted').trim() || '#445E7A',
            bgElevated: s?.getPropertyValue('--color-pf-elevated').trim() || '#111D2E',
            borderColor: s?.getPropertyValue('--color-pf-border').trim() || '#1E3350',
            textPrimary: s?.getPropertyValue('--color-pf-text').trim() || '#E8EDF5',
        };
    }, [isDark]);
    const { textMuted, bgElevated, borderColor, textPrimary } = themeColors;
    const [tab, setTab] = useState('live');
    const [period, setPeriodState] = useState('7d');
    const [portfolio, setPortfolio] = useState(null);
    const [pnl, setPnl] = useState(null);
    const [paper, setPaper] = useState(null);
    const [loadingPortfolio, setLoadingPortfolio] = useState(true);
    const [loadingChart, setLoadingChart] = useState(true);
    const [loadingPaper, setLoadingPaper] = useState(false);
    const [closingPosition, setClosingPosition] = useState({});
    const [redeemingPosition, setRedeemingPosition] = useState({});
    const [resettingPaper, setResettingPaper] = useState(false);
    const loadPortfolio = useCallback(async () => {
        setLoadingPortfolio(true);
        try {
            const res = await fetch('/api/v1/portfolio', { credentials: 'include' });
            if (res.ok)
                setPortfolio(await res.json());
        }
        catch {
            toast.error('Failed to load data');
        }
        setLoadingPortfolio(false);
    }, []);
    const loadChart = useCallback(async (p) => {
        setLoadingChart(true);
        try {
            const res = await fetch(`/api/v1/portfolio/pnl?period=${p}`, { credentials: 'include' });
            if (res.ok)
                setPnl(await res.json());
        }
        catch {
            toast.error('Failed to load data');
        }
        setLoadingChart(false);
    }, []);
    const loadPaper = useCallback(async () => {
        setLoadingPaper(true);
        try {
            const res = await fetch('/api/v1/paper/summary', { credentials: 'include' });
            if (res.ok)
                setPaper(await res.json());
        }
        catch {
            toast.error('Failed to load data');
        }
        setLoadingPaper(false);
    }, []);
    useEffect(() => {
        let cancelled = false;
        if (!cancelled) {
            loadPortfolio();
            loadChart(period);
        }
        return () => { cancelled = true; };
    }, [loadPortfolio, loadChart, period]);
    function setPeriod(p) {
        setPeriodState(p);
        // loadChart will be called by the useEffect watching period
    }
    function handleTabChange(t) {
        setTab(t);
        if (t === 'paper' && !paper)
            loadPaper();
    }
    async function closePosition(pos) {
        setClosingPosition(prev => ({ ...prev, [pos.id]: true }));
        try {
            const res = await fetch('/api/v1/orders/close-position', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tokenId: pos.tokenId }),
            });
            if (res.ok) {
                loadPortfolio();
            }
            else if (res.status === 451) {
                toast.error('Trading is not available in your region');
            }
            else {
                const err = await res.json().catch(() => ({}));
                if (err.code === 'GEO_BLOCKED') {
                    toast.error('Trading is not available in your region');
                }
                else {
                    toast.error(err.message ?? 'Failed to close position');
                }
            }
        }
        catch {
            toast.error('Failed to close position');
        }
        setClosingPosition(prev => ({ ...prev, [pos.id]: false }));
    }
    async function redeemPosition(pos) {
        setRedeemingPosition(prev => ({ ...prev, [pos.id]: true }));
        try {
            const res = await fetch('/api/v1/orders/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ positionId: pos.id }),
            });
            if (res.ok) {
                toast.success('Position redeemed');
                loadPortfolio();
            }
            else {
                const err = await res.json().catch(() => ({}));
                if (err.code === 'GEO_BLOCKED') {
                    toast.error('Redemption is not available in your region');
                }
                else {
                    toast.error(err.message ?? 'Failed to redeem position');
                }
            }
        }
        catch {
            toast.error('Failed to redeem position');
        }
        setRedeemingPosition(prev => ({ ...prev, [pos.id]: false }));
    }
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    async function resetPaper() {
        setShowResetConfirm(false);
        setResettingPaper(true);
        try {
            const res = await fetch('/api/v1/paper/reset', { method: 'POST', credentials: 'include' });
            if (res.ok)
                setPaper({ pnl: '0', positions: [], orderCount: 0 });
        }
        catch {
            toast.error('Failed to reset paper account');
        }
        setResettingPaper(false);
    }
    // Chart data — memoized to avoid recomputing on every render
    const chartData = useMemo(() => (pnl?.snapshots ?? []).map(s => ({
        time: new Date(s.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        pnl: parseFloat(s.pnl),
    })), [pnl?.snapshots]);
    const isProfitable = parseFloat(pnl?.totalPnl ?? '0') >= 0;
    const chartColor = isProfitable ? '#10B981' : '#EF4444';
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Portfolio" }), _jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pf-success/10 text-pf-success text-xs font-medium border border-pf-success/20", children: [_jsx(Fuel, { className: "size-3" }), "Gasless"] })] }), _jsxs("div", { className: "flex bg-pf-surface rounded-pf border border-pf-border-subtle", children: [_jsx("button", { onClick: () => handleTabChange('live'), className: `px-4 py-1.5 text-sm font-medium rounded-pf transition-colors ${tab === 'live' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-secondary hover:text-pf-text'}`, children: "Live" }), _jsx("button", { onClick: () => handleTabChange('paper'), className: `px-4 py-1.5 text-sm font-medium rounded-pf transition-colors ${tab === 'paper' ? 'bg-pf-elevated text-pf-text' : 'text-pf-text-secondary hover:text-pf-text'}`, children: "Paper" })] })] }), tab === 'live' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: loadingPortfolio ? ([1, 2, 3, 4].map(i => _jsx(CardSkeleton, {}, i))) : portfolio ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: `bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 ${pnlBorderColor(portfolio.totalUnrealizedPnl)}`, children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Unrealized P&L" }), _jsx("span", { className: `block mt-1 text-xl font-mono font-semibold ${pnlColor(portfolio.totalUnrealizedPnl)}`, children: formatPnl(portfolio.totalUnrealizedPnl) })] }), _jsxs("div", { className: `bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 ${pnlBorderColor(portfolio.totalRealizedPnl)}`, children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Realized P&L" }), _jsx("span", { className: `block mt-1 text-xl font-mono font-semibold ${pnlColor(portfolio.totalRealizedPnl)}`, children: formatPnl(portfolio.totalRealizedPnl) })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 border-l-cyan-500", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Win Rate" }), _jsx("span", { className: "block mt-1 text-xl font-mono font-semibold text-pf-cyan-400", children: winRatePct(pnl?.winRate ?? '0') })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 border-l-4 border-l-pf-text", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Open Positions" }), _jsx("span", { className: "block mt-1 text-xl font-mono font-semibold text-pf-text", children: portfolio.positions.length })] })] })) : (_jsxs("div", { className: "col-span-full bg-pf-elevated border border-pf-danger/20 rounded-pf-lg p-6 text-center", children: [_jsx(AlertTriangle, { className: "mx-auto mb-3 text-pf-danger opacity-60", size: 32 }), _jsx("p", { className: "text-sm font-medium text-pf-text mb-1", children: "Failed to load portfolio" }), _jsx("p", { className: "text-xs text-pf-text-muted mb-4", children: "Something went wrong while fetching your data." }), _jsx("button", { onClick: loadPortfolio, className: "px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: "Retry" })] })) }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle", children: [_jsx("span", { className: "text-sm font-medium text-pf-text", children: "P&L Over Time" }), _jsx("div", { className: "flex gap-1", children: PERIODS.map(p => (_jsx("button", { onClick: () => setPeriod(p.value), className: `px-2.5 py-1 text-xs font-medium rounded-pf transition-colors ${period === p.value
                                                ? 'bg-pf-cyan-500/15 text-pf-cyan-400'
                                                : 'text-pf-text-secondary hover:text-pf-text'}`, children: p.label }, p.value))) })] }), loadingChart ? (_jsx("div", { className: "h-64 animate-pulse bg-pf-overlay m-4 rounded" })) : chartData.length > 0 ? (_jsx("div", { className: "h-64 px-2 py-4", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: chartData, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "pnlGradient", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: chartColor, stopOpacity: 0.15 }), _jsx("stop", { offset: "100%", stopColor: chartColor, stopOpacity: 0 })] }) }), _jsx(XAxis, { dataKey: "time", tick: { fill: textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fill: textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }, axisLine: false, tickLine: false, tickFormatter: v => `$${v}` }), _jsx(Tooltip, { contentStyle: {
                                                    background: bgElevated, border: `1px solid ${borderColor}`, borderRadius: 6,
                                                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                                                }, labelStyle: { color: textPrimary }, formatter: (value) => [`${value >= 0 ? '+' : ''}$${value.toFixed(2)}`, 'P&L'] }), _jsx(Area, { type: "monotone", dataKey: "pnl", stroke: chartColor, strokeWidth: 1.5, fill: "url(#pnlGradient)", dot: false })] }) }) })) : (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(BarChart3, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No P&L data yet" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "P&L data will appear once your strategies generate trades." })] }))] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg", children: [_jsx("div", { className: "px-4 py-3 border-b border-pf-border-subtle", children: _jsx("span", { className: "text-sm font-medium text-pf-text", children: "Open Positions" }) }), loadingPortfolio ? (_jsx(TableSkeleton, {})) : (portfolio?.positions ?? []).length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(Wallet, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No open positions" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Start a strategy to build positions." })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Market" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Side" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Size" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Avg Entry" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Current" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Unreal. P&L" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: portfolio.positions.map(pos => (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 max-w-[200px]", children: _jsx("span", { className: "text-pf-text line-clamp-1", title: pos.marketTitle, children: pos.marketTitle }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${pos.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: pos.side }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: parseFloat(pos.size).toLocaleString() }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: parseFloat(pos.avgEntryPrice).toFixed(3) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-cyan-400", children: pos.currentPrice && pos.currentPrice !== '0' ? `$${parseFloat(pos.currentPrice).toFixed(3)}` : _jsx("span", { className: "text-pf-text-muted", children: "N/A" }) }), _jsx("td", { className: `px-4 py-3 text-right font-mono ${pnlColor(pos.unrealizedPnl)}`, children: formatPnl(pos.unrealizedPnl) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${pos.resolutionStatus === 'UNRESOLVED'
                                                                ? 'bg-pf-cyan-500/10 text-pf-cyan-400'
                                                                : 'bg-pf-overlay text-pf-text-muted'}`, children: pos.resolutionStatus }) }), _jsxs("td", { className: "px-4 py-3 text-right flex items-center justify-end gap-2", children: [pos.resolutionStatus === 'UNRESOLVED' && (_jsx("button", { onClick: () => closePosition(pos), disabled: closingPosition[pos.id], className: "text-xs text-pf-danger hover:text-pf-danger disabled:opacity-50 transition-colors", children: closingPosition[pos.id] ? _jsx(Loader2, { className: "size-3 animate-spin" }) : 'Close' })), pos.resolutionStatus === 'RESOLVED' && (_jsx("button", { onClick: () => redeemPosition(pos), disabled: redeemingPosition[pos.id], className: "text-xs text-pf-success hover:text-pf-success disabled:opacity-50 transition-colors", children: redeemingPosition[pos.id] ? _jsx(Loader2, { className: "size-3 animate-spin" }) : 'Redeem' }))] })] }, pos.id))) })] }) }))] })] })), tab === 'paper' && (_jsx(_Fragment, { children: loadingPaper ? (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [1, 2, 3].map(i => _jsx(CardSkeleton, {}, i)) }), _jsx(TableSkeleton, {})] })) : paper ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Paper P&L" }), _jsx("span", { className: `block mt-1 text-xl font-mono font-semibold ${pnlColor(paper.pnl)}`, children: formatPnl(paper.pnl) })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Positions" }), _jsx("span", { className: "block mt-1 text-xl font-mono font-semibold text-pf-text", children: paper.positions.length })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Total Orders" }), _jsx("span", { className: "block mt-1 text-xl font-mono font-semibold text-pf-text", children: paper.orderCount })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 flex items-end justify-end", children: [_jsxs("button", { onClick: () => setShowResetConfirm(true), disabled: resettingPaper, className: "flex items-center gap-1.5 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-50 transition-colors", children: [_jsx(RefreshCw, { className: `size-3.5 ${resettingPaper ? 'animate-spin' : ''}` }), "Reset Paper Account"] }), showResetConfirm && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", onClick: () => setShowResetConfirm(false), onKeyDown: (e) => { if (e.key === 'Escape')
                                                setShowResetConfirm(false); }, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "reset-dialog-title", className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 max-w-sm mx-4 shadow-pf-lg", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(AlertTriangle, { className: "size-5 text-pf-danger" }), _jsx("h3", { id: "reset-dialog-title", className: "text-sm font-semibold text-pf-text", children: "Reset Paper Account" })] }), _jsx("p", { className: "text-sm text-pf-text-secondary mb-4", children: "This will delete all paper positions and orders. This cannot be undone." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => setShowResetConfirm(false), className: "px-3 py-1.5 text-sm rounded-pf-sm border border-pf-border text-pf-text-secondary hover:bg-pf-surface transition-colors", children: "Cancel" }), _jsx("button", { onClick: resetPaper, className: "px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger text-white hover:bg-pf-danger/90 transition-colors", children: "Reset" })] })] }) }))] })] }), paper.positions.length === 0 ? (_jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg", children: _jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(Wallet, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No paper positions" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Start a strategy in Paper mode to simulate trades." })] }) })) : (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg", children: [_jsx("div", { className: "px-4 py-3 border-b border-pf-border-subtle", children: _jsx("span", { className: "text-sm font-medium text-pf-text", children: "Paper Positions" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Token" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Side" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Size" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Unreal. P&L" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: paper.positions.map(pos => (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "font-mono text-xs text-pf-text-secondary", children: pos.tokenId }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${pos.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: pos.side }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: parseFloat(pos.size).toLocaleString() }), _jsx("td", { className: `px-4 py-3 text-right font-mono ${pnlColor(pos.unrealizedPnl)}`, children: formatPnl(pos.unrealizedPnl) })] }, pos.tokenId))) })] }) })] }))] })) : null }))] }));
}
