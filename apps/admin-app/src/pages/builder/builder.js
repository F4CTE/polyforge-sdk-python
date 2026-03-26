import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Hammer, TrendingUp, Award, DollarSign } from 'lucide-react';
import { adminApi } from '@/lib/api';
export function Component() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        async function load() {
            try {
                const res = await adminApi.builderStats();
                setStats(res);
            }
            catch {
                toast.error('Failed to load builder stats');
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, []);
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "text-sm text-[var(--color-pf-text-secondary)]", children: "Loading builder stats..." }) }));
    }
    if (!stats) {
        return (_jsx("div", { className: "text-center py-12", children: _jsx("p", { className: "text-[var(--color-pf-text-tertiary)]", children: "No builder data available" }) }));
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: "Builder Program" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Award, { size: 16, className: "text-pf-warning" }), _jsx("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: "Current Tier" })] }), _jsx("div", { className: "text-2xl font-bold text-[var(--color-pf-text)] capitalize", children: stats.tier ?? 'N/A' })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(DollarSign, { size: 16, className: "text-pf-success" }), _jsx("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: "Weekly Reward" })] }), _jsxs("div", { className: "text-2xl font-bold text-[var(--color-pf-text)]", children: ["$", stats.weeklyRewardUsdc ?? '0'] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-4", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(TrendingUp, { size: 16, className: "text-blue-400" }), _jsx("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: "Attributed Volume" })] }), _jsxs("div", { className: "text-2xl font-bold text-[var(--color-pf-text)]", children: ["$", Number(stats.attributedVolume ?? 0).toLocaleString()] })] })] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Hammer, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Weekly History" })] }), !stats.weekly || stats.weekly.length === 0 ? (_jsx("p", { className: "text-sm text-[var(--color-pf-text-tertiary)]", children: "No weekly data" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Week" }), _jsx("th", { className: "text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Volume" }), _jsx("th", { className: "text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Reward" })] }) }), _jsx("tbody", { children: stats.weekly.map((w) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0", children: [_jsx("td", { className: "px-3 py-2.5 text-[var(--color-pf-text)]", children: w.week }), _jsxs("td", { className: "px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]", children: ["$", Number(w.volume).toLocaleString()] }), _jsxs("td", { className: "px-3 py-2.5 text-right text-pf-success font-medium", children: ["$", w.reward] })] }, w.week))) })] }) }))] })] }));
}
