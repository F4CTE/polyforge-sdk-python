import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Fish, UserMinus } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
function truncateAddress(addr) {
    if (addr.length <= 12)
        return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-3 animate-shimmer", children: [_jsx("div", { className: "h-3.5 bg-pf-overlay rounded w-[50%]" }), _jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: "h-3 bg-pf-overlay rounded w-[25%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[25%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[25%]" })] })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/whales/following', { credentials: 'include' });
            if (res.ok) {
                const json = await res.json();
                const data = Array.isArray(json) ? json : (json.data ?? []);
                setWallets(data);
            }
        }
        catch {
            toast.error('Failed to load followed wallets');
        }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);
    async function unfollow(address) {
        try {
            const res = await fetch(`/api/v1/whales/${address}/unfollow`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                setWallets(prev => prev.filter(w => w.walletAddress !== address));
                toast.success('Unfollowed whale');
            }
        }
        catch {
            toast.error('Action failed');
        }
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/whales", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to feed"] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Fish, { className: "size-6 text-pf-cyan-400" }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Following" }), !loading && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [wallets.length, " wallets"] })] }), loading ? (_jsx("div", { className: "space-y-4", children: Array.from({ length: 4 }, (_, i) => _jsx(CardSkeleton, {}, i)) })) : wallets.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Fish, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "You're not following any whales yet" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Follow whales from the feed to track their trades." }), _jsx(Link, { to: "/whales", className: "mt-4 px-4 py-2 rounded-pf-sm text-sm bg-pf-elevated border border-pf-border text-pf-text hover:border-pf-border-strong transition-colors", children: "Go to Whale Feed" })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: wallets.map(wallet => (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx(Link, { to: `/whales/${wallet.walletAddress}`, className: "font-mono text-sm text-pf-text hover:text-pf-cyan-400 transition-colors", children: truncateAddress(wallet.walletAddress) }), _jsxs("button", { onClick: () => unfollow(wallet.walletAddress), className: "flex items-center gap-1.5 px-3 py-1.5 rounded-pf-sm text-xs font-medium border border-pf-danger/30 text-pf-danger hover:bg-pf-danger/10 transition-colors", children: [_jsx(UserMinus, { className: "size-3.5" }), " Unfollow"] })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs text-pf-text-secondary", children: [_jsxs("span", { children: ["Volume: ", _jsx("span", { className: "font-mono text-pf-text", children: wallet.totalVolume })] }), _jsxs("span", { children: ["P&L: ", _jsx("span", { className: `font-mono ${pnlColor(wallet.totalPnl)}`, children: pnlSign(wallet.totalPnl) })] }), _jsxs("span", { children: ["Trades: ", _jsx("span", { className: "font-mono text-pf-text", children: wallet.tradeCount })] })] })] }, wallet.walletAddress))) }))] }));
}
