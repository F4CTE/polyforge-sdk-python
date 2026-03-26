import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Compass, Heart, GitFork, TrendingUp, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const SORT_OPTIONS = [
    { label: 'Popular', value: 'popular' },
    { label: 'Newest', value: 'newest' },
    { label: 'Top P&L', value: 'top_pnl' },
    { label: 'Most Forked', value: 'most_forked' },
];
function authorInitials(s) {
    return (s.author.displayName ?? s.author.username).slice(0, 2).toUpperCase();
}
function execLabel(mode) {
    const map = { TICK: 'Tick', EVENT: 'Event' };
    return map[mode] ?? mode;
}
// P&L data removed — synthetic financial metrics must not be shown to users.
// TODO: Replace with real P&L from API when available.
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer", children: [_jsx("div", { className: "h-3.5 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-2.5 bg-pf-overlay rounded w-[90%]" }), _jsx("div", { className: "h-2.5 bg-pf-overlay rounded w-[75%]" }), _jsxs("div", { className: "flex gap-1.5", children: [_jsx("div", { className: "h-5 w-12 bg-pf-overlay rounded-full" }), _jsx("div", { className: "h-5 w-12 bg-pf-overlay rounded-full" })] })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [strategies, setStrategies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState('popular');
    const load = useCallback(async (p, s) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/discover?sort=${s}&page=${p}&limit=12`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setStrategies(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load data');
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(page, sort); }, [page, sort, load]);
    function changeSort(s) {
        setSort(s);
        setPage(1);
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Discover" }), !loading && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [total, " strategies"] })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: SORT_OPTIONS.map(opt => (_jsx("button", { onClick: () => changeSort(opt.value), className: `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${sort === opt.value
                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                        : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: opt.label }, opt.value))) }), loading && strategies.length === 0 ? (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: Array.from({ length: 9 }, (_, i) => _jsx(CardSkeleton, {}, i)) })) : strategies.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Compass, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No strategies found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Be the first to publish a public strategy." })] })) : (_jsx("div", { className: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children ${loading ? 'opacity-60' : ''}`, children: strategies.map(s => {
                    return (_jsxs(Link, { to: `/strategies/${s.id}`, className: "group block bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [s.author.avatarUrl ? (_jsx("img", { src: s.author.avatarUrl, alt: `${s.author.displayName ?? s.author.username} avatar`, className: "size-7 rounded-full object-cover", width: 28, height: 28, loading: "lazy" })) : (_jsx("div", { className: "size-7 rounded-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center text-[10px] font-bold text-pf-cyan-400", children: authorInitials(s) })), _jsx(Link, { to: `/profile/${s.author.username}`, onClick: e => e.stopPropagation(), className: "text-xs text-pf-text-secondary hover:text-pf-cyan-400 transition-colors", children: s.author.displayName ?? s.author.username }), s.author.score != null && s.author.score > 0 && (_jsxs("span", { className: `inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${s.author.score >= 80 ? 'text-pf-success bg-pf-success/10 border-pf-success/20' :
                                            s.author.score >= 60 ? 'text-pf-cyan-400 bg-pf-cyan-500/10 border-pf-cyan-500/20' :
                                                s.author.score >= 40 ? 'text-pf-warning bg-pf-warning/10 border-pf-warning/20' :
                                                    'text-pf-text-muted bg-pf-overlay border-pf-border'}`, children: [_jsx(TrendingUp, { className: "size-2.5" }), s.author.score] })), _jsx("span", { className: "ml-auto text-[10px] px-1.5 py-0.5 rounded bg-pf-overlay text-pf-text-muted", children: execLabel(s.execMode) })] }), _jsx("div", { className: "text-sm font-medium text-pf-text group-hover:text-pf-cyan-400 transition-colors mb-1", children: s.name }), s.description && (_jsx("div", { className: "text-xs text-pf-text-muted line-clamp-2 mb-3", children: s.description })), s.tags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1 mb-3", children: s.tags.slice(0, 4).map(tag => (_jsx("span", { className: "px-1.5 py-0.5 rounded-full text-[10px] bg-pf-overlay text-pf-text-muted", children: tag }, tag))) })), _jsx("div", { className: "border-t border-pf-border-subtle my-2" }), _jsxs("div", { className: "flex items-center gap-3 text-sm text-pf-text-muted pt-1", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Heart, { className: "size-3.5" }), " ", s.likeCount] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(GitFork, { className: "size-3.5" }), " ", s.forkCount] }), _jsx("span", { className: "ml-auto text-[11px] text-pf-text-muted", children: "\u2022" }), _jsx("span", { className: "font-mono text-[11px]", children: formatDate(s.createdAt) })] })] }, s.id));
                }) })), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }));
}
