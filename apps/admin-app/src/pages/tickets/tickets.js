import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime, priorityColor } from '@/lib/utils';
export function Component() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const limit = 20;
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.tickets({
                page,
                limit,
                status: statusFilter || undefined,
            });
            setTickets(res.data ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
        }
        catch {
            toast.error('Failed to load tickets');
        }
        finally {
            setLoading(false);
        }
    }, [page, statusFilter]);
    useEffect(() => {
        load();
    }, [load]);
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: ["Tickets ", _jsxs("span", { className: "text-sm font-normal text-[var(--color-pf-text-tertiary)]", children: ["(", total, ")"] })] }), _jsxs("select", { value: statusFilter, onChange: (e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }, className: "px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "OPEN", children: "Open" }), _jsx("option", { value: "IN_PROGRESS", children: "In Progress" }), _jsx("option", { value: "RESOLVED", children: "Resolved" }), _jsx("option", { value: "CLOSED", children: "Closed" })] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Subject" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "User" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Priority" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Assigned To" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 6 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : tickets.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 6, className: "text-center py-12", children: [_jsx(MessageSquare, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No tickets found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Support tickets will appear here" })] }) })) : (tickets.map((t) => (_jsxs("tr", { role: "link", tabIndex: 0, onClick: () => navigate(`/tickets/${t.id}`), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                                            navigate(`/tickets/${t.id}`); }, className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-medium text-[var(--color-pf-text)]", children: t.subject }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: t.username ?? t.userId?.slice(0, 8) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status ?? 'UNKNOWN')}`, children: t.status ?? 'UNKNOWN' }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[t.priority] ?? ''}`, children: t.priority }) }), _jsx("td", { className: "px-4 py-3", children: t.assignedTo ? (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("div", { className: "w-5 h-5 rounded-full bg-[var(--color-pf-cyan-500)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--color-pf-cyan-500)]", children: t.assignedToName?.[0]?.toUpperCase() ?? 'A' }), _jsx("span", { className: "text-[var(--color-pf-text-secondary)] text-xs", children: t.assignedToName ?? t.assignedTo.slice(0, 8) })] })) : (_jsx("span", { className: "text-[var(--color-pf-text-tertiary)] text-xs", children: "Unassigned" })) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDateTime(t.createdAt) })] }, t.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] })] }));
}
