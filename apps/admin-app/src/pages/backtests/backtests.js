import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, FlaskConical, XCircle, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';
export function Component() {
    const [backtests, setBacktests] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState({});
    const limit = 20;
    async function cancelBacktest(id) {
        setCancelling(prev => ({ ...prev, [id]: true }));
        try {
            await adminApi.cancelBacktest(id);
            toast.success('Backtest cancelled');
            load();
        }
        catch {
            toast.error('Failed to cancel backtest');
        }
        setCancelling(prev => ({ ...prev, [id]: false }));
    }
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.backtests({ page, limit });
            setBacktests(res.data ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
        }
        catch {
            toast.error('Failed to load backtests');
        }
        finally {
            setLoading(false);
        }
    }, [page]);
    useEffect(() => {
        load();
    }, [load]);
    function getDuration(bt) {
        if (!bt.createdAt)
            return '-';
        const start = new Date(bt.createdAt).getTime();
        const end = bt.completedAt ? new Date(bt.completedAt).getTime() : Date.now();
        const diffSec = Math.floor((end - start) / 1000);
        if (diffSec < 60)
            return `${diffSec}s`;
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        return `${mins}m ${secs}s`;
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: ["Backtests ", _jsxs("span", { className: "text-sm font-normal text-[var(--color-pf-text-tertiary)]", children: ["(", total, ")"] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "ID" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "User" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Strategy" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Duration" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "P&L" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Win Rate" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 9 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : backtests.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 9, className: "text-center py-12", children: [_jsx(FlaskConical, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No backtests found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Backtest runs will appear here" })] }) })) : (backtests.map((bt) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-[var(--color-pf-text-secondary)]", children: bt.id.slice(0, 8) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text)]", children: bt.username }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: bt.strategyName ?? '-' }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bt.status ?? 'UNKNOWN')}`, children: bt.status ?? 'UNKNOWN' }) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: getDuration(bt) }), _jsx("td", { className: "px-4 py-3 text-right", children: bt.totalPnl != null ? (_jsxs("span", { className: parseFloat(bt.totalPnl) >= 0 ? 'text-pf-success' : 'text-pf-danger', children: [parseFloat(bt.totalPnl) >= 0 ? '+' : '', bt.totalPnl] })) : (_jsx("span", { className: "text-[var(--color-pf-text-tertiary)]", children: "-" })) }), _jsx("td", { className: "px-4 py-3 text-right text-[var(--color-pf-text-secondary)]", children: bt.winRate != null ? `${bt.winRate}%` : '-' }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDateTime(bt.createdAt) }), _jsx("td", { className: "px-4 py-3 text-right", children: (bt.status === 'RUNNING' || bt.status === 'PENDING' || bt.status === 'QUEUED') && (_jsxs("button", { onClick: () => cancelBacktest(bt.id), disabled: cancelling[bt.id], className: "inline-flex items-center gap-1 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-50 transition-colors", children: [cancelling[bt.id] ? _jsx(Loader2, { size: 12, className: "animate-spin" }) : _jsx(XCircle, { size: 12 }), "Cancel"] })) })] }, bt.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] })] }));
}
