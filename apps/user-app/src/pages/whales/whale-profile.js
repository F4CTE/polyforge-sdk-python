import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Fish, UserPlus, UserCheck, AlertCircle, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast.success('Address copied'), () => toast.error('Failed to copy'));
}
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function pnlColor(pnl) {
    const v = parseFloat(pnl);
    if (isNaN(v))
        return 'text-pf-text-secondary';
    return v >= 0 ? 'text-pf-success' : 'text-pf-danger';
}
function pnlSign(pnl) {
    const v = parseFloat(pnl);
    if (isNaN(v) || v === 0)
        return pnl;
    return v > 0 ? `+${pnl}` : pnl;
}
/* ─── Sparkline ──────────────────────────────────────────────────────── */
function Sparkline({ data }) {
    if (!data.length)
        return null;
    const max = Math.max(...data, 1);
    const w = 200;
    const h = 40;
    const step = w / (data.length - 1 || 1);
    const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
    return (_jsx("svg", { viewBox: `0 0 ${w} ${h}`, className: "w-full h-10", preserveAspectRatio: "none", children: _jsx("polyline", { fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinejoin: "round", points: points, className: "text-pf-cyan-400" }) }));
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function ProfileSkeleton() {
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto space-y-6", children: [_jsx("div", { className: "h-4 bg-pf-overlay rounded w-20 animate-pulse" }), _jsx("div", { className: "h-6 bg-pf-overlay rounded w-[300px] animate-pulse" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: Array.from({ length: 4 }, (_, i) => (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-2 animate-shimmer", children: [_jsx("div", { className: "h-3 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-5 bg-pf-overlay rounded w-[80%]" })] }, i))) }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-shimmer", children: Array.from({ length: 5 }, (_, i) => (_jsx("div", { className: "h-3 bg-pf-overlay rounded w-full mb-3" }, i))) })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { address } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState(false);
    const [following, setFollowing] = useState(false);
    const load = useCallback(async () => {
        if (!address)
            return;
        setLoading(true);
        setNotFound(false);
        setError(false);
        try {
            const res = await fetch(`/api/v1/whales/${address}`, { credentials: 'include' });
            if (res.status === 404) {
                setNotFound(true);
                setLoading(false);
                return;
            }
            if (!res.ok) {
                setError(true);
                setLoading(false);
                return;
            }
            const data = await res.json();
            setProfile(data);
            setFollowing(data.isFollowing);
        }
        catch {
            toast.error('Failed to load whale profile');
            setError(true);
        }
        setLoading(false);
    }, [address]);
    useEffect(() => { load(); }, [load]);
    async function toggleFollow() {
        if (!address)
            return;
        try {
            const res = await fetch(`/api/v1/whales/${address}/${following ? 'unfollow' : 'follow'}`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                setFollowing(f => !f);
                toast.success(following ? 'Unfollowed whale' : 'Following whale');
            }
        }
        catch {
            toast.error('Action failed');
        }
    }
    if (loading)
        return _jsx(ProfileSkeleton, {});
    if (notFound) {
        return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto", children: [_jsxs(Link, { to: "/whales", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors mb-6", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to feed"] }), _jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Fish, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "Wallet not found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "No whale activity recorded for this address." })] })] }));
    }
    if (error || !profile) {
        return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto", children: [_jsxs(Link, { to: "/whales", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors mb-6", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to feed"] }), _jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(AlertCircle, { className: "size-10 text-pf-danger mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "Something went wrong" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Failed to load whale profile. Please try again." }), _jsx("button", { onClick: load, className: "mt-4 px-4 py-2 rounded-pf-sm text-sm bg-pf-elevated border border-pf-border text-pf-text hover:border-pf-border-strong transition-colors", children: "Retry" })] })] }));
    }
    const { stats, recentTrades, sparkline } = profile;
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/whales", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to feed"] }), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-10 rounded-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center", children: _jsx(Fish, { className: "size-5 text-pf-cyan-400" }) }), _jsx("div", { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono text-sm text-pf-text break-all", children: address }), _jsx("button", { onClick: () => copyToClipboard(address ?? ''), className: "text-pf-text-muted hover:text-pf-text transition-colors shrink-0", title: "Copy address", children: _jsx(Copy, { className: "size-3.5" }) })] }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: toggleFollow, className: `flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border transition-colors ${following
                                    ? 'bg-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                                    : 'text-pf-cyan-400 border-pf-cyan-500/30 hover:bg-cyan-500/10'}`, children: following ? _jsxs(_Fragment, { children: [_jsx(UserCheck, { className: "size-4" }), " Following"] }) : _jsxs(_Fragment, { children: [_jsx(UserPlus, { className: "size-4" }), " Follow"] }) }), _jsxs(Link, { to: `/copy/new?wallet=${address}`, className: "flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-success/30 text-pf-success hover:bg-pf-success/10 transition-colors", children: [_jsx(Copy, { className: "size-4" }), " Copy This Whale"] })] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Total Volume" }), _jsx("div", { className: "text-lg font-mono font-semibold text-pf-text", children: stats.totalVolume })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Total P&L" }), _jsx("div", { className: `text-lg font-mono font-semibold ${pnlColor(stats.totalPnl)}`, children: pnlSign(stats.totalPnl) })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Trade Count" }), _jsx("div", { className: "text-lg font-mono font-semibold text-pf-text", children: stats.tradeCount })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Win Rate" }), _jsxs("div", { className: "text-lg font-mono font-semibold text-pf-text", children: [stats.winRate, "%"] })] })] }), sparkline.length > 0 && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-3", children: "Activity (last 30 days)" }), _jsx(Sparkline, { data: sparkline })] })), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-pf-border", children: _jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Recent Trades" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Market" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Side" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Outcome" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Size" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Price" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Date" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: recentTrades.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: _jsx("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: _jsx("p", { className: "text-sm text-pf-text-muted", children: "No trades recorded yet." }) }) }) })) : (recentTrades.map(trade => (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-pf-text max-w-[200px] truncate", children: trade.marketName }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${trade.side === 'BUY' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'}`, children: trade.side }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${trade.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'}`, children: trade.outcome }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: trade.size }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: trade.price }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary text-xs", children: formatDate(trade.timestamp) })] }, trade.id)))) })] }) })] })] }));
}
