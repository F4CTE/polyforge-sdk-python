import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, RotateCcw, Trash2, AlertTriangle, ClipboardList, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';
export function Component() {
    const [orders, setOrders] = useState([]);
    const [dlqEntries, setDlqEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const limit = 20;
    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [ordersRes, dlqRes] = await Promise.all([
                adminApi.orders({ page, limit, status: statusFilter || undefined }),
                adminApi.dlq(),
            ]);
            setOrders(ordersRes.data ?? []);
            setTotal(ordersRes.total ?? 0);
            setTotalPages(ordersRes.totalPages ?? 1);
            setDlqEntries(dlqRes ?? []);
        }
        catch {
            setError(true);
            toast.error('Failed to load orders');
        }
        finally {
            setLoading(false);
        }
    }, [page, statusFilter]);
    useEffect(() => {
        load();
    }, [load]);
    const [confirmAction, setConfirmAction] = useState(null);
    async function handleReplay(intentId) {
        setConfirmAction(null);
        try {
            await adminApi.dlqReplay(intentId);
            setDlqEntries((e) => e.filter((d) => d.intentId !== intentId));
            toast.success('DLQ entry replayed');
        }
        catch {
            toast.error('Failed to replay');
        }
    }
    async function handleDiscard(intentId) {
        setConfirmAction(null);
        try {
            await adminApi.dlqDiscard(intentId);
            setDlqEntries((e) => e.filter((d) => d.intentId !== intentId));
            toast.success('DLQ entry discarded');
        }
        catch {
            toast.error('Failed to discard');
        }
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: ["Orders ", _jsxs("span", { className: "text-sm font-normal text-[var(--color-pf-text-tertiary)]", children: ["(", total, ")"] })] }), _jsxs("select", { value: statusFilter, onChange: e => { setStatusFilter(e.target.value); setPage(1); }, className: "h-8 px-2 rounded-pf-sm bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] text-xs text-[var(--color-pf-text)] focus:outline-none focus:border-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "PENDING", children: "Pending" }), _jsx("option", { value: "SUBMITTED", children: "Submitted" }), _jsx("option", { value: "LIVE", children: "Live" }), _jsx("option", { value: "CONFIRMED", children: "Confirmed" }), _jsx("option", { value: "CANCELLED", children: "Cancelled" }), _jsx("option", { value: "FAILED", children: "Failed" })] })] }), error && (_jsxs("div", { className: "text-center py-12", children: [_jsx(AlertCircle, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)]", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] mb-4", children: "Failed to load data" }), _jsx("button", { onClick: load, className: "text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm", children: "Try again" })] })), dlqEntries.length > 0 && (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-pf-warning/30 rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(AlertTriangle, { size: 16, className: "text-pf-warning" }), _jsxs("h3", { className: "text-sm font-semibold text-pf-warning", children: ["Dead Letter Queue (", dlqEntries.length, ")"] })] }), _jsx("div", { className: "space-y-3", children: dlqEntries.map((entry) => (_jsxs("div", { className: "flex items-center justify-between p-3 rounded-pf-sm bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "text-sm text-[var(--color-pf-text)]", children: [_jsx("span", { className: "font-medium", children: entry.username }), _jsxs("span", { className: "text-[var(--color-pf-text-tertiary)]", children: [" - Intent ", entry.intentId.slice(0, 8)] })] }), _jsx("div", { className: "text-xs text-pf-danger mt-0.5 truncate", children: entry.lastError }), _jsxs("div", { className: "text-[11px] text-[var(--color-pf-text-tertiary)] mt-0.5", children: [entry.attempts, " attempts - ", formatDateTime(entry.enqueuedAt)] })] }), _jsx("div", { className: "flex items-center gap-2 ml-4 shrink-0", children: confirmAction?.intentId === entry.intentId ? (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "text-[var(--color-pf-text-secondary)]", children: confirmAction?.type === 'discard' ? 'Discard?' : 'Replay?' }), _jsx("button", { onClick: () => confirmAction?.type === 'replay' ? handleReplay(entry.intentId) : handleDiscard(entry.intentId), className: "px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors", children: "Confirm" }), _jsx("button", { onClick: () => setConfirmAction(null), className: "px-2 py-0.5 rounded bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors", children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setConfirmAction({ type: 'replay', intentId: entry.intentId }), className: "flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors", children: [_jsx(RotateCcw, { size: 12 }), "Replay"] }), _jsxs("button", { onClick: () => setConfirmAction({ type: 'discard', intentId: entry.intentId }), className: "flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors", children: [_jsx(Trash2, { size: 12 }), "Discard"] })] })) })] }, entry.intentId))) })] })), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "ID" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "User" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Side" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Size" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Price" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 7 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : orders.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 7, className: "text-center py-12", children: [_jsx(ClipboardList, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No orders found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Orders will appear here once users start trading" })] }) })) : (orders.map((o) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-mono text-xs text-[var(--color-pf-text-secondary)]", children: o.id.slice(0, 8) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text)]", children: o.username }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: o.side === 'BUY' ? 'text-pf-success' : 'text-pf-danger', children: o.side }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(o.status ?? 'UNKNOWN')}`, children: o.status ?? 'UNKNOWN' }) }), _jsx("td", { className: "px-4 py-3 text-right text-[var(--color-pf-text)]", children: o.size }), _jsx("td", { className: "px-4 py-3 text-right text-[var(--color-pf-text)]", children: o.price }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDateTime(o.createdAt) })] }, o.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] })] }));
}
