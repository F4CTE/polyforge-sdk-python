import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Copy, Pause, Play, Square, Eye, ChevronLeft, ChevronRight, } from 'lucide-react';
import { toast } from 'sonner';
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
const FILTERS = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Paused', value: 'PAUSED' },
    { label: 'Stopped', value: 'STOPPED' },
];
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
function sizeLabel(mode, value) {
    if (mode === 'PERCENTAGE')
        return `${value}% of trade`;
    if (mode === 'FIXED')
        return `$${value.toFixed(2)} fixed`;
    return 'Mirror (1:1)';
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-3 animate-shimmer", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-4 bg-pf-overlay rounded w-[140px]" }), _jsx("div", { className: "h-5 w-20 bg-pf-overlay rounded-full ml-auto" })] }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[60%]" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "h-5 w-24 bg-pf-overlay rounded-full" }), _jsx("div", { className: "h-5 w-16 bg-pf-overlay rounded-full" })] }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[80%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[50%]" })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const navigate = useNavigate();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [actionLoading, setActionLoading] = useState({});
    const load = useCallback((status, p) => {
        setLoading(true);
        const params = new URLSearchParams({ limit: '20', page: String(p ?? page) });
        const s = status ?? filter;
        if (s !== 'ALL')
            params.set('status', s);
        fetch(`/api/v1/copy?${params}`, { credentials: 'include' })
            .then((r) => {
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
            .then((res) => {
            setConfigs(res.data ?? []);
            setTotalPages(res.totalPages ?? 0);
            setLoading(false);
        })
            .catch(() => {
            toast.error('Failed to load copy configs');
            setConfigs([]);
            setLoading(false);
        });
    }, [page, filter]);
    useEffect(() => { load(); }, [load]);
    function onFilterChange(f) {
        setFilter(f);
        setPage(1);
        load(f, 1);
    }
    async function doAction(configId, action) {
        setActionLoading((prev) => ({ ...prev, [configId]: true }));
        try {
            const res = await fetch(`/api/v1/copy/${configId}/${action}`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setConfigs((prev) => prev.map((c) => (c.id === configId ? { ...c, status: data.status } : c)));
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
            setActionLoading((prev) => ({ ...prev, [configId]: false }));
        }
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Copy, { className: "size-6 text-pf-cyan-400" }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Copy Trading" })] }), _jsxs(Link, { to: "/copy/new", className: "flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: [_jsx(Plus, { className: "size-4" }), " New Copy Config"] })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: FILTERS.map((f) => (_jsx("button", { onClick: () => onFilterChange(f.value), className: `px-3 py-1.5 text-sm rounded-full border transition-colors ${filter === f.value
                        ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                        : 'border-pf-border text-pf-text-secondary hover:text-pf-text'}`, children: f.label }, f.value))) }), loading && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [1, 2, 3, 4, 5, 6].map((i) => _jsx(CardSkeleton, {}, i)) })), !loading && configs.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Copy, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No copy configs yet" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Start copying a whale's trades to automate your trading." }), _jsxs(Link, { to: "/copy/new", className: "mt-4 flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: [_jsx(Plus, { className: "size-4" }), " New Copy Config"] })] })), !loading && configs.length > 0 && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children", children: configs.map((config) => {
                    const statusStyle = STATUS_STYLES[config.status];
                    const modeStyle = MODE_STYLES[config.mode];
                    const busy = !!actionLoading[config.id];
                    return (_jsxs("div", { "data-testid": "copy-config-card", role: "link", tabIndex: 0, onClick: () => navigate(`/copy/${config.id}`), onKeyDown: (e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                                navigate(`/copy/${config.id}`);
                        }, className: "group bg-pf-elevated border border-pf-border rounded-pf-lg p-5 cursor-pointer transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-3", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "font-mono text-sm text-pf-text group-hover:text-pf-cyan-400 transition-colors truncate", children: truncateAddress(config.targetWallet) }), _jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    copyToClipboard(config.targetWallet);
                                                }, className: "text-pf-text-muted hover:text-pf-text transition-colors shrink-0", title: "Copy address", children: _jsx(Copy, { className: "size-3.5" }) })] }), _jsxs("span", { "data-testid": "status-badge", className: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusStyle.bg} ${statusStyle.text}`, children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-full ${statusStyle.dot} ${config.status === 'ACTIVE' ? 'animate-pulse-dot' : ''}` }), config.status] })] }), _jsxs("div", { className: "flex flex-wrap gap-1.5 mb-3", children: [_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${modeStyle.bg} ${modeStyle.text}`, children: config.mode }), _jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted text-[11px] font-medium", children: sizeLabel(config.mode, config.sizeValue) })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs text-pf-text-secondary mb-3", children: [_jsxs("span", { children: ["Max Exp: ", _jsxs("span", { className: "font-mono text-pf-text", children: ["$", config.maxExposure.toLocaleString()] })] }), _jsxs("span", { children: ["Max Loss: ", _jsxs("span", { className: "font-mono text-pf-text", children: ["$", config.maxDailyLoss.toLocaleString()] })] })] }), _jsxs("div", { className: "flex items-center gap-4 mb-3", children: [_jsxs("span", { className: "text-xs text-pf-text-secondary", children: ["P&L:", ' ', _jsx("span", { className: `font-mono font-medium ${config.totalPnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`, children: formatPnl(config.totalPnl) })] }), _jsxs("span", { className: "text-xs text-pf-text-secondary", children: ["Trades:", ' ', _jsx("span", { className: "font-mono text-pf-text", children: config.totalCopiedTrades })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-1 pt-3 border-t border-pf-border-subtle", onClick: (e) => e.stopPropagation(), children: [config.status === 'ACTIVE' && (_jsx("button", { onClick: () => doAction(config.id, 'pause'), disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-warning hover:bg-pf-warning/10 disabled:opacity-40 transition-colors", "aria-label": "Pause config", title: "Pause", children: _jsx(Pause, { className: "size-3.5" }) })), config.status === 'PAUSED' && (_jsx("button", { onClick: () => doAction(config.id, 'resume'), disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-cyan-400 hover:bg-pf-cyan-500/10 disabled:opacity-40 transition-colors", "aria-label": "Resume config", title: "Resume", children: _jsx(Play, { className: "size-3.5" }) })), config.status !== 'STOPPED' && (_jsx("button", { onClick: () => doAction(config.id, 'stop'), disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors", "aria-label": "Stop config", title: "Stop", children: _jsx(Square, { className: "size-3.5" }) })), _jsx(Link, { to: `/copy/${config.id}`, onClick: (e) => e.stopPropagation(), className: "p-1.5 rounded-pf-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-overlay transition-colors", "aria-label": "View config details", title: "View details", children: _jsx(Eye, { className: "size-3.5" }) })] })] }, config.id));
                }) })), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => {
                            const p = Math.max(1, page - 1);
                            setPage(p);
                            load(undefined, p);
                        }, disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => {
                            const p = Math.min(totalPages, page + 1);
                            setPage(p);
                            load(undefined, p);
                        }, disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }));
}
