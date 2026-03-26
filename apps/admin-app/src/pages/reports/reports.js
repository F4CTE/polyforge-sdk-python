import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Flag, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDateTime } from '@/lib/utils';
export function Component() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [reviewingId, setReviewingId] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const loadReports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.reports({
                status: statusFilter || undefined,
                page,
                limit,
            });
            setReports(res.data ?? []);
            setTotal(res.total ?? 0);
        }
        catch {
            toast.error('Failed to load reports');
        }
        finally {
            setLoading(false);
        }
    }, [statusFilter, page, limit]);
    useEffect(() => { loadReports(); }, [loadReports]);
    async function handleResolve(id, status) {
        try {
            const updated = await adminApi.resolveReport(id, status, adminNote || undefined);
            setReports((r) => r.map((rep) => (rep.id === id ? updated : rep)));
            setReviewingId(null);
            setAdminNote('');
            toast.success(`Report ${status.toLowerCase()}`);
        }
        catch {
            toast.error('Failed to resolve report');
        }
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: "Content Reports" }), _jsxs("select", { value: statusFilter, onChange: (e) => { setStatusFilter(e.target.value); setPage(1); }, className: "px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "PENDING", children: "Pending" }), _jsx("option", { value: "REVIEWED", children: "Reviewed" }), _jsx("option", { value: "DISMISSED", children: "Dismissed" })] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Reporter" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Target" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Reason" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "text-right px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 6 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : reports.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 6, className: "text-center py-12", children: [_jsx(Flag, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No reports found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Content reports will appear here" })] }) })) : (reports.map((r) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text)]", children: r.reporterUsername }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "text-[var(--color-pf-text-secondary)]", children: [_jsx("span", { className: "text-[11px] uppercase text-[var(--color-pf-text-tertiary)]", children: r.targetType }), r.targetName && _jsx("span", { className: "ml-1.5", children: r.targetName })] }) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)] max-w-[200px] truncate", children: r.reason }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`, children: r.status }) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDateTime(r.createdAt) }), _jsx("td", { className: "px-4 py-3 text-right", children: r.status === 'PENDING' && (_jsxs("button", { onClick: () => {
                                                        setReviewingId(r.id);
                                                        setAdminNote('');
                                                    }, className: "inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-pf-cyan-500)]/10 text-[var(--color-pf-cyan-500)] hover:bg-[var(--color-pf-cyan-500)]/20 transition-colors", children: [_jsx(Flag, { size: 12 }), "Review"] })) })] }, r.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] }), reviewingId && (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)] mb-3", children: "Review Report" }), _jsx("textarea", { value: adminNote, onChange: (e) => setAdminNote(e.target.value), placeholder: "Admin note (optional)...", rows: 3, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] mb-3" }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { onClick: () => handleResolve(reviewingId, 'REVIEWED'), className: "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-success/10 text-pf-success hover:bg-pf-success/20 transition-colors", children: [_jsx(CheckCircle, { size: 14 }), "Approve"] }), _jsxs("button", { onClick: () => handleResolve(reviewingId, 'DISMISSED'), className: "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)] transition-colors", children: [_jsx(XCircle, { size: 14 }), "Dismiss"] }), _jsx("button", { onClick: () => setReviewingId(null), className: "px-3 py-1.5 text-sm rounded-pf-sm text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text-secondary)] transition-colors", children: "Cancel" })] })] }))] }));
}
