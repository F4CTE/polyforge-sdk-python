import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';
export function Component() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pattern, setPattern] = useState('');
    const [flushing, setFlushing] = useState(false);
    async function loadStats() {
        setLoading(true);
        try {
            const res = await adminApi.cacheStats();
            setStats(res);
        }
        catch {
            toast.error('Failed to load cache stats');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        loadStats();
    }, []);
    async function handleFlush() {
        if (!pattern.trim())
            return;
        if (!window.confirm(`Are you sure you want to flush cache keys matching "${pattern}"?`))
            return;
        setFlushing(true);
        try {
            const res = await adminApi.cacheFlush(pattern);
            toast.success(`Flushed ${res.keysDeleted} keys`);
            setPattern('');
            loadStats();
        }
        catch {
            toast.error('Failed to flush cache');
        }
        finally {
            setFlushing(false);
        }
    }
    if (loading) {
        return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsx("div", { className: "grid grid-cols-3 gap-4", children: Array.from({ length: 3 }).map((_, i) => (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5 space-y-3", children: [_jsx("div", { className: "h-3 bg-[var(--color-pf-bg)] rounded w-20 animate-pulse" }), _jsx("div", { className: "h-6 bg-[var(--color-pf-bg)] rounded w-16 animate-pulse" })] }, i))) }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsx("div", { className: "h-4 bg-[var(--color-pf-bg)] rounded w-32 animate-pulse mb-4" }), Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-8 bg-[var(--color-pf-bg)] rounded animate-pulse mb-2" }, i)))] })] }));
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: "Cache" }), _jsxs("button", { onClick: loadStats, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm border border-[var(--color-pf-border)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-elevated)] transition-colors", "aria-label": "Refresh cache stats", children: [_jsx(RefreshCw, { size: 14 }), "Refresh"] })] }), stats && (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Hit Rate" }), _jsxs("div", { className: "text-2xl font-bold text-[var(--color-pf-text)]", children: [((stats.hitRate ?? 0) * 100).toFixed(1), "%"] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Total Keys" }), _jsx("div", { className: "text-2xl font-bold text-[var(--color-pf-text)]", children: (stats.keyCount ?? 0).toLocaleString() })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsx("div", { className: "text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Memory Usage" }), _jsxs("div", { className: "text-2xl font-bold text-[var(--color-pf-text)]", children: [(stats.memoryUsageMb ?? 0).toFixed(1), " MB"] })] })] })), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Trash2, { size: 16, className: "text-pf-warning" }), _jsx("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Flush by Pattern" })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("input", { type: "text", value: pattern, onChange: (e) => setPattern(e.target.value), placeholder: "e.g. user:*, strategy:abc*", className: "flex-1 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] font-mono" }), _jsx("button", { onClick: handleFlush, disabled: flushing || !pattern.trim(), className: "px-4 py-2 text-sm rounded-pf-sm bg-pf-warning text-white hover:bg-pf-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: flushing ? 'Flushing...' : 'Flush' })] })] }), stats && stats.patterns && stats.patterns.length > 0 && (_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Database, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Cache Patterns" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Pattern" }), _jsx("th", { className: "text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Keys" }), _jsx("th", { className: "text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Hit Rate" })] }) }), _jsx("tbody", { children: stats.patterns.map((p) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0", children: [_jsx("td", { className: "px-3 py-2.5 font-mono text-xs text-[var(--color-pf-text)]", children: p.pattern }), _jsx("td", { className: "px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]", children: p.keyCount.toLocaleString() }), _jsxs("td", { className: "px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]", children: [(p.hitRate * 100).toFixed(1), "%"] })] }, p.pattern))) })] }) })] }))] }));
}
