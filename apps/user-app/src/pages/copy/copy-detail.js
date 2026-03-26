import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Pause, Play, Square, Pencil, X, Check, AlertCircle, ChevronLeft, ChevronRight, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
    ACTIVE: { dot: 'bg-pf-success', bg: 'bg-pf-success/10', text: 'text-pf-success' },
    PAUSED: { dot: 'bg-pf-warning', bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
    STOPPED: { dot: 'bg-gray-400', bg: 'bg-gray-500/10', text: 'text-gray-400' },
};
const MODE_STYLES = {
    PERCENTAGE: { bg: 'bg-pf-cyan-500/10', text: 'text-pf-cyan-400' },
    FIXED: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
    MIRROR: { bg: 'bg-pf-success/10', text: 'text-pf-success' },
};
const TRADE_STATUS_STYLES = {
    FILLED: 'bg-pf-success/15 text-pf-success',
    PARTIAL: 'bg-pf-warning/15 text-pf-warning',
    FAILED: 'bg-pf-danger/15 text-pf-danger',
    PENDING: 'bg-gray-500/15 text-gray-400',
};
function truncateAddress(addr) {
    if (addr.length <= 12)
        return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast.success('Address copied'), () => toast.error('Failed to copy'));
}
function formatPnl(value) {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
}
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function formatDateTime(d) {
    return new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function DetailSkeleton() {
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto space-y-6", children: [_jsx("div", { className: "h-4 bg-pf-overlay rounded w-20 animate-pulse" }), _jsx("div", { className: "h-6 bg-pf-overlay rounded w-[300px] animate-pulse" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: Array.from({ length: 4 }, (_, i) => (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 space-y-2 animate-shimmer", children: [_jsx("div", { className: "h-3 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-5 bg-pf-overlay rounded w-[80%]" })] }, i))) }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4 animate-shimmer", children: Array.from({ length: 5 }, (_, i) => (_jsx("div", { className: "h-3 bg-pf-overlay rounded w-full mb-3" }, i))) })] }));
}
/* ─── Edit Dialog ────────────────────────────────────────────────────── */
function EditDialog({ config, onClose, onSave, }) {
    const [sizeValue, setSizeValue] = useState(config.sizeValue);
    const [maxExposure, setMaxExposure] = useState(config.maxExposure);
    const [maxDailyLoss, setMaxDailyLoss] = useState(config.maxDailyLoss);
    const [priceOffset, setPriceOffset] = useState(config.priceOffset);
    const [saving, setSaving] = useState(false);
    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch(`/api/v1/copy/${config.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ sizeValue, maxExposure, maxDailyLoss, priceOffset }),
            });
            if (res.ok) {
                const updated = await res.json();
                onSave(updated);
                toast.success('Config updated');
            }
            else {
                toast.error('Failed to update config');
            }
        }
        catch {
            toast.error('Failed to update config');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", children: _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 w-full max-w-md space-y-5 animate-fade-in", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Edit Config" }), _jsx("button", { onClick: onClose, className: "text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-4" }) })] }), config.mode !== 'MIRROR' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: config.mode === 'PERCENTAGE' ? 'Size (%)' : 'Fixed Amount ($)' }), _jsx("input", { type: "number", min: 0, value: sizeValue, onChange: (e) => setSizeValue(Number(e.target.value)), className: "w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" })] })), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: "Max Exposure ($)" }), _jsx("input", { type: "number", min: 0, value: maxExposure, onChange: (e) => setMaxExposure(Number(e.target.value)), className: "w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: "Max Daily Loss ($)" }), _jsx("input", { type: "number", min: 0, value: maxDailyLoss, onChange: (e) => setMaxDailyLoss(Number(e.target.value)), className: "w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs text-pf-text-secondary", children: "Price Offset (%)" }), _jsx("input", { type: "number", min: -5, max: 5, step: 0.1, value: priceOffset, onChange: (e) => setPriceOffset(Number(e.target.value)), className: "w-full px-3 py-2 rounded-pf-sm text-sm bg-pf-surface text-pf-text border border-pf-border focus:border-pf-cyan-500/50 focus:outline-none font-mono" })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-pf-sm text-sm text-pf-text-secondary hover:text-pf-text border border-pf-border hover:border-pf-border-strong transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleSave, disabled: saving, className: "flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm bg-pf-cyan-500 text-black font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors", children: [_jsx(Check, { className: "size-3.5" }), saving ? 'Saving...' : 'Save'] })] })] }) }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { id } = useParams();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    // Trades
    const [trades, setTrades] = useState([]);
    const [tradesLoading, setTradesLoading] = useState(true);
    const [tradePage, setTradePage] = useState(1);
    const [tradeTotalPages, setTradeTotalPages] = useState(0);
    const loadConfig = useCallback(async () => {
        if (!id)
            return;
        setLoading(true);
        setNotFound(false);
        setError(false);
        try {
            const res = await fetch(`/api/v1/copy/${id}`, { credentials: 'include' });
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
            setConfig(data);
        }
        catch {
            toast.error('Failed to load copy config');
            setError(true);
        }
        setLoading(false);
    }, [id]);
    const loadTrades = useCallback(async (p) => {
        if (!id)
            return;
        setTradesLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: '20' });
            const res = await fetch(`/api/v1/copy/${id}/trades?${params}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setTrades(data.data);
                setTradeTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load trades');
        }
        setTradesLoading(false);
    }, [id]);
    useEffect(() => { loadConfig(); }, [loadConfig]);
    useEffect(() => { loadTrades(tradePage); }, [tradePage, loadTrades]);
    async function doAction(action) {
        if (!id)
            return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/v1/copy/${id}/${action}`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setConfig((prev) => prev ? { ...prev, status: data.status } : prev);
                toast.success(`Config ${action}d`);
            }
            else {
                toast.error(`Failed to ${action} config`);
            }
        }
        catch {
            toast.error(`Failed to ${action} config`);
        }
        finally {
            setActionLoading(false);
        }
    }
    if (loading)
        return _jsx(DetailSkeleton, {});
    if (notFound) {
        return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto", children: [_jsxs(Link, { to: "/copy", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors mb-6", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to Copy Trading"] }), _jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Copy, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "Config not found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "This copy config does not exist or has been removed." })] })] }));
    }
    if (error || !config) {
        return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto", children: [_jsxs(Link, { to: "/copy", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors mb-6", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to Copy Trading"] }), _jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(AlertCircle, { className: "size-10 text-pf-danger mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "Something went wrong" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Failed to load copy config. Please try again." }), _jsx("button", { onClick: loadConfig, className: "mt-4 px-4 py-2 rounded-pf-sm text-sm bg-pf-elevated border border-pf-border text-pf-text hover:border-pf-border-strong transition-colors", children: "Retry" })] })] }));
    }
    const statusStyle = STATUS_STYLES[config.status];
    const modeStyle = MODE_STYLES[config.mode];
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/copy", className: "flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-cyan-400 transition-colors", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to Copy Trading"] }), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-10 rounded-full bg-pf-cyan-500/15 border border-pf-cyan-500/25 flex items-center justify-center", children: _jsx(Copy, { className: "size-5 text-pf-cyan-400" }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono text-sm text-pf-text", children: truncateAddress(config.targetWallet) }), _jsx("button", { onClick: () => copyToClipboard(config.targetWallet), className: "text-pf-text-muted hover:text-pf-text transition-colors shrink-0", title: "Copy address", children: _jsx(Copy, { className: "size-3.5" }) })] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsxs("span", { className: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`, children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-full ${statusStyle.dot} ${config.status === 'ACTIVE' ? 'animate-pulse-dot' : ''}` }), config.status] }), _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${modeStyle.bg} ${modeStyle.text}`, children: config.mode })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => setShowEdit(true), className: "flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-border text-pf-text-secondary hover:border-pf-border-strong hover:text-pf-text transition-colors", children: [_jsx(Pencil, { className: "size-3.5" }), " Edit"] }), config.status === 'ACTIVE' && (_jsxs("button", { onClick: () => doAction('pause'), disabled: actionLoading, className: "flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-warning/30 text-pf-warning hover:bg-pf-warning/10 disabled:opacity-40 transition-colors", children: [_jsx(Pause, { className: "size-3.5" }), " Pause"] })), config.status === 'PAUSED' && (_jsxs("button", { onClick: () => doAction('resume'), disabled: actionLoading, className: "flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-cyan-500/30 text-pf-cyan-400 hover:bg-pf-cyan-500/10 disabled:opacity-40 transition-colors", children: [_jsx(Play, { className: "size-3.5" }), " Resume"] })), config.status !== 'STOPPED' && (_jsxs("button", { onClick: () => doAction('stop'), disabled: actionLoading, className: "flex items-center gap-1.5 px-4 py-2 rounded-pf-sm text-sm font-medium border border-pf-danger/30 text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors", children: [_jsx(Square, { className: "size-3.5" }), " Stop"] }))] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Total P&L" }), _jsx("div", { className: `text-lg font-mono font-semibold ${config.totalPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`, children: formatPnl(config.totalPnl) })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Total Trades" }), _jsx("div", { className: "text-lg font-mono font-semibold text-pf-text", children: config.totalCopiedTrades })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Win Rate" }), _jsxs("div", { className: "text-lg font-mono font-semibold text-pf-text", children: [config.winRate, "%"] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-1", children: "Avg Size" }), _jsxs("div", { className: "text-lg font-mono font-semibold text-pf-text", children: ["$", config.avgSize.toFixed(2)] })] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-3 uppercase tracking-wider font-medium", children: "Risk Settings" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs text-pf-text-muted", children: "Max Exposure" }), _jsxs("p", { className: "font-mono text-sm text-pf-text", children: ["$", config.maxExposure.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-xs text-pf-text-muted", children: "Max Daily Loss" }), _jsxs("p", { className: "font-mono text-sm text-pf-text", children: ["$", config.maxDailyLoss.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-xs text-pf-text-muted", children: "Price Offset" }), _jsxs("p", { className: "font-mono text-sm text-pf-text", children: [config.priceOffset > 0 ? '+' : '', config.priceOffset, "%"] })] })] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-pf-border", children: _jsx("h2", { className: "text-sm font-medium text-pf-text", children: "Trade History" }) }), tradesLoading && trades.length === 0 ? (_jsx("div", { className: "p-4 space-y-3 animate-shimmer", children: Array.from({ length: 5 }, (_, i) => (_jsx("div", { className: "h-3 bg-pf-overlay rounded w-full" }, i))) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Market" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Side" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Outcome" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Source Size" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Copied Size" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Price" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "P&L" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Date" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: trades.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, children: _jsx("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: _jsx("p", { className: "text-sm text-pf-text-muted", children: "No copied trades yet." }) }) }) })) : (trades.map((trade) => (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-pf-text max-w-[180px] truncate", children: trade.market }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${trade.side === 'BUY' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'}`, children: trade.side }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${trade.outcome === 'YES' ? 'bg-pf-success/15 text-pf-success' : 'bg-pf-danger/15 text-pf-danger'}`, children: trade.outcome }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: trade.sourceSize }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: trade.copiedSize }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: trade.price }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: `font-mono font-medium ${trade.pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`, children: formatPnl(trade.pnl) }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold ${TRADE_STATUS_STYLES[trade.status]}`, children: trade.status }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary text-xs", children: formatDateTime(trade.timestamp) })] }, trade.id)))) })] }) }))] }), tradeTotalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setTradePage((p) => Math.max(1, p - 1)), disabled: tradePage === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [tradePage, " / ", tradeTotalPages] }), _jsx("button", { onClick: () => setTradePage((p) => Math.min(tradeTotalPages, p + 1)), disabled: tradePage === tradeTotalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] })), showEdit && (_jsx(EditDialog, { config: config, onClose: () => setShowEdit(false), onSave: (updated) => {
                    setConfig(updated);
                    setShowEdit(false);
                } }))] }));
}
