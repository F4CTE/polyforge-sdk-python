import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ClipboardList, X, Plus, Trash2, } from 'lucide-react';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const FILTERS = [
    { label: 'All', value: 'ALL' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Live', value: 'LIVE' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'Failed', value: 'FAILED' },
];
const STATUS_STYLES = {
    PENDING: { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
    SUBMITTED: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
    LIVE: { text: 'text-pf-cyan-400', bg: 'bg-pf-cyan-500/10' },
    MATCHED: { text: 'text-pf-cyan-300', bg: 'bg-pf-cyan-500/8' },
    CONFIRMED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
    CANCELLED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
    FAILED: { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
};
const CONDITIONAL_TYPE_STYLES = {
    TAKE_PROFIT: { text: 'text-pf-success', bg: 'bg-pf-success/10', label: 'TP' },
    STOP_LOSS: { text: 'text-pf-danger', bg: 'bg-pf-danger/10', label: 'SL' },
    TRAILING_STOP: { text: 'text-pf-warning', bg: 'bg-pf-warning/10', label: 'TRAILING' },
    LIMIT: { text: 'text-blue-400', bg: 'bg-blue-500/10', label: 'LIMIT' },
    PEGGED: { text: 'text-purple-400', bg: 'bg-purple-500/10', label: 'PEGGED' },
};
const CONDITIONAL_STATUS_STYLES = {
    PENDING: { text: 'text-pf-warning', bg: 'bg-pf-warning/10' },
    TRIGGERED: { text: 'text-pf-success', bg: 'bg-pf-success/10' },
    CANCELLED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
    EXPIRED: { text: 'text-pf-text-muted', bg: 'bg-pf-overlay' },
    FAILED: { text: 'text-pf-danger', bg: 'bg-pf-danger/10' },
};
function fillRatio(order) {
    const total = parseFloat(order.size);
    if (!total)
        return '\u2014';
    return `${order.fillSize ?? '0'} / ${order.size}`;
}
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}
/* ─── Create Conditional Order Dialog ────────────────────────────────── */
function CreateConditionalDialog({ onClose, onCreated }) {
    const [form, setForm] = useState({
        marketId: '',
        tokenId: '',
        type: 'TAKE_PROFIT',
        side: 'BUY',
        outcome: 'YES',
        size: '',
        triggerPrice: '',
        limitPrice: '',
        trailingPct: '',
        expiresAt: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [positions, setPositions] = useState([]);
    useEffect(() => {
        fetch('/api/v1/portfolio', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.positions)
            setPositions(data.positions); })
            .catch(() => { });
    }, []);
    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const body = {
                marketId: form.marketId,
                tokenId: form.tokenId,
                type: form.type,
                side: form.side,
                outcome: form.outcome,
                size: form.size,
                triggerPrice: form.triggerPrice,
            };
            if (form.limitPrice)
                body.limitPrice = form.limitPrice;
            if (form.trailingPct)
                body.trailingPct = form.trailingPct;
            if (form.expiresAt)
                body.expiresAt = new Date(form.expiresAt).toISOString();
            const res = await fetch('/api/v1/orders/conditional', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                toast.success('Conditional order created');
                onCreated();
                onClose();
            }
            else {
                toast.error('Failed to create conditional order');
            }
        }
        catch {
            toast.error('Failed to create conditional order');
        }
        setSubmitting(false);
    }
    function updateField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", role: "dialog", "aria-modal": "true", "aria-label": "Create Conditional Order", children: _jsxs("div", { className: "animate-scale-in bg-pf-elevated border border-pf-border rounded-pf-lg w-full max-w-lg p-6 shadow-pf-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsx("h2", { className: "text-base font-semibold text-pf-text", children: "Create Conditional Order" }), _jsx("button", { onClick: onClose, "aria-label": "Close dialog", className: "p-1 rounded text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-4" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Market" }), _jsxs("select", { value: form.marketId, onChange: e => {
                                                const mkt = positions.find(p => p.marketId === e.target.value);
                                                updateField('marketId', e.target.value);
                                                if (mkt)
                                                    updateField('tokenId', mkt.tokenId);
                                            }, required: true, className: "w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: [_jsx("option", { value: "", children: "Select from your positions..." }), positions.map(p => (_jsxs("option", { value: p.marketId, children: [p.marketTitle || p.marketId.slice(0, 12), " \u2014 ", p.outcome, " (", p.size, ")"] }, p.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Token" }), _jsx("input", { value: form.tokenId, readOnly: true, className: "w-full h-9 px-3 rounded-pf bg-pf-overlay border border-pf-border text-sm text-pf-text-secondary cursor-not-allowed font-mono text-xs" }), _jsx("p", { className: "text-[10px] text-pf-text-muted mt-0.5", children: "Auto-filled from selected position" })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Type" }), _jsxs("select", { value: form.type, onChange: e => updateField('type', e.target.value), className: "w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: [_jsx("option", { value: "TAKE_PROFIT", children: "Take Profit" }), _jsx("option", { value: "STOP_LOSS", children: "Stop Loss" }), _jsx("option", { value: "TRAILING_STOP", children: "Trailing Stop" }), _jsx("option", { value: "LIMIT", children: "Limit" }), _jsx("option", { value: "PEGGED", children: "Pegged" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Side" }), _jsxs("select", { value: form.side, onChange: e => updateField('side', e.target.value), className: "w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: [_jsx("option", { value: "BUY", children: "BUY" }), _jsx("option", { value: "SELL", children: "SELL" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Outcome" }), _jsxs("select", { value: form.outcome, onChange: e => updateField('outcome', e.target.value), className: "w-full h-9 px-2 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50", children: [_jsx("option", { value: "YES", children: "YES" }), _jsx("option", { value: "NO", children: "NO" })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Size" }), _jsx("input", { type: "number", step: "any", value: form.size, onChange: e => updateField('size', e.target.value), required: true, className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Trigger Price" }), _jsx("input", { type: "number", step: "any", value: form.triggerPrice, onChange: e => updateField('triggerPrice', e.target.value), required: true, className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" })] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Limit Price" }), _jsx("input", { type: "number", step: "any", value: form.limitPrice, onChange: e => updateField('limitPrice', e.target.value), placeholder: "Optional", className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Trailing %" }), _jsx("input", { type: "number", step: "any", value: form.trailingPct, onChange: e => updateField('trailingPct', e.target.value), placeholder: "Optional", className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-pf-text-secondary mb-1", children: "Expires At" }), _jsx("input", { type: "datetime-local", value: form.expiresAt, onChange: e => updateField('expiresAt', e.target.value), className: "w-full h-9 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50" })] })] }), _jsxs("div", { className: "flex gap-2 justify-end pt-3 border-t border-pf-border-subtle", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text transition-colors", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: submitting, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity", children: [_jsx(Plus, { className: "size-3.5" }), " Create"] })] })] })] }) }));
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const [viewTab, setViewTab] = useState('orders');
    // ── Regular orders state ──
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('ALL');
    const [selectedOrder, setSelectedOrder] = useState(null);
    // ── Conditional orders state ──
    const [condOrders, setCondOrders] = useState([]);
    const [condLoading, setCondLoading] = useState(true);
    const [condTotal, setCondTotal] = useState(0);
    const [condTotalPages, setCondTotalPages] = useState(0);
    const [condPage, setCondPage] = useState(1);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    // ── Load regular orders ──
    const load = useCallback(async (p, f) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: '25' });
            if (f !== 'ALL')
                params.set('status', f);
            const res = await fetch(`/api/v1/orders?${params}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setOrders(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load orders');
        }
        setLoading(false);
    }, []);
    // ── Load conditional orders ──
    const loadConditional = useCallback(async (p) => {
        setCondLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: '25' });
            const res = await fetch(`/api/v1/orders/conditional?${params}`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setCondOrders(data.data);
                setCondTotal(data.total);
                setCondTotalPages(data.totalPages);
            }
        }
        catch {
            toast.error('Failed to load conditional orders');
        }
        setCondLoading(false);
    }, []);
    useEffect(() => {
        if (viewTab === 'orders')
            load(page, filter);
    }, [page, filter, load, viewTab]);
    useEffect(() => {
        if (viewTab === 'conditional')
            loadConditional(condPage);
    }, [condPage, loadConditional, viewTab]);
    function changeFilter(f) {
        setFilter(f);
        setPage(1);
    }
    async function cancelConditional(id) {
        try {
            const res = await fetch(`/api/v1/orders/conditional/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                toast.success('Conditional order cancelled');
                loadConditional(condPage);
            }
            else {
                toast.error('Failed to cancel order');
            }
        }
        catch {
            toast.error('Failed to cancel order');
        }
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-7xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Orders" }), _jsxs("div", { className: "flex items-center gap-3", children: [viewTab === 'conditional' && (_jsxs("button", { onClick: () => setShowCreateDialog(true), className: "flex items-center gap-1.5 px-3 py-1.5 rounded-pf bg-pf-cyan-500/15 text-pf-cyan-400 text-xs font-medium border border-pf-cyan-500/30 hover:bg-pf-cyan-500/25 transition-colors", children: [_jsx(Plus, { className: "size-3" }), " New Conditional"] })), !loading && viewTab === 'orders' && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [total, " orders"] }), !condLoading && viewTab === 'conditional' && _jsxs("span", { className: "text-sm text-pf-text-muted", children: [condTotal, " conditional"] })] })] }), _jsxs("div", { className: "flex gap-2 border-b border-pf-border-subtle pb-2", children: [_jsx("button", { onClick: () => setViewTab('orders'), className: `px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${viewTab === 'orders' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`, children: "Orders" }), _jsx("button", { onClick: () => setViewTab('conditional'), className: `px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${viewTab === 'conditional' ? 'text-pf-cyan-400 border-b-2 border-pf-cyan-400' : 'text-pf-text-secondary hover:text-pf-text'}`, children: "Conditional" })] }), viewTab === 'orders' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: FILTERS.map(f => (_jsx("button", { onClick: () => changeFilter(f.value), className: `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filter === f.value
                                ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                                : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: f.label }, f.value))) }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium w-10", children: "#" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Side" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Outcome" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Size" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Price" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Filled / Total" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Avg Fill" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Type" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Date" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: loading ? (Array.from({ length: 8 }, (_, i) => (_jsx("tr", { children: Array.from({ length: 10 }, (_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-3 bg-pf-overlay rounded animate-pulse" }) }, j))) }, i)))) : orders.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 10, children: _jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(ClipboardList, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No orders found" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Orders placed by your strategies will appear here." })] }) }) })) : (orders.map((order, i) => {
                                            const ss = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING;
                                            return (_jsxs("tr", { tabIndex: 0, onClick: () => setSelectedOrder(order), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                                                    setSelectedOrder(order); }, className: "hover:bg-pf-surface/50 transition-colors cursor-pointer", children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: (page - 1) * 25 + i + 1 }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${order.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: order.side }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${order.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: order.outcome }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: order.size }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: order.price }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text-secondary", children: fillRatio(order) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: order.fillPrice ?? '\u2014' }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: order.orderType }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`, children: order.status }) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: formatDate(order.createdAt) }) })] }, order.id));
                                        })) })] }) }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] })), viewTab === 'conditional' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-pf-surface text-left text-xs text-pf-text-secondary uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Type" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Market" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Trigger" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Size" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Side" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Outcome" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Expires" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Created" }), _jsx("th", { className: "px-4 py-3 font-medium w-10" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: condLoading ? (Array.from({ length: 5 }, (_, i) => (_jsx("tr", { children: Array.from({ length: 10 }, (_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-3 bg-pf-overlay rounded animate-pulse" }) }, j))) }, i)))) : condOrders.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 10, children: _jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [_jsx(ClipboardList, { className: "size-10 text-pf-text-muted mb-3" }), _jsx("p", { className: "text-sm font-medium text-pf-text", children: "No conditional orders" }), _jsx("p", { className: "text-xs text-pf-text-muted mt-1", children: "Set up take profit, stop loss, or trailing stop orders." })] }) }) })) : (condOrders.map((co) => {
                                            const ts = CONDITIONAL_TYPE_STYLES[co.type] ?? CONDITIONAL_TYPE_STYLES.LIMIT;
                                            const cs = CONDITIONAL_STATUS_STYLES[co.status] ?? CONDITIONAL_STATUS_STYLES.PENDING;
                                            return (_jsxs("tr", { className: "hover:bg-pf-surface/50 transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${ts.bg} ${ts.text}`, children: ts.label }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: "font-mono text-[11px] text-pf-text-muted", children: [co.marketId.slice(0, 8), "..."] }) }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: co.triggerPrice }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-pf-text", children: co.size }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${co.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: co.side }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${co.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: co.outcome }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${cs.bg} ${cs.text}`, children: co.status }) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: co.expiresAt ? formatDate(co.expiresAt) : '\u2014' }) }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx("span", { className: "font-mono text-[11px] text-pf-text-muted", children: formatDate(co.createdAt) }) }), _jsx("td", { className: "px-4 py-3", children: co.status === 'PENDING' && (_jsx("button", { onClick: () => cancelConditional(co.id), "aria-label": "Cancel conditional order", className: "p-1 rounded text-pf-text-muted hover:text-pf-danger transition-colors", children: _jsx(Trash2, { className: "size-3.5" }) })) })] }, co.id));
                                        })) })] }) }) }), condTotalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 pt-2", children: [_jsx("button", { onClick: () => setCondPage(p => Math.max(1, p - 1)), disabled: condPage === 1, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "text-sm font-mono text-pf-text-secondary", children: [condPage, " / ", condTotalPages] }), _jsx("button", { onClick: () => setCondPage(p => Math.min(condTotalPages, p + 1)), disabled: condPage === condTotalPages, className: "p-2 rounded-pf text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors", children: _jsx(ChevronRight, { className: "size-4" }) })] }))] })), selectedOrder && (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-end", role: "dialog", "aria-modal": "true", "aria-label": "Order Details", children: [_jsx("div", { className: "absolute inset-0 bg-black/50", onClick: () => setSelectedOrder(null) }), _jsxs("div", { className: "animate-slide-right relative w-full max-w-md h-full bg-pf-surface border-l border-pf-border overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-pf-border-subtle", children: [_jsx("h2", { className: "text-lg font-semibold text-pf-text", children: "Order Details" }), _jsx("button", { onClick: () => setSelectedOrder(null), "aria-label": "Close order details", className: "text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-5" }) })] }), _jsx("div", { className: "p-6 space-y-4", children: [
                                    { label: 'Order ID', value: _jsxs("span", { className: "font-mono text-[11px]", children: [selectedOrder.id.slice(0, 8), "..."] }) },
                                    { label: 'Side', value: (_jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${selectedOrder.side === 'BUY' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: selectedOrder.side })) },
                                    { label: 'Outcome', value: (_jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${selectedOrder.outcome === 'YES' ? 'bg-pf-success/10 text-pf-success' : 'bg-pf-danger/10 text-pf-danger'}`, children: selectedOrder.outcome })) },
                                    { label: 'Size', value: _jsx("span", { className: "font-mono", children: selectedOrder.size }) },
                                    { label: 'Price', value: _jsx("span", { className: "font-mono", children: selectedOrder.price }) },
                                    { label: 'Fill Price', value: _jsx("span", { className: "font-mono", children: selectedOrder.fillPrice ?? '\u2014' }) },
                                    { label: 'Filled', value: _jsx("span", { className: "font-mono", children: fillRatio(selectedOrder) }) },
                                    { label: 'Type', value: selectedOrder.orderType },
                                    { label: 'Status', value: (() => {
                                            const ss = STATUS_STYLES[selectedOrder.status] ?? STATUS_STYLES.PENDING;
                                            return _jsx("span", { className: `inline-flex px-2 py-0.5 rounded text-xs font-medium ${ss.bg} ${ss.text}`, children: selectedOrder.status });
                                        })() },
                                    { label: 'Created', value: _jsx("span", { className: "font-mono text-xs", children: formatDate(selectedOrder.placedAt ?? selectedOrder.createdAt) }) },
                                ].map(row => (_jsxs("div", { className: "flex items-center justify-between py-2 border-b border-pf-border-subtle last:border-0", children: [_jsx("span", { className: "text-sm text-pf-text-secondary", children: row.label }), _jsx("span", { className: "text-sm text-pf-text", children: row.value })] }, row.label))) })] })] })), showCreateDialog && (_jsx(CreateConditionalDialog, { onClose: () => setShowCreateDialog(false), onCreated: () => loadConditional(condPage) }))] }));
}
