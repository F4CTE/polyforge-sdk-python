import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Users, Blocks, ShoppingCart, TicketCheck, Activity, Database, Server, ToggleLeft, ToggleRight, AlertCircle, Clock, ShieldAlert, } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, timeAgo } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
export function Component() {
    const { isSuperAdmin } = useAdminAuthStore();
    const [health, setHealth] = useState(null);
    const [config, setConfig] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeStrategies: 0,
        totalOrders: 0,
        openTickets: 0,
    });
    const [rateLimits, setRateLimits] = useState(null);
    const [loading, setLoading] = useState(true);
    const [healthError, setHealthError] = useState(false);
    const [statsError, setStatsError] = useState(false);
    const [logsError, setLogsError] = useState(false);
    const [rateLimitsError, setRateLimitsError] = useState(false);
    async function load() {
        setLoading(true);
        setHealthError(false);
        setStatsError(false);
        setLogsError(false);
        setRateLimitsError(false);
        // Fetch all independent API calls in parallel
        const [healthResult, configResult, statsResult, logsResult, rlResult] = await Promise.allSettled([
            adminApi.health(),
            adminApi.config(),
            Promise.all([
                adminApi.users({ limit: 1 }),
                adminApi.strategies({ limit: 1, status: 'RUNNING' }),
                adminApi.orders({ limit: 1 }),
                adminApi.tickets({ limit: 1, status: 'OPEN' }),
            ]),
            adminApi.auditLogs({ limit: 5 }),
            adminApi.rateLimits(),
        ]);
        if (healthResult.status === 'fulfilled')
            setHealth(healthResult.value ?? null);
        else
            setHealthError(true);
        if (configResult.status === 'fulfilled')
            setConfig(configResult.value ?? null);
        if (statsResult.status === 'fulfilled') {
            const [usersRes, strategiesRes, ordersRes, ticketsRes] = statsResult.value;
            setStats({
                totalUsers: usersRes?.total ?? 0,
                activeStrategies: strategiesRes?.total ?? 0,
                totalOrders: ordersRes?.total ?? 0,
                openTickets: ticketsRes?.total ?? 0,
            });
        }
        else {
            setStatsError(true);
        }
        if (logsResult.status === 'fulfilled') {
            setAuditLogs(Array.isArray(logsResult.value?.data) ? logsResult.value.data : []);
        }
        else {
            setLogsError(true);
        }
        if (rlResult.status === 'fulfilled')
            setRateLimits(rlResult.value);
        else
            setRateLimitsError(true);
        setLoading(false);
    }
    useEffect(() => {
        load();
    }, []);
    async function toggleInviteOnly() {
        if (!config)
            return;
        try {
            const res = await adminApi.setInviteOnly(!config.inviteOnly);
            setConfig(res);
            toast.success(`Invite-only ${res.inviteOnly ? 'enabled' : 'disabled'}`);
        }
        catch {
            toast.error('Failed to update config');
        }
    }
    if (loading) {
        return (_jsx("div", { className: "space-y-6", children: _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [1, 2, 3, 4].map(i => (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4 animate-pulse", children: [_jsx("div", { className: "h-3 bg-[var(--color-pf-bg)] rounded w-24 mb-3" }), _jsx("div", { className: "h-7 bg-[var(--color-pf-bg)] rounded w-16" })] }, i))) }) }));
    }
    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: _jsx(Users, { size: 20 }), color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Active Strategies', value: stats.activeStrategies, icon: _jsx(Blocks, { size: 20 }), color: 'text-pf-success', bg: 'bg-pf-success/10' },
        { label: 'Total Orders', value: stats.totalOrders, icon: _jsx(ShoppingCart, { size: 20 }), color: 'text-violet-400', bg: 'bg-violet-400/10' },
        { label: 'Open Tickets', value: stats.openTickets, icon: _jsx(TicketCheck, { size: 20 }), color: 'text-pf-warning', bg: 'bg-pf-warning/10' },
    ];
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [statsError ? (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 text-center", children: [_jsx(AlertCircle, { className: "mx-auto mb-2 text-[var(--color-pf-text-tertiary)]", size: 24 }), _jsx("p", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: "Stats unavailable" })] })) : (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children", children: statCards.map((card) => (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-xs font-medium text-[var(--color-pf-text-secondary)]", children: card.label }), _jsx("div", { className: `p-2 rounded-pf-sm ${card.bg}`, children: _jsx("span", { className: card.color, children: card.icon }) })] }), _jsx("div", { className: "text-2xl font-bold text-[var(--color-pf-text)]", children: card.value.toLocaleString() })] }, card.label))) })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [healthError ? (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Activity, { size: 16, className: "text-[var(--color-pf-text-tertiary)]" }), _jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "System Health" })] }), _jsxs("div", { className: "text-center py-6", children: [_jsx(AlertCircle, { className: "mx-auto mb-2 text-[var(--color-pf-text-tertiary)]", size: 24 }), _jsx("p", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: "Health unavailable" }), _jsx("button", { onClick: load, className: "text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-xs mt-2", children: "Retry" })] })] })) : health ? (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Activity, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "System Health" }), _jsx("span", { className: `ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(health.status)}`, children: health.status })] }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: Object.entries(health.services ?? {}).map(([name, svc]) => (_jsxs("div", { className: "flex items-center justify-between p-2.5 rounded-pf-sm bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-[var(--color-pf-text)] capitalize", children: name }), _jsxs("div", { className: "text-[11px] text-[var(--color-pf-text-tertiary)]", children: [svc?.latencyMs ?? 0, "ms"] })] }), _jsx("span", { className: `w-2 h-2 rounded-full ${svc?.status === 'healthy'
                                                ? 'bg-pf-success'
                                                : svc?.status === 'degraded'
                                                    ? 'bg-pf-warning'
                                                    : 'bg-pf-danger'}` })] }, name))) })] })) : null, _jsxs("div", { className: "space-y-4", children: [health?.db && (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Database, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Database" }), _jsx("span", { className: `ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(health.db?.status)}`, children: health.db?.status ?? 'UNKNOWN' })] }), _jsxs("div", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: ["Active connections: ", _jsx("span", { className: "text-[var(--color-pf-text)] font-medium", children: health.db?.connections ?? 0 })] })] })), health?.redis && (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Server, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Redis" }), _jsx("span", { className: `ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(health.redis?.status)}`, children: health.redis?.status ?? 'UNKNOWN' })] }), _jsxs("div", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: ["Memory usage: ", _jsxs("span", { className: "text-[var(--color-pf-text)] font-medium", children: [(health.redis?.memoryUsageMb ?? 0).toFixed(1), " MB"] })] })] })), _jsx("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Launch Control" }), _jsx("p", { className: "text-xs text-[var(--color-pf-text-tertiary)] mt-0.5", children: "Invite-only registration" })] }), _jsx("button", { onClick: toggleInviteOnly, disabled: !isSuperAdmin, className: `transition-colors ${isSuperAdmin ? 'text-[var(--color-pf-cyan-500)] hover:text-[var(--color-pf-cyan-400)]' : 'text-[var(--color-pf-text-tertiary)] opacity-50 cursor-not-allowed'}`, "aria-label": "Toggle invite-only", title: !isSuperAdmin ? 'Super Admin only' : undefined, children: config?.inviteOnly ? (_jsx(ToggleRight, { size: 32 })) : (_jsx(ToggleLeft, { size: 32, className: "text-[var(--color-pf-text-tertiary)]" })) })] }) })] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(ShieldAlert, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Rate Limiting" })] }), rateLimitsError ? (_jsxs("div", { className: "text-center py-4", children: [_jsx(AlertCircle, { className: "mx-auto mb-2 text-[var(--color-pf-text-tertiary)]", size: 20 }), _jsx("p", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: "Rate limit data unavailable" })] })) : rateLimits ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)] rounded-pf-sm p-3", children: [_jsx("span", { className: "text-[11px] text-[var(--color-pf-text-tertiary)] uppercase", children: "Tracked Keys" }), _jsx("span", { className: "block text-lg font-bold text-[var(--color-pf-text)]", children: rateLimits.totalTrackedKeys })] }), _jsxs("div", { className: "bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)] rounded-pf-sm p-3", children: [_jsx("span", { className: "text-[11px] text-[var(--color-pf-text-tertiary)] uppercase", children: "Recent 429s" }), _jsx("span", { className: `block text-lg font-bold ${rateLimits.recent429Count > 0 ? 'text-pf-warning' : 'text-[var(--color-pf-text)]'}`, children: rateLimits.recent429Count })] }), _jsxs("div", { className: "bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)] rounded-pf-sm p-3", children: [_jsx("span", { className: "text-[11px] text-[var(--color-pf-text-tertiary)] uppercase", children: "Top Offenders" }), _jsx("span", { className: "block text-lg font-bold text-[var(--color-pf-text)]", children: rateLimits.topOffenders?.length ?? 0 })] })] }), rateLimits.topOffenders?.length > 0 && (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[var(--color-pf-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "pb-2 font-medium", children: "Identifier" }), _jsx("th", { className: "pb-2 font-medium text-right", children: "Hits" }), _jsx("th", { className: "pb-2 font-medium text-right", children: "TTL (s)" })] }) }), _jsx("tbody", { className: "divide-y divide-[var(--color-pf-border)]", children: rateLimits.topOffenders.slice(0, 10).map((entry, i) => (_jsxs("tr", { children: [_jsx("td", { className: "py-1.5 font-mono text-[var(--color-pf-text-secondary)] truncate max-w-[200px]", children: entry.key }), _jsx("td", { className: `py-1.5 text-right font-mono ${entry.hits > 50 ? 'text-pf-danger' : 'text-[var(--color-pf-text)]'}`, children: entry.hits }), _jsx("td", { className: "py-1.5 text-right font-mono text-[var(--color-pf-text-secondary)]", children: entry.ttl })] }, i))) })] }) }))] })) : (_jsx("p", { className: "text-sm text-[var(--color-pf-text-tertiary)]", children: "Loading..." }))] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsx("h2", { className: "text-sm font-semibold text-[var(--color-pf-text)] mb-4", children: "Recent Activity" }), logsError ? (_jsxs("div", { className: "text-center py-4", children: [_jsx(Clock, { className: "mx-auto mb-2 text-[var(--color-pf-text-tertiary)]", size: 20 }), _jsx("p", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: "No recent activity" }), _jsx("p", { className: "text-xs text-[var(--color-pf-text-tertiary)] mt-1", children: "Activity will appear here as admins take actions." }), _jsx("button", { onClick: load, className: "text-[var(--color-pf-cyan-400)] hover:text-[var(--color-pf-cyan-300)] text-xs mt-2", children: "Refresh" })] })) : auditLogs.length === 0 ? (_jsx("p", { className: "text-sm text-[var(--color-pf-text-tertiary)]", children: "No recent activity" })) : (_jsx("div", { className: "space-y-3", children: auditLogs.map((log) => (_jsxs("div", { className: "flex items-center justify-between py-2 border-b border-[var(--color-pf-border)] last:border-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-pf-bg)] text-[var(--color-pf-cyan-500)] border border-[var(--color-pf-border)]", children: log.action }), _jsxs("span", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: [log.target ? `${log.target}` : '', log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''] })] }), _jsx("span", { className: "text-xs text-[var(--color-pf-text-tertiary)] whitespace-nowrap", children: timeAgo(log.createdAt) })] }, log.id))) }))] })] }));
}
