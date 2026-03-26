import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Trophy, TrendingUp } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const PERIODS = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'All Time', value: 'allTime' },
];
function pnlColor(pnl) {
    const v = parseFloat(pnl);
    if (isNaN(v))
        return 'text-pf-text-secondary';
    return v >= 0 ? 'text-pf-success' : 'text-pf-danger';
}
function pnlSign(pnl) {
    const v = parseFloat(pnl);
    if (isNaN(v))
        return pnl;
    const sign = v > 0 ? '+' : '';
    return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function rankMedal(rank) {
    if (rank === 1)
        return '\u{1F947}';
    if (rank === 2)
        return '\u{1F948}';
    if (rank === 3)
        return '\u{1F949}';
    return '';
}
function rankColor(rank) {
    if (rank === 1)
        return 'text-pf-warning'; /* gold */
    if (rank === 2)
        return 'text-gray-400';
    if (rank === 3)
        return 'text-amber-700'; /* bronze – no pf-* equivalent */
    return 'text-pf-text-muted';
}
function userInitials(e) {
    return (e.displayName ?? e.username).slice(0, 2).toUpperCase();
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [period, setPeriod] = useState('7d');
    const load = useCallback(async (p, per) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/leaderboard?period=${per}&page=${p}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setEntries(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load data');
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(page, period); }, [page, period, load]);
    function changePeriod(p) {
        setPeriod(p);
        setPage(1);
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Leaderboard" }), !loading && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [total, " traders"] })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: PERIODS.map(p => (_jsx("button", { onClick: () => changePeriod(p.value), className: `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${period === p.value
                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                        : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: p.label }, p.value))) }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium text-right w-16", children: "Rank" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Trader" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Score" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "P&L" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Win Rate" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Trades" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: loading ? (Array.from({ length: 10 }, (_, i) => (_jsx("tr", { children: Array.from({ length: 6 }, (_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-3 bg-pf-overlay rounded animate-pulse" }) }, j))) }, i)))) : entries.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: _jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(Trophy, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No data yet" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Start trading to appear on the leaderboard." })] }) }) })) : (entries.map(entry => (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-right", children: _jsx("div", { className: `${rankColor(entry.rank)}`, children: rankMedal(entry.rank) ? (_jsx("span", { className: "text-lg", children: rankMedal(entry.rank) })) : (_jsx("span", { className: "font-mono text-xs", children: entry.rank })) }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs(Link, { to: `/profile/${entry.username}`, className: "flex items-center gap-3 hover:text-pf-cyan-400 transition-colors", children: [entry.avatarUrl ? (_jsx("img", { src: entry.avatarUrl, alt: `${entry.displayName ?? entry.username} avatar`, className: "size-8 rounded-full object-cover", width: 32, height: 32, loading: "lazy" })) : (_jsx("div", { className: "size-8 rounded-full bg-pf-surface flex items-center justify-center text-[11px] font-semibold text-pf-cyan-400", children: userInitials(entry) })), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-pf-text", children: entry.displayName ?? entry.username }), entry.displayName && (_jsxs("div", { className: "text-xs text-pf-text-muted", children: ["@", entry.username] }))] })] }) }), _jsx("td", { className: "px-4 py-3 text-right", children: entry.score != null ? (_jsxs("span", { className: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold ${entry.score >= 80 ? 'text-pf-success bg-pf-success/10' :
                                                    entry.score >= 60 ? 'text-pf-cyan-400 bg-pf-cyan-500/10' :
                                                        entry.score >= 40 ? 'text-pf-warning bg-pf-warning/10' :
                                                            'text-pf-danger bg-pf-danger/10'}`, children: [_jsx(TrendingUp, { className: "size-3" }), entry.score] })) : (_jsx("span", { className: "text-xs text-pf-text-muted", children: "\u2014" })) }), _jsx("td", { className: `px-4 py-3 text-right font-mono ${pnlColor(entry.pnl)}`, children: pnlSign(entry.pnl) }), _jsxs("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: [entry.winRate, "%"] }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: entry.tradeCount })] }, entry.userId)))) })] }) }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }));
}
