import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Play, Pause, Square, Pencil, Zap, FileText, Code2, Download, Upload, } from 'lucide-react';
import { toast } from 'sonner';
/* ─── Helpers ────────────────────────────────────────────────────────── */
function statusGradient(status) {
    switch (status) {
        case 'RUNNING': return 'var(--color-pf-success)';
        case 'PAPER': return 'var(--color-pf-cyan-500)';
        case 'PAUSED': return 'var(--color-pf-warning)';
        case 'ERROR': return 'var(--color-pf-danger)';
        case 'IDLE':
        default: return 'var(--color-pf-border)';
    }
}
const STATUS_STYLES = {
    RUNNING: { dot: 'bg-pf-success', bg: 'bg-pf-success/10', text: 'text-pf-success' },
    PAPER: { dot: 'bg-pf-cyan-400', bg: 'bg-pf-cyan-500/10', text: 'text-pf-cyan-400' },
    PAUSED: { dot: 'bg-pf-warning', bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
    IDLE: { dot: 'bg-gray-400', bg: 'bg-gray-500/10', text: 'text-gray-400' },
    ERROR: { dot: 'bg-pf-danger', bg: 'bg-pf-danger/10', text: 'text-pf-danger' },
    ARCHIVED: { dot: 'bg-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-500' },
};
const FILTERS = [
    { label: 'All', value: 'ALL' },
    { label: 'Running', value: 'RUNNING' },
    { label: 'Paused', value: 'PAUSED' },
    { label: 'Idle', value: 'IDLE' },
    { label: 'Paper', value: 'PAPER' },
    { label: 'Error', value: 'ERROR' },
];
function execLabel(s) {
    if (s.execMode === 'TICK')
        return `Tick \u00B7 ${s.tickMs}ms`;
    if (s.execMode === 'EVENT')
        return 'Event';
    return `Hybrid \u00B7 ${s.tickMs}ms`;
}
function blocksCount(s) {
    return s.safety.length + s.triggers.length + s.conditions.length + s.actions.length;
}
function formatPnl(value) {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
}
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
/* ─── Skeleton ───────────────────────────────────────────────────────── */
function CardSkeleton() {
    return (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-3 animate-shimmer", children: [_jsx("div", { className: "h-5 bg-pf-overlay rounded w-[60%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[40%]" }), _jsx("div", { className: "h-3 bg-pf-overlay rounded w-[80%]" })] }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const navigate = useNavigate();
    const [strategies, setStrategies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [actionLoading, setActionLoading] = useState({});
    function load(status) {
        setLoading(true);
        const params = new URLSearchParams({ limit: '50' });
        const s = status ?? filter;
        if (s !== 'ALL')
            params.set('status', s);
        fetch(`/api/v1/strategies?${params}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((res) => {
            setStrategies(res.data);
            setLoading(false);
        })
            .catch(() => setLoading(false));
    }
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    function onFilterChange(f) {
        setFilter(f);
        load(f);
    }
    async function doAction(strategyId, action, body) {
        setActionLoading((prev) => ({ ...prev, [strategyId]: true }));
        try {
            const res = await fetch(`/api/v1/strategies/${strategyId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body ?? {}),
            });
            if (res.ok) {
                const data = await res.json();
                setStrategies((prev) => prev.map((s) => (s.id === strategyId ? { ...s, status: data.status } : s)));
            }
        }
        finally {
            setActionLoading((prev) => ({ ...prev, [strategyId]: false }));
        }
    }
    async function handleExport(e, strategyId) {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/v1/strategies/${strategyId}/export`, {
                credentials: 'include',
            });
            if (!res.ok) {
                toast.error('Failed to export strategy');
                return;
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition');
            const filenameMatch = disposition?.match(/filename="(.+)"/);
            const filename = filenameMatch?.[1] ?? 'strategy.polyforge';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        catch {
            toast.error('Failed to export strategy');
        }
    }
    function handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.polyforge,.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const res = await fetch('/api/v1/strategies/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(data),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    toast.error(err.message ?? 'Failed to import strategy');
                    return;
                }
                const created = await res.json();
                toast.success('Strategy imported successfully');
                navigate(`/strategies/${created.id}`);
            }
            catch {
                toast.error('Invalid strategy file');
            }
        };
        input.click();
    }
    function isActive(s) { return s.status === 'RUNNING' || s.status === 'PAPER'; }
    function isPaused(s) { return s.status === 'PAUSED'; }
    function isIdle(s) { return s.status === 'IDLE' || s.status === 'ERROR'; }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "My Strategies" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: handleImport, className: "flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary font-medium hover:border-pf-border-strong transition-colors", children: [_jsx(Upload, { className: "size-4" }), " Import Strategy"] }), _jsxs(Link, { to: "/strategies/new", className: "flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: [_jsx(Plus, { className: "size-4" }), " New Strategy"] })] })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: FILTERS.map((f) => (_jsx("button", { onClick: () => onFilterChange(f.value), className: `px-3 py-1.5 text-sm rounded-full border transition-colors ${filter === f.value
                        ? 'bg-pf-cyan-500/10 border-pf-cyan-500/30 text-pf-cyan-400'
                        : 'border-pf-border text-pf-text-secondary hover:text-pf-text'}`, children: f.label }, f.value))) }), loading && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [1, 2, 3, 4].map((i) => _jsx(CardSkeleton, {}, i)) })), !loading && strategies.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx(Code2, { className: "size-10 text-pf-text-muted mb-4" }), _jsx("p", { className: "text-pf-text font-medium", children: "No strategies yet" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "Create your first strategy to start trading." }), _jsxs(Link, { to: "/strategies/new", className: "mt-4 flex items-center gap-2 px-4 py-2.5 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 transition-colors", children: [_jsx(Plus, { className: "size-4" }), " New Strategy"] })] })), !loading && strategies.length > 0 && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children", children: strategies.map((strategy) => {
                    const statusStyle = STATUS_STYLES[strategy.status] ?? STATUS_STYLES.IDLE;
                    const pnl = strategy.totalPnl ?? null;
                    const busy = !!actionLoading[strategy.id];
                    return (_jsxs("div", { "data-testid": "strategy-card", role: "link", tabIndex: 0, onClick: () => navigate(`/strategies/${strategy.id}`), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                            navigate(`/strategies/${strategy.id}`); }, className: "group bg-pf-elevated border border-pf-border rounded-pf-lg p-5 cursor-pointer transition-all duration-200 hover:border-pf-border-strong hover:shadow-pf-sm hover:-translate-y-0.5 overflow-hidden", children: [_jsx("div", { className: "h-1 -mx-5 -mt-5 mb-4 rounded-t-pf-lg", style: { background: statusGradient(strategy.status) } }), _jsxs("div", { className: "flex items-start justify-between gap-3 mb-2", children: [_jsx("h3", { className: "text-sm font-medium text-pf-text leading-snug line-clamp-1 group-hover:text-pf-cyan-400 transition-colors", children: strategy.name }), _jsxs("span", { "data-testid": "status-badge", className: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusStyle.bg} ${statusStyle.text}`, children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-full ${statusStyle.dot} ${strategy.status === 'RUNNING' ? 'animate-pulse-dot' : ''}` }), strategy.status] })] }), _jsxs("div", { className: "flex flex-wrap gap-1.5 mb-2", children: [_jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full bg-pf-cyan-500/10 text-pf-cyan-400 text-[11px] font-medium", children: execLabel(strategy) }), _jsxs("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted text-[11px] font-medium", children: [blocksCount(strategy), " blocks"] }), strategy.tags.length > 0 && (_jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full bg-pf-overlay text-pf-text-muted text-[11px] font-medium", children: strategy.tags[0] })), _jsxs("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[11px] font-medium ml-auto", children: ["v", strategy.version] })] }), strategy.description && (_jsx("p", { className: "text-xs text-pf-text-secondary line-clamp-2 mb-3", children: strategy.description })), pnl !== null && (_jsx("div", { className: "mb-3", children: _jsx("span", { className: `font-mono text-sm font-medium ${pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`, children: formatPnl(pnl) }) })), _jsxs("div", { className: "flex items-center justify-between pt-3 border-t border-pf-border-subtle", onClick: (e) => e.stopPropagation(), children: [_jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: formatDate(strategy.updatedAt) }), _jsxs("div", { className: "flex items-center gap-1", children: [isIdle(strategy) && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: (e) => { e.stopPropagation(); doAction(strategy.id, 'start', { mode: 'live' }); }, disabled: busy, className: "flex items-center gap-1 px-2 py-1 rounded-pf-sm bg-pf-cyan-500/10 text-pf-cyan-400 text-[11px] font-medium hover:bg-pf-cyan-500/20 disabled:opacity-40 transition-colors", title: "Start Live", children: [_jsx(Zap, { className: "size-3" }), " Live"] }), _jsxs("button", { onClick: (e) => { e.stopPropagation(); doAction(strategy.id, 'start', { mode: 'paper' }); }, disabled: busy, className: "flex items-center gap-1 px-2 py-1 rounded-pf-sm bg-pf-overlay text-pf-text-secondary text-[11px] font-medium hover:bg-pf-border-subtle disabled:opacity-40 transition-colors", title: "Start Paper", children: [_jsx(FileText, { className: "size-3" }), " Paper"] })] })), isActive(strategy) && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); doAction(strategy.id, 'pause'); }, disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-text-secondary hover:bg-pf-overlay disabled:opacity-40 transition-colors", "aria-label": "Pause strategy", title: "Pause", children: _jsx(Pause, { className: "size-3.5" }) }), _jsx("button", { onClick: (e) => { e.stopPropagation(); doAction(strategy.id, 'stop'); }, disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors", "aria-label": "Stop strategy", title: "Stop", children: _jsx(Square, { className: "size-3.5" }) })] })), isPaused(strategy) && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); doAction(strategy.id, 'resume'); }, disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-cyan-400 hover:bg-pf-cyan-500/10 disabled:opacity-40 transition-colors", "aria-label": "Resume strategy", title: "Resume", children: _jsx(Play, { className: "size-3.5" }) }), _jsx("button", { onClick: (e) => { e.stopPropagation(); doAction(strategy.id, 'stop'); }, disabled: busy, className: "p-1.5 rounded-pf-sm text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors", "aria-label": "Stop strategy", title: "Stop", children: _jsx(Square, { className: "size-3.5" }) })] })), _jsx("button", { onClick: (e) => handleExport(e, strategy.id), className: "p-1.5 rounded-pf-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-overlay transition-colors", "aria-label": "Export strategy", title: "Export", children: _jsx(Download, { className: "size-3.5" }) }), _jsx(Link, { to: `/strategies/${strategy.id}/edit`, onClick: (e) => e.stopPropagation(), className: "p-1.5 rounded-pf-sm text-pf-text-secondary hover:text-pf-text hover:bg-pf-overlay transition-colors", "aria-label": "Edit strategy", title: "Edit", children: _jsx(Pencil, { className: "size-3.5" }) })] })] })] }, strategy.id));
                }) }))] }));
}
