import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Play, Pause, Square, Pencil, Zap, Shield, Filter, PlayCircle, FileText, Download, Share2, GitBranch, } from 'lucide-react';
import { toast } from 'sonner';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
    RUNNING: { dot: 'bg-pf-success', bg: 'bg-pf-success/10', text: 'text-pf-success' },
    PAPER: { dot: 'bg-pf-cyan-400', bg: 'bg-pf-cyan-500/10', text: 'text-pf-cyan-400' },
    PAUSED: { dot: 'bg-pf-warning', bg: 'bg-pf-warning/10', text: 'text-pf-warning' },
    IDLE: { dot: 'bg-gray-400', bg: 'bg-gray-500/10', text: 'text-gray-400' },
    ERROR: { dot: 'bg-pf-danger', bg: 'bg-pf-danger/10', text: 'text-pf-danger' },
    ARCHIVED: { dot: 'bg-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-500' },
};
const LOG_COLORS = {
    success: 'text-pf-success',
    info: 'text-pf-cyan-400',
    warning: 'text-pf-warning',
    error: 'text-pf-danger',
};
const LOG_DOT_COLORS = {
    success: 'bg-pf-success',
    info: 'bg-pf-cyan-400',
    warning: 'bg-pf-warning',
    error: 'bg-pf-danger',
};
function blockLabel(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function execLabel(s) {
    if (s.execMode === 'TICK')
        return `Tick \u00B7 ${s.tickMs}ms`;
    if (s.execMode === 'EVENT')
        return 'Event';
    return `Hybrid \u00B7 ${s.tickMs}ms`;
}
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function formatPnl(value) {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
}
function formatTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function isActive(status) { return status === 'RUNNING' || status === 'PAPER'; }
function isPaused(status) { return status === 'PAUSED'; }
function isIdle(status) { return status === 'IDLE' || status === 'ERROR'; }
/* ─── Section icons ──────────────────────────────────────────────────── */
const SECTION_ICONS = {
    safety: _jsx(Shield, { className: "size-3" }),
    trigger: _jsx(Zap, { className: "size-3" }),
    condition: _jsx(Filter, { className: "size-3" }),
    action: _jsx(PlayCircle, { className: "size-3" }),
};
const SECTION_STYLES = {
    safety: 'bg-pf-warning/10 text-pf-warning border-pf-warning/20',
    trigger: 'bg-pf-cyan-500/10 text-pf-cyan-400 border-pf-cyan-500/20',
    condition: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    action: 'bg-pf-success/10 text-pf-success border-pf-success/20',
};
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [strategy, setStrategy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [liveLog] = useState([]);
    const [childStrategies, setChildStrategies] = useState([]);
    const [parentStrategy, setParentStrategy] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        setLoading(true);
        fetch(`/api/v1/strategies/${id}`, { credentials: 'include' })
            .then((r) => {
            if (r.status === 404) {
                setNotFound(true);
                setLoading(false);
                return null;
            }
            if (r.status === 403) {
                setLoadError('You do not have permission to view this strategy.');
                setLoading(false);
                return null;
            }
            if (!r.ok) {
                setLoadError('Failed to load strategy. Please try again.');
                setLoading(false);
                return null;
            }
            return r.json();
        })
            .then((s) => {
            if (s) {
                setStrategy(s);
                setLoading(false);
                // Fetch children if any
                if (s.childCount > 0) {
                    fetch(`/api/v1/strategies/${s.id}/children`, { credentials: 'include' })
                        .then((r) => r.ok ? r.json() : { children: [] })
                        .then((res) => setChildStrategies(res.children ?? []))
                        .catch(() => setChildStrategies([]));
                }
                // Fetch parent if has one
                if (s.parentStrategyId) {
                    fetch(`/api/v1/strategies/${s.parentStrategyId}`, { credentials: 'include' })
                        .then((r) => r.ok ? r.json() : null)
                        .then((parent) => {
                        if (parent)
                            setParentStrategy({ id: parent.id, name: parent.name });
                    })
                        .catch(() => { });
                }
            }
        })
            .catch(() => { setLoadError('Failed to load strategy. Please try again.'); setLoading(false); });
    }, [id]);
    async function doAction(action, body) {
        if (!strategy)
            return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/v1/strategies/${strategy.id}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body ?? {}),
            });
            if (res.ok) {
                const data = await res.json();
                setStrategy((prev) => prev ? { ...prev, status: data.status } : prev);
                toast.success(`Strategy ${action}${action.endsWith('e') ? 'd' : 'ed'}`);
            }
            else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message ?? `Failed to ${action} strategy`);
            }
        }
        catch {
            toast.error(`Failed to ${action} strategy`);
        }
        finally {
            setActionLoading(false);
        }
    }
    async function handleExport() {
        if (!strategy)
            return;
        try {
            const res = await fetch(`/api/v1/strategies/${strategy.id}/export`, {
                credentials: 'include',
            });
            if (!res.ok) {
                toast.error('Failed to export strategy');
                return;
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition');
            const filenameMatch = disposition?.match(/filename="(.+)"/);
            const filename = filenameMatch?.[1] ?? `${strategy.name}.polyforge`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Strategy exported');
        }
        catch {
            toast.error('Failed to export strategy');
        }
    }
    function handleShare() {
        if (!strategy)
            return;
        const url = `${window.location.origin}/strategies/${strategy.id}`;
        navigator.clipboard.writeText(url).then(() => {
            toast.success('Link copied to clipboard');
        }).catch(() => {
            toast.error('Failed to copy link');
        });
    }
    const status = strategy?.status ?? 'IDLE';
    const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.IDLE;
    const totalBlocks = strategy
        ? strategy.safety.length + strategy.triggers.length + strategy.conditions.length + strategy.actions.length
        : 0;
    const pnl = strategy?.totalPnl ?? null;
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-5xl mx-auto space-y-6", children: [_jsxs(Link, { to: "/strategies", className: "inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text transition-colors", children: [_jsx(ArrowLeft, { className: "size-3.5" }), " Strategies"] }), loading && (_jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-7 bg-pf-overlay rounded w-[40%]" }), _jsx("div", { className: "h-4 bg-pf-overlay rounded w-[60%]" })] })), !loading && notFound && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("p", { className: "text-pf-text font-medium text-lg", children: "Strategy not found" }), _jsx("p", { className: "text-sm text-pf-text-muted mt-1", children: "This strategy may have been deleted or the link is invalid." }), _jsx("button", { onClick: () => navigate('/strategies'), className: "mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors", children: "Back to Strategies" })] })), !loading && loadError && (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-center", children: [_jsx("p", { className: "text-pf-text font-medium", children: loadError }), _jsx("button", { onClick: () => navigate('/strategies'), className: "mt-4 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text hover:border-pf-border-strong transition-colors", children: "Back to Strategies" })] })), !loading && strategy && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3 mb-1.5", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: strategy.name }), _jsxs("span", { "data-testid": "status-badge", className: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${isActive(status) ? 'animate-pulse-dot' : ''}` }), status] })] }), strategy.description && (_jsx("p", { className: "text-sm text-pf-text-secondary", children: strategy.description }))] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [isIdle(status) && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => doAction('start', { mode: 'live' }), disabled: actionLoading, className: "flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors", children: [_jsx(Zap, { className: "size-3.5" }), " Start Live"] }), _jsxs("button", { onClick: () => doAction('start', { mode: 'paper' }), disabled: actionLoading, className: "flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors", children: [_jsx(FileText, { className: "size-3.5" }), " Start Paper"] })] })), isActive(status) && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => doAction('pause'), disabled: actionLoading, className: "flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm text-pf-text-secondary hover:border-pf-border-strong disabled:opacity-40 transition-colors", children: [_jsx(Pause, { className: "size-3.5" }), " Pause"] }), _jsxs("button", { onClick: () => doAction('stop'), disabled: actionLoading, className: "flex items-center gap-2 px-3 py-2 rounded-pf text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors text-sm", children: [_jsx(Square, { className: "size-3.5" }), " Stop"] })] })), isPaused(status) && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => doAction('resume'), disabled: actionLoading, className: "flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-40 transition-colors", children: [_jsx(Play, { className: "size-3.5" }), " Resume"] }), _jsxs("button", { onClick: () => doAction('stop'), disabled: actionLoading, className: "flex items-center gap-2 px-3 py-2 rounded-pf text-pf-danger hover:bg-pf-danger/10 disabled:opacity-40 transition-colors text-sm", children: [_jsx(Square, { className: "size-3.5" }), " Stop"] })] })), _jsx(Link, { to: `/strategies/${strategy.id}/edit`, className: "p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors", "aria-label": "Edit strategy", title: "Edit", children: _jsx(Pencil, { className: "size-4" }) }), _jsx("button", { onClick: handleExport, className: "p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors", "aria-label": "Export strategy", title: "Export", children: _jsx(Download, { className: "size-4" }) }), _jsx("button", { onClick: handleShare, className: "p-2 rounded-pf bg-pf-elevated border border-pf-border text-pf-text-secondary hover:border-pf-border-strong transition-colors", "aria-label": "Share strategy", title: "Share", children: _jsx(Share2, { className: "size-4" }) })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium", children: execLabel(strategy) }), _jsxs("span", { className: "px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium", children: ["v", strategy.version] }), _jsx("span", { className: "px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium", children: strategy.visibility.toLowerCase() }), _jsxs("span", { className: "px-2.5 py-1 rounded-full bg-pf-overlay text-pf-text-secondary text-xs font-medium", children: [totalBlocks, " blocks"] }), strategy.tags.map((tag) => (_jsx("span", { className: "px-2.5 py-1 rounded-full bg-pf-cyan-500/10 text-pf-cyan-400 text-xs font-medium", children: tag }, tag))), _jsxs("span", { className: "px-2.5 py-1 rounded-full text-pf-text-muted text-xs ml-auto", children: ["Updated ", formatDate(strategy.updatedAt)] })] }), parentStrategy && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-pf-elevated border border-pf-border rounded-pf-lg", children: [_jsx(GitBranch, { className: "size-3.5 text-pf-text-muted" }), _jsx("span", { className: "text-xs text-pf-text-muted", children: "Part of:" }), _jsx(Link, { to: `/strategies/${parentStrategy.id}`, className: "text-xs text-pf-cyan-400 hover:underline font-medium", children: parentStrategy.name })] })), childStrategies.length > 0 && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsxs("h3", { className: "text-sm font-medium text-pf-text mb-3 flex items-center gap-2", children: [_jsx(GitBranch, { className: "size-4" }), "Sub-Strategies", _jsxs("span", { className: "text-xs text-pf-text-muted", children: ["(", childStrategies.length, ")"] })] }), _jsx("div", { className: "space-y-2", children: childStrategies.map((child) => {
                                    const childStyle = STATUS_STYLES[child.status] ?? STATUS_STYLES.IDLE;
                                    return (_jsxs(Link, { to: `/strategies/${child.id}`, className: "flex items-center justify-between px-3 py-2 rounded-pf-sm border border-pf-border-subtle hover:border-pf-border-strong transition-colors", children: [_jsx("span", { className: "text-xs text-pf-text font-medium", children: child.name }), _jsxs("span", { className: `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${childStyle.bg} ${childStyle.text}`, children: [_jsx("span", { className: `w-1 h-1 rounded-full ${childStyle.dot}` }), child.status] })] }, child.id));
                                }) })] })), pnl !== null && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-4", children: [_jsx("span", { className: "text-xs text-pf-text-muted block mb-1", children: "Total P&L" }), _jsx("span", { className: `font-mono text-2xl font-semibold ${pnl >= 0 ? 'text-pf-success' : 'text-pf-danger'}`, children: formatPnl(pnl) })] })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-5 gap-4", children: [_jsxs("div", { className: "lg:col-span-3 bg-pf-elevated border border-pf-border rounded-pf-lg p-5 space-y-5", children: [[
                                        { key: 'safety', title: 'Safety', blocks: strategy.safety },
                                        { key: 'trigger', title: 'Triggers', blocks: strategy.triggers },
                                        { key: 'condition', title: 'Conditions', blocks: strategy.conditions },
                                        { key: 'action', title: 'Actions', blocks: strategy.actions },
                                    ]
                                        .filter(({ blocks }) => blocks.length > 0)
                                        .map(({ key, title, blocks }) => (_jsxs("div", { children: [_jsx("h4", { className: "text-xs font-medium text-pf-text-secondary uppercase tracking-wider mb-2", children: title }), _jsx("div", { className: "flex flex-wrap gap-2", children: blocks.map((b, i) => (_jsxs("span", { className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pf-sm border text-xs font-medium ${SECTION_STYLES[key]}`, children: [SECTION_ICONS[key], blockLabel(b.type)] }, i))) })] }, key))), totalBlocks === 0 && (_jsxs("div", { className: "flex flex-col items-center py-8 text-center", children: [_jsx("p", { className: "text-sm text-pf-text-muted mb-3", children: "No blocks configured." }), _jsxs(Link, { to: `/strategies/${strategy.id}/edit`, className: "flex items-center gap-2 px-3 py-1.5 rounded-pf bg-pf-surface border border-pf-border text-xs text-pf-text-secondary hover:border-pf-border-strong transition-colors", children: [_jsx(Pencil, { className: "size-3" }), " Edit Strategy"] })] }))] }), _jsxs("div", { className: "lg:col-span-2 bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle", children: [_jsx("span", { className: "text-sm font-medium text-pf-text", children: "Live Events" }), isActive(status) && (_jsxs("span", { className: "flex items-center gap-1.5 text-xs text-pf-cyan-400", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-pf-cyan-400 animate-pulse-dot" }), "Live"] }))] }), _jsx("div", { className: "p-4 max-h-80 overflow-y-auto", children: liveLog.length === 0 ? (_jsxs("div", { className: "py-8 text-center text-sm text-pf-text-muted space-y-2", children: [_jsx("p", { children: isActive(status) ? 'Strategy is running.' : 'Start the strategy to generate events.' }), _jsxs("p", { className: "text-xs", children: ["Check the ", _jsx("a", { href: `/orders?strategy=${strategy?.id}`, className: "text-pf-cyan-400 hover:underline", children: "Orders" }), " page for trade activity."] })] })) : (_jsx("div", { className: "space-y-1.5", children: liveLog.map((entry, i) => (_jsxs("div", { className: "flex items-start gap-2 text-xs", children: [_jsx("span", { className: "font-mono text-pf-text-muted shrink-0 w-16", children: formatTime(entry.time) }), _jsx("span", { className: `w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${LOG_DOT_COLORS[entry.severity]}` }), _jsx("span", { className: LOG_COLORS[entry.severity], children: entry.message })] }, i))) })) })] })] })] }))] }));
}
