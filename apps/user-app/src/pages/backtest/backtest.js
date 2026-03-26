import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Play, ChevronLeft, ChevronRight, History, X, AlertTriangle, XCircle, Loader2, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
    QUEUED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
    RUNNING: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
    COMPLETED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
    FAILED: { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
    CANCELLED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
};
function pnlColor(val) {
    if (!val)
        return 'text-pf-text-muted';
    return parseFloat(val) >= 0 ? 'text-pf-success' : 'text-pf-danger';
}
function pnlSign(val) {
    if (!val)
        return '\u2014';
    const v = parseFloat(val);
    return v > 0 ? `+${val}` : val;
}
function winRatePct(val) {
    if (!val)
        return '\u2014';
    return `${(parseFloat(val) * 100).toFixed(1)}%`;
}
function dateRangeLabel(run) {
    const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(run.dateRangeStart)} \u2192 ${fmt(run.dateRangeEnd)}`;
}
function formatShortDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [selectedRun, setSelectedRun] = useState(null);
    // Form state
    const [strategies, setStrategies] = useState([]);
    const [selectedStratId, setSelectedStratId] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const loadHistory = useCallback(async (p) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/backtests?page=${p}&limit=20`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setRuns(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load backtests');
        }
        setLoading(false);
    }, []);
    useEffect(() => {
        // Load strategies for the form (only once on mount)
        fetch('/api/v1/strategies?limit=100', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.data)
            setStrategies(data.data); })
            .catch(() => { });
    }, []);
    // Load history when page changes (handles initial mount too)
    useEffect(() => { loadHistory(page); }, [page, loadHistory]);
    const canSubmit = selectedStratId && dateStart && dateEnd && !submitting;
    async function submit() {
        if (!canSubmit)
            return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/v1/backtests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    strategyId: selectedStratId,
                    dateRangeStart: new Date(dateStart).toISOString(),
                    dateRangeEnd: new Date(dateEnd).toISOString(),
                }),
            });
            if (res.ok) {
                toast.success('Backtest queued');
                setPage(1);
                loadHistory(1);
            }
            else {
                toast.error('Failed to submit backtest');
            }
        }
        catch {
            toast.error('Failed to submit backtest');
        }
        setSubmitting(false);
    }
    function selectRun(run) {
        setSelectedRun(prev => prev?.id === run.id ? null : run);
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Backtest" }), !loading && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [total, " runs"] })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Play, { className: "size-4 text-pf-cyan-400" }), _jsx("span", { className: "text-sm font-medium text-pf-text", children: "New Backtest" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block", children: "Strategy" }), _jsxs("select", { value: selectedStratId, onChange: e => setSelectedStratId(e.target.value), className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: [_jsx("option", { value: "", children: "Select strategy" }), strategies.map(s => _jsx("option", { value: s.id, children: s.name }, s.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block", children: "Start Date" }), _jsx("input", { type: "date", value: dateStart, onChange: e => setDateStart(e.target.value), className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary uppercase tracking-wider mb-1.5 block", children: "End Date" }), _jsx("input", { type: "date", value: dateEnd, onChange: e => setDateEnd(e.target.value), className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsx("div", { className: "flex items-end", children: _jsxs("button", { onClick: submit, disabled: !canSubmit, className: "w-full h-9 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2", children: [submitting ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Play, { className: "size-4" }), "Run Backtest"] }) })] })] }), selectedRun && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-pf-text", children: selectedRun.strategyName ?? 'Unnamed Strategy' }), _jsx("div", { className: "text-xs font-mono text-pf-text-muted mt-1", children: dateRangeLabel(selectedRun) })] }), _jsx("button", { onClick: () => setSelectedRun(null), className: "text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-4" }) })] }), (selectedRun.status === 'RUNNING' || selectedRun.status === 'QUEUED') && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs text-pf-text-muted", children: selectedRun.status === 'QUEUED' ? 'Waiting in queue...' : 'Running...' }), _jsxs("span", { className: "text-xs font-mono text-pf-cyan-400", children: [selectedRun.progress, "%"] })] }), _jsx("div", { className: "h-1.5 bg-pf-overlay rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-pf-cyan-500 rounded-full transition-all", style: { width: `${selectedRun.progress}%` } }) })] })), selectedRun.status === 'COMPLETED' && (_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-pf-surface rounded-pf p-3", children: [_jsx("span", { className: "text-xs text-pf-text-muted block", children: "Total P&L" }), _jsx("span", { className: `text-lg font-mono font-semibold ${pnlColor(selectedRun.totalPnl)}`, children: pnlSign(selectedRun.totalPnl) })] }), _jsxs("div", { className: "bg-pf-surface rounded-pf p-3", children: [_jsx("span", { className: "text-xs text-pf-text-muted block", children: "Win Rate" }), _jsx("span", { className: "text-lg font-mono font-semibold text-pf-text", children: winRatePct(selectedRun.winRate) })] }), _jsxs("div", { className: "bg-pf-surface rounded-pf p-3", children: [_jsx("span", { className: "text-xs text-pf-text-muted block", children: "Orders Placed" }), _jsx("span", { className: "text-lg font-mono font-semibold text-pf-text", children: selectedRun.totalOrders ?? '\u2014' })] }), _jsxs("div", { className: "bg-pf-surface rounded-pf p-3", children: [_jsx("span", { className: "text-xs text-pf-text-muted block", children: "Orders Filled" }), _jsx("span", { className: "text-lg font-mono font-semibold text-pf-text", children: selectedRun.filledOrders ?? '\u2014' })] }), selectedRun.hasDataGaps && (_jsxs("div", { className: "col-span-full flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-warning/10 text-pf-warning text-xs", children: [_jsx(AlertTriangle, { className: "size-3.5 shrink-0" }), "Results may be affected by data gaps in the selected date range."] }))] })), selectedRun.status === 'FAILED' && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-danger/10 text-pf-danger text-sm", children: [_jsx(XCircle, { className: "size-4 shrink-0" }), selectedRun.error ?? 'Backtest failed.'] }))] })), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Strategy" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Date Range" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Progress" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "P&L" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Win Rate" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Created" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: loading ? (Array.from({ length: 5 }, (_, i) => (_jsx("tr", { children: Array.from({ length: 7 }, (_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-3 bg-pf-overlay rounded animate-pulse" }) }, j))) }, i)))) : runs.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, children: _jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(History, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No backtest runs yet" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Select a strategy and date range above, then click Run Backtest." })] }) }) })) : (runs.map(run => {
                                    const ss = STATUS_STYLES[run.status] ?? STATUS_STYLES.QUEUED;
                                    return (_jsxs("tr", { tabIndex: 0, onClick: () => selectRun(run), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                                            selectRun(run); }, className: `hover:bg-pf-surface/50 transition-colors cursor-pointer ${selectedRun?.id === run.id ? 'bg-pf-cyan-500/5' : ''}`, children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-[13px] font-medium text-pf-text", children: run.strategyName ?? '\u2014' }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: dateRangeLabel(run) }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`, children: run.status }) }), _jsx("td", { className: "px-4 py-3", children: run.status === 'RUNNING' ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1.5 bg-pf-overlay rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-pf-cyan-500 rounded-full", style: { width: `${run.progress}%` } }) }), _jsxs("span", { className: "font-mono text-[11px] text-pf-cyan-400", children: [run.progress, "%"] })] })) : run.status === 'COMPLETED' ? (_jsx("span", { className: "font-mono text-[11px] text-pf-success", children: "100%" })) : (_jsx("span", { className: "text-pf-text-muted", children: "\\u2014" })) }), _jsx("td", { className: `px-4 py-3 text-right font-mono ${pnlColor(run.totalPnl)}`, children: pnlSign(run.totalPnl) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: winRatePct(run.winRate) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: formatShortDate(run.createdAt) }) })] }, run.id));
                                })) })] }) }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] }));
}
