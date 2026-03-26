import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Mail, Plus, Trash2, Copy, KeyRound } from 'lucide-react';
import { adminApi } from '@/lib/api';
export function Component() {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(1);
    const [maxUses, setMaxUses] = useState(1);
    const [ttlDays, setTtlDays] = useState(7);
    const [generating, setGenerating] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState([]);
    useEffect(() => {
        loadInvites();
    }, []);
    async function loadInvites() {
        try {
            const res = await adminApi.listInvites();
            setInvites(res);
        }
        catch {
            toast.error('Failed to load invites');
        }
        finally {
            setLoading(false);
        }
    }
    async function handleGenerate(e) {
        e.preventDefault();
        setGenerating(true);
        try {
            const res = await adminApi.generateInvites(count, maxUses, ttlDays || undefined);
            setGeneratedCodes(res.codes);
            toast.success(`Generated ${res.codes.length} invite code(s)`);
            loadInvites();
        }
        catch {
            toast.error('Failed to generate invites');
        }
        finally {
            setGenerating(false);
        }
    }
    const [confirmRevokeCode, setConfirmRevokeCode] = useState(null);
    async function handleDelete(code) {
        setConfirmRevokeCode(null);
        try {
            await adminApi.revokeInvite(code);
            setInvites((inv) => inv.filter((i) => i.code !== code));
            toast.success('Invite revoked');
        }
        catch {
            toast.error('Failed to revoke invite');
        }
    }
    function copyCode(code) {
        navigator.clipboard.writeText(code);
        toast.success('Copied to clipboard');
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: "Invites" }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Plus, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "Generate Invite Codes" })] }), _jsxs("form", { onSubmit: handleGenerate, className: "flex flex-wrap items-end gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Count" }), _jsx("input", { type: "number", min: 1, max: 50, value: count, onChange: (e) => setCount(Number(e.target.value)), className: "w-20 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "Max Uses" }), _jsx("input", { type: "number", min: 1, max: 100, value: maxUses, onChange: (e) => setMaxUses(Number(e.target.value)), className: "w-20 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-[var(--color-pf-text-tertiary)] mb-1", children: "TTL (days)" }), _jsx("input", { type: "number", min: 1, max: 365, value: ttlDays, onChange: (e) => setTtlDays(Number(e.target.value)), className: "w-20 px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)]" })] }), _jsx("button", { type: "submit", disabled: generating, className: "px-4 py-2 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] disabled:opacity-50 transition-colors", children: generating ? 'Generating...' : 'Generate' })] }), generatedCodes.length > 0 && (_jsxs("div", { className: "mt-4 p-3 rounded-pf-sm bg-[var(--color-pf-bg)] border border-[var(--color-pf-border)]", children: [_jsx("div", { className: "text-xs text-[var(--color-pf-text-tertiary)] mb-2", children: "Generated codes:" }), _jsx("div", { className: "space-y-1", children: generatedCodes.map((code) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-sm font-mono text-[var(--color-pf-cyan-500)]", children: code }), _jsx("button", { onClick: () => copyCode(code), className: "p-1 rounded hover:bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text)] transition-colors", children: _jsx(Copy, { size: 12 }) })] }, code))) })] }))] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Mail, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsxs("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: ["Active Invites (", invites.length, ")"] })] }), loading ? (_jsx("div", { className: "overflow-x-auto", children: _jsx("table", { className: "w-full text-sm", children: _jsx("tbody", { children: Array.from({ length: 3 }).map((_, i) => (_jsx("tr", { children: Array.from({ length: 4 }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-pf-surface rounded animate-pulse" }) }, j))) }, i))) }) }) })) : invites.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx(KeyRound, { className: "mx-auto mb-3 text-[var(--color-pf-text-tertiary)] opacity-40", size: 40 }), _jsx("p", { className: "text-[var(--color-pf-text-secondary)] font-medium", children: "No active invites" }), _jsx("p", { className: "text-[var(--color-pf-text-tertiary)] text-xs mt-1", children: "Generate invite codes above to get started" })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Code" }), _jsx("th", { className: "text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Remaining Uses" }), _jsx("th", { className: "text-right px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "TTL" }), _jsx("th", { className: "text-right px-3 py-2" })] }) }), _jsx("tbody", { children: invites.map((inv) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0", children: [_jsx("td", { className: "px-3 py-2.5", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-sm font-mono text-[var(--color-pf-text)]", children: inv.code }), _jsx("button", { onClick: () => copyCode(inv.code), className: "p-1 rounded hover:bg-[var(--color-pf-bg)] text-[var(--color-pf-text-tertiary)] hover:text-[var(--color-pf-text)] transition-colors", children: _jsx(Copy, { size: 12 }) })] }) }), _jsx("td", { className: "px-3 py-2.5 text-right text-[var(--color-pf-text-secondary)]", children: inv.remainingUses }), _jsx("td", { className: "px-3 py-2.5 text-right text-[var(--color-pf-text-tertiary)]", children: inv.ttl > 0 ? `${Math.ceil(inv.ttl / 86400)}d` : 'No expiry' }), _jsx("td", { className: "px-3 py-2.5 text-right", children: confirmRevokeCode === inv.code ? (_jsxs("div", { className: "flex items-center justify-end gap-1.5 text-xs", children: [_jsx("button", { onClick: () => handleDelete(inv.code), className: "px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors", children: "Revoke" }), _jsx("button", { onClick: () => setConfirmRevokeCode(null), className: "px-2 py-0.5 rounded bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors", children: "Cancel" })] })) : (_jsx("button", { onClick: () => setConfirmRevokeCode(inv.code), className: "p-1 rounded hover:bg-pf-danger/10 text-[var(--color-pf-text-tertiary)] hover:text-pf-danger transition-colors", "aria-label": "Revoke invite", title: "Revoke invite", children: _jsx(Trash2, { size: 14 }) })) })] }, inv.code))) })] }) }))] })] }));
}
