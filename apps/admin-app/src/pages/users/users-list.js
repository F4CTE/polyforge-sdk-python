import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Check, X, Wifi, Shield, Users, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate } from '@/lib/utils';
function computeUserStatus(user) {
    if (user.suspended)
        return 'SUSPENDED';
    if (user.polymarketConnected)
        return 'CONNECTED';
    if (user.emailVerified)
        return 'VERIFIED';
    return 'UNVERIFIED';
}
export function Component() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const limit = 20;
    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const params = {
                page,
                limit,
                search: search || undefined,
            };
            // Map status filter to backend-supported query params
            if (statusFilter === 'SUSPENDED') {
                params.suspended = true;
            }
            const res = await adminApi.users(params);
            let data = res.data ?? [];
            // Client-side filtering for statuses not supported by backend
            if (statusFilter && statusFilter !== 'SUSPENDED') {
                data = data.filter((u) => computeUserStatus(u) === statusFilter);
            }
            setUsers(data);
            setTotal(statusFilter && statusFilter !== 'SUSPENDED' ? data.length : (res.total ?? 0));
            setTotalPages(statusFilter && statusFilter !== 'SUSPENDED' ? 1 : (res.pages ?? 1));
        }
        catch {
            setError(true);
            toast.error('Failed to load users');
        }
        finally {
            setLoading(false);
        }
    }, [page, search, statusFilter]);
    useEffect(() => {
        load();
    }, [load]);
    const debounceRef = useRef(undefined);
    function handleSearch(value) {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearch(value);
            setPage(1);
        }, 300);
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: ["Users ", _jsxs("span", { className: "text-sm font-normal text-[var(--color-pf-text-tertiary)]", children: ["(", total, ")"] })] }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "relative flex-1 min-w-[200px] max-w-xs", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-pf-text-tertiary)]" }), _jsx("input", { type: "text", placeholder: "Search users...", defaultValue: search, onChange: (e) => handleSearch(e.target.value), className: "w-full pl-9 pr-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] }), _jsxs("select", { value: statusFilter, onChange: (e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }, className: "px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]", children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "UNVERIFIED", children: "Unverified" }), _jsx("option", { value: "VERIFIED", children: "Verified" }), _jsx("option", { value: "CONNECTED", children: "Connected" }), _jsx("option", { value: "SUSPENDED", children: "Suspended" })] })] }), error && (_jsxs("div", { className: "text-center py-12", children: [_jsx(AlertCircle, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)]", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] mb-4", children: "Failed to load data" }), _jsx("button", { onClick: load, className: "text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-sm", children: "Try again" })] })), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Username" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Verified" }), _jsx("th", { className: "text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "2FA" }), _jsx("th", { className: "text-center px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Connected" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase tracking-wider", children: "Created" })] }) }), _jsx("tbody", { children: loading ? (Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 7 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i)))) : users.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: 7, className: "text-center py-12", children: [_jsx(Users, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No users found" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Try adjusting your search or filters" })] }) })) : (users.map((user) => (_jsxs("tr", { role: "link", tabIndex: 0, onClick: () => navigate(`/users/${user.id}`), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                                            navigate(`/users/${user.id}`); }, className: "border-b border-[var(--color-pf-border)] last:border-0 hover:bg-[var(--color-pf-bg)] cursor-pointer transition-colors", children: [_jsxs("td", { className: "px-4 py-3 font-medium text-[var(--color-pf-text)]", children: [user.username ?? '', user.suspended && (_jsx("span", { className: "ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium text-pf-danger bg-pf-danger/10", children: "SUSPENDED" }))] }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-secondary)]", children: user.email ?? '' }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(computeUserStatus(user))}`, children: computeUserStatus(user) }) }), _jsx("td", { className: "px-4 py-3 text-center", children: user.emailVerified ? (_jsx(Check, { size: 14, className: "inline text-pf-success" })) : (_jsx(X, { size: 14, className: "inline text-[var(--color-pf-text-tertiary)]" })) }), _jsx("td", { className: "px-4 py-3 text-center", children: user.totpEnabled ? (_jsx(Shield, { size: 14, className: "inline text-pf-success" })) : (_jsx(X, { size: 14, className: "inline text-[var(--color-pf-text-tertiary)]" })) }), _jsx("td", { className: "px-4 py-3 text-center", children: user.polymarketConnected ? (_jsx(Wifi, { size: 14, className: "inline text-pf-success" })) : (_jsx(X, { size: 14, className: "inline text-[var(--color-pf-text-tertiary)]" })) }), _jsx("td", { className: "px-4 py-3 text-[var(--color-pf-text-tertiary)]", children: formatDate(user.createdAt) })] }, user.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-t border-[var(--color-pf-border)]", children: [_jsxs("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, "aria-label": "Previous page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, "aria-label": "Next page", className: "p-1.5 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(ChevronRight, { size: 16 }) })] })] }))] })] }));
}
