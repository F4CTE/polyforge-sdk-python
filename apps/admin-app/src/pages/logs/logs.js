import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
export function Component() {
    const [tab, setTab] = useState('audit');
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const limit = 25;
    const load = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (tab === 'audit')
                res = await adminApi.auditLogs({ page, limit });
            else if (tab === 'events')
                res = await adminApi.eventLogs({ page, limit });
            else
                res = await adminApi.loginLogs({ page, limit });
            setLogs(res.data ?? []);
            setTotalPages(res.totalPages ?? 1);
        }
        catch {
            toast.error('Failed to load logs');
        }
        finally {
            setLoading(false);
        }
    }, [tab, page]);
    useEffect(() => {
        load();
    }, [load]);
    function changeTab(t) {
        setTab(t);
        setPage(1);
    }
    const tabs = [
        { key: 'audit', label: 'Audit' },
        { key: 'events', label: 'Events' },
        { key: 'logins', label: 'Logins' },
    ];
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: "Logs" }), _jsx("div", { className: "flex gap-1 bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-1 w-fit", children: tabs.map((t) => (_jsx("button", { onClick: () => changeTab(t.key), className: `px-4 py-1.5 text-sm rounded-pf-sm transition-colors ${tab === t.key
                        ? 'bg-[var(--color-pf-cyan-500)]/10 text-[var(--color-pf-cyan-500)] font-medium'
                        : 'text-[var(--color-pf-text-secondary)] hover:text-[var(--color-pf-text)]'}`, children: t.label }, t.key))) }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Timestamp" }), tab === 'audit' && (_jsxs(_Fragment, { children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Action" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Target" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "IP" })] })), tab === 'events' && (_jsxs(_Fragment, { children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Type" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Details" })] })), tab === 'logins' && (_jsxs(_Fragment, { children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "User" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "IP" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Reason" })] }))] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: tab === 'audit' ? 4 : tab === 'logins' ? 5 : 3 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : logs.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 6, className: "text-center py-12", children: [_jsx(ScrollText, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No logs found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "System logs will appear here" })] }) })) : (logs.map((log) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)] whitespace-nowrap", children: formatDateTime(log.createdAt) }), tab === 'audit' && (_jsxs(_Fragment, { children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-pf-bg)] text-[var(--color-pf-cyan-500)] border border-[var(--color-pf-border)]", children: log.action }) }), _jsxs("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: [log.target && `${log.target}`, log.targetId && ` #${log.targetId.slice(0, 8)}`] }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-[var(--color-pf-text-tertiary)]", children: log.ip ?? '-' })] })), tab === 'events' && (_jsxs(_Fragment, { children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "px-2 py-0.5 rounded text-[11px] font-medium bg-violet-400/10 text-violet-400", children: log.type }) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)] max-w-[300px] font-mono text-xs", children: _jsxs("details", { className: "cursor-pointer", children: [_jsx("summary", { className: "truncate", children: JSON.stringify(log.payload) }), _jsx("pre", { className: "mt-2 p-2 bg-[var(--color-pf-bg)] rounded text-[10px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto", children: JSON.stringify(log.payload, null, 2) })] }) })] })), tab === 'logins' && (_jsxs(_Fragment, { children: [_jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text)]", children: log.username }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-[var(--color-pf-text-tertiary)]", children: log.ip }), _jsx("td", { className: "px-4 py-3", children: log.success ? (_jsx("span", { className: "text-xs text-pf-success", children: "Success" })) : (_jsx("span", { className: "text-xs text-pf-danger", children: "Failed" })) }), _jsx("td", { className: "px-4 py-3 text-xs text-[var(--color-pf-text-tertiary)]", children: log.failReason ?? '-' })] }))] }, log.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] })] }));
}
