import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Square, Zap, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';
export function Component() {
    const [strategies, setStrategies] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const limit = 20;
    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await adminApi.strategies({ page, limit });
            setStrategies(res.data ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
        }
        catch {
            setError(true);
            toast.error('Failed to load strategies');
        }
        finally {
            setLoading(false);
        }
    }, [page]);
    useEffect(() => {
        load();
    }, [load]);
    async function handleForceStop(id) {
        if (!window.confirm('Are you sure you want to force-stop this strategy?'))
            return;
        try {
            await adminApi.forceStop(id);
            setStrategies((s) => s.map((st) => (st.id === id ? { ...st, status: 'IDLE' } : st)));
            toast.success('Strategy force-stopped');
        }
        catch {
            toast.error('Failed to force-stop strategy');
        }
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: ["Strategies ", _jsxs("span", { className: "text-sm font-normal text-[var(--color-pf-text-tertiary)]", children: ["(", total, ")"] })] }), error && (_jsxs("div", { className: "text-center py-12", children: [_jsx(AlertCircle, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)]", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] mb-4", children: "Failed to load data" }), _jsx("button", { onClick: load, className: "text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm", children: "Try again" })] })), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Owner" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Exec Mode" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Visibility" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 7 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : strategies.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 7, className: "text-center py-12", children: [_jsx(Zap, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No strategies found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "User strategies will appear here" })] }) })) : (strategies.map((s) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-medium text-[var(--color-pf-text)]", children: s.name }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: s.username }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status ?? 'UNKNOWN')}`, children: s.status ?? 'UNKNOWN' }) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)] capitalize", children: s.execMode }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: s.visibility }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDate(s.createdAt) }), _jsx("td", { className: "px-4 py-3 text-right", children: (s.status === 'RUNNING' || s.status === 'PAPER') && (_jsxs("button", { onClick: () => handleForceStop(s.id), className: "inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors", children: [_jsx(Square, { size: 12 }), "Force Stop"] })) })] }, s.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] })] }));
}
