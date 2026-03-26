import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Fish, Copy, Search, UserPlus, UserCheck, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const MIN_SIZES = [
    { label: '$5K+', value: '5000' },
    { label: '$10K+', value: '10000' },
    { label: '$50K+', value: '50000' },
    { label: '$100K+', value: '100000' },
];
function truncateAddress(addr) {
    if (addr.length <= 12)
        return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60)
        return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast.success('Address copied'), () => toast.error('Failed to copy'));
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-3.5 bg-pf-overlay rounded w-[120px]" }), _jsx("div", { className: "h-5 w-16 bg-pf-overlay rounded-full ml-auto" })] }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[80%]" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "h-5 w-12 bg-pf-overlay rounded-full" }), _jsx("div", { className: "h-5 w-12 bg-pf-overlay rounded-full" })] }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[50%]" })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [minSize, setMinSize] = useState('10000');
    const [category, setCategory] = useState('');
    const [walletSearch, setWalletSearch] = useState('');
    const [followingSet, setFollowingSet] = useState(new Set());
    const refreshRef = useRef(null);
    const abortRef = useRef(null);
    const load = useCallback(async (p, min, cat, wallet) => {
        // Abort any in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), minSize: min });
            if (cat)
                params.set('category', cat);
            if (wallet)
                params.set('wallet', wallet);
            const res = await fetch(`/api/v1/whales/feed?${params}`, { credentials: 'include', signal: controller.signal });
            if (res.ok) {
                const data = await res.json();
                setTrades(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
                const following = new Set();
                data.data.forEach(t => { if (t.isFollowing)
                    following.add(t.walletAddress); });
                setFollowingSet(prev => {
                    const merged = new Set(prev);
                    following.forEach(a => merged.add(a));
                    return merged;
                });
            }
        }
        catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError')
                return;
            toast.error('Failed to load whale trades');
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(page, minSize, category, walletSearch); }, [page, minSize, category, walletSearch, load]);
    // Auto-refresh every 10 seconds — guarded against concurrent fetches
    useEffect(() => {
        refreshRef.current = setInterval(() => {
            if (!loading)
                load(page, minSize, category, walletSearch);
        }, 10_000);
        return () => { if (refreshRef.current)
            clearInterval(refreshRef.current); };
    }, [page, minSize, category, walletSearch, load, loading]);
    function changeMinSize(s) { setMinSize(s); setPage(1); }
    function changeCategory(c) { setCategory(c); setPage(1); }
    async function toggleFollow(address) {
        const isFollowing = followingSet.has(address);
        try {
            const res = await fetch(`/api/v1/whales/${address}/${isFollowing ? 'unfollow' : 'follow'}`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                setFollowingSet(prev => {
                    const next = new Set(prev);
                    if (isFollowing)
                        next.delete(address);
                    else
                        next.add(address);
                    return next;
                });
                toast.success(isFollowing ? 'Unfollowed whale' : 'Following whale');
            }
        }
        catch {
            toast.error('Action failed');
        }
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Fish, { className: "size-6 text-pf-cyan-400" }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Whale Tracker" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Link, { to: "/whales/following", className: "text-xs text-pf-text-secondary hover:text-pf-cyan-400 transition-colors", children: "Following" }), !loading && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [total, " trades"] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("div", { className: "flex gap-1.5", children: MIN_SIZES.map(s => (_jsx("button", { onClick: () => changeMinSize(s.value), className: `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${minSize === s.value
                                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: s.label }, s.value))) }), _jsxs("select", { value: category, onChange: e => changeCategory(e.target.value), className: "px-3 py-1.5 rounded-pf-sm text-xs bg-pf-elevated text-pf-text-secondary border border-pf-border hover:border-pf-border-strong transition-colors", children: [_jsx("option", { value: "", children: "All Categories" }), _jsx("option", { value: "crypto", children: "Crypto" }), _jsx("option", { value: "politics", children: "Politics" }), _jsx("option", { value: "sports", children: "Sports" }), _jsx("option", { value: "entertainment", children: "Entertainment" }), _jsx("option", { value: "science", children: "Science" })] }), _jsxs("div", { className: "relative flex-1 min-w-[200px] max-w-xs", children: [_jsx(Search, { className: "absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-pf-text-muted" }), _jsx("input", { type: "text", placeholder: "Search wallet...", value: walletSearch, onChange: e => { setWalletSearch(e.target.value); setPage(1); }, className: "w-full pl-8 pr-3 py-1.5 rounded-pf-sm text-xs bg-pf-elevated text-pf-text border border-pf-border hover:border-pf-border-strong focus:border-pf-cyan-500/50 focus:outline-none transition-colors placeholder:text-pf-text-muted" })] })] }), loading && trades.length === 0 ? (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: Array.from({ length: 6 }, (_, i) => _jsx(CardSkeleton, {}, i)) })) : trades.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Fish, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No whale trades detected yet" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Adjust filters or check back later." })] })) : (_jsx("div", { className: `grid grid-cols-1 md:grid-cols-2 gap-4 ${loading ? 'opacity-60' : ''}`, children: trades.map(trade => (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Link, { to: `/whales/${trade.walletAddress}`, className: "font-mono text-sm text-pf-text hover:text-pf-cyan-400 transition-colors", children: truncateAddress(trade.walletAddress) }), _jsx("button", { onClick: () => copyToClipboard(trade.walletAddress), className: "text-pf-text-muted hover:text-pf-text transition-colors", title: "Copy address", children: _jsx(Copy, { className: "size-3.5" }) })] }), _jsx("span", { className: "text-[11px] text-pf-text-muted", children: timeAgo(trade.timestamp) })] }), _jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: "text-sm text-pf-text font-medium truncate", children: trade.marketName }), _jsx("span", { className: "px-1.5 py-0.5 rounded-full text-[10px] bg-pf-overlay text-pf-text-muted shrink-0", children: trade.marketCategory })] }), _jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${trade.side === 'BUY'
                                        ? 'bg-pf-success/15 text-pf-success'
                                        : 'bg-pf-danger/15 text-pf-danger'}`, children: trade.side }), _jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${trade.outcome === 'YES'
                                        ? 'bg-pf-success/15 text-pf-success'
                                        : 'bg-pf-danger/15 text-pf-danger'}`, children: trade.outcome })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs text-pf-text-secondary mb-3", children: [_jsxs("span", { children: ["Size: ", _jsx("span", { className: "font-mono text-pf-text", children: trade.size })] }), _jsxs("span", { children: ["Price: ", _jsx("span", { className: "font-mono text-pf-text", children: trade.price })] }), _jsxs("span", { children: ["Notional: ", _jsx("span", { className: "font-mono text-pf-text", children: trade.notional })] })] }), _jsx("div", { className: "border-t border-pf-border-subtle my-2" }), _jsxs("div", { className: "flex items-center gap-2 pt-1", children: [_jsx("button", { onClick: () => toggleFollow(trade.walletAddress), className: `flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-medium border transition-colors ${followingSet.has(trade.walletAddress)
                                        ? 'bg-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                                        : 'text-pf-cyan-400 border-pf-cyan-500/30 hover:bg-cyan-500/10'}`, children: followingSet.has(trade.walletAddress) ? (_jsxs(_Fragment, { children: [_jsx(UserCheck, { className: "size-3.5" }), " Following"] })) : (_jsxs(_Fragment, { children: [_jsx(UserPlus, { className: "size-3.5" }), " Follow"] })) }), _jsxs(Link, { to: `/copy/new?wallet=${trade.walletAddress}`, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-medium border border-pf-success/30 text-pf-success hover:bg-pf-success/10 transition-colors", children: [_jsx(Copy, { className: "size-3.5" }), " Copy"] })] })] }, trade.id))) })), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }));
}
