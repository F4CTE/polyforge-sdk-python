import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Ban, CheckCircle, Key, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { statusColor, formatDate, formatDateTime } from '@/lib/utils';
export function Component() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSuspendDialog, setShowSuspendDialog] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    useEffect(() => {
        if (!id)
            return;
        async function load() {
            try {
                const [userRes, keysRes] = await Promise.all([
                    adminApi.user(id),
                    adminApi.userApiKeys(id),
                ]);
                setUser(userRes);
                setApiKeys(keysRes);
            }
            catch {
                toast.error('Failed to load user');
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);
    async function handleSuspend() {
        if (!id || !suspendReason.trim())
            return;
        setActionLoading(true);
        try {
            await adminApi.suspendUser(id, suspendReason);
            setUser((u) => ({ ...u, suspended: true, suspendReason }));
            setShowSuspendDialog(false);
            setSuspendReason('');
            toast.success('User suspended');
        }
        catch {
            toast.error('Failed to suspend user');
        }
        finally {
            setActionLoading(false);
        }
    }
    async function handleUnsuspend() {
        if (!id)
            return;
        setActionLoading(true);
        try {
            await adminApi.unsuspendUser(id);
            setUser((u) => ({ ...u, suspended: false, suspendReason: null }));
            toast.success('User unsuspended');
        }
        catch {
            toast.error('Failed to unsuspend user');
        }
        finally {
            setActionLoading(false);
        }
    }
    const [confirmRevokeKeyId, setConfirmRevokeKeyId] = useState(null);
    async function revokeKey(keyId) {
        if (!id)
            return;
        setConfirmRevokeKeyId(null);
        try {
            await adminApi.revokeUserApiKey(id, keyId);
            setApiKeys((keys) => keys.map((k) => (k.id === keyId ? { ...k, revoked: true } : k)));
            toast.success('API key revoked');
        }
        catch {
            toast.error('Failed to revoke key');
        }
    }
    if (loading) {
        return (_jsxs("div", { className: "animate-pulse space-y-6", children: [_jsx("div", { className: "h-4 bg-[var(--color-pf-elevated)] rounded w-32" }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 space-y-4", children: [_jsx("div", { className: "h-5 bg-[var(--color-pf-bg)] rounded w-48" }), _jsx("div", { className: "h-4 bg-[var(--color-pf-bg)] rounded w-64" }), _jsx("div", { className: "grid grid-cols-4 gap-4", children: [1, 2, 3, 4].map(i => _jsx("div", { className: "h-12 bg-[var(--color-pf-bg)] rounded" }, i)) })] })] }));
    }
    if (!user) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx("p", { className: "text-[var(--color-pf-text-secondary)]", children: "User not found" }), _jsx("button", { onClick: () => navigate('/users'), className: "mt-4 text-sm text-[var(--color-pf-cyan-500)] hover:underline", children: "Back to users" })] }));
    }
    return (_jsxs("div", { className: "animate-fade-in space-y-6", children: [_jsxs("button", { onClick: () => navigate('/users'), className: "flex items-center gap-1.5 text-sm text-[var(--color-pf-text-secondary)] hover:text-[var(--color-pf-text)] transition-colors", children: [_jsx(ArrowLeft, { size: 16 }), "Back to users"] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-lg font-semibold text-[var(--color-pf-text)]", children: [user.username, user.suspended && (_jsx("span", { className: "ml-2 px-2 py-0.5 rounded text-xs font-medium text-pf-danger bg-pf-danger/10", children: "SUSPENDED" }))] }), _jsx("p", { className: "text-sm text-[var(--color-pf-text-secondary)] mt-0.5", children: user.email })] }), _jsx("span", { className: `px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(user.status)}`, children: user.status })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs mb-0.5", children: "Created" }), _jsx("div", { className: "text-[var(--color-pf-text)]", children: formatDate(user.createdAt) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs mb-0.5", children: "Last Seen" }), _jsx("div", { className: "text-[var(--color-pf-text)]", children: formatDateTime(user.lastSeen) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs mb-0.5", children: "Strategies" }), _jsx("div", { className: "text-[var(--color-pf-text)]", children: user.strategyCount })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs mb-0.5", children: "Orders" }), _jsx("div", { className: "text-[var(--color-pf-text)]", children: user.orderCount })] })] }), user.limits && (_jsxs("div", { className: "mt-4 pt-4 border-t border-[var(--color-pf-border)]", children: [_jsx("h3", { className: "text-xs font-semibold text-[var(--color-pf-text-tertiary)] uppercase tracking-wider mb-2", children: "Limits" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs", children: "Max Strategies" }), _jsx("div", { className: "text-[var(--color-pf-text)] font-medium", children: user.limits.maxStrategies })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs", children: "Orders/min" }), _jsx("div", { className: "text-[var(--color-pf-text)] font-medium", children: user.limits.maxOrdersPerMinute })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs", children: "Max Position" }), _jsxs("div", { className: "text-[var(--color-pf-text)] font-medium", children: ["$", user.limits.maxPositionSizeUsdc] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[var(--color-pf-text-tertiary)] text-xs", children: "Daily Loss Limit" }), _jsxs("div", { className: "text-[var(--color-pf-text)] font-medium", children: ["$", user.limits.maxDailyLossUsdc] })] })] })] })), _jsx("div", { className: "mt-4 pt-4 border-t border-[var(--color-pf-border)] flex gap-3", children: user.suspended ? (_jsxs("button", { onClick: handleUnsuspend, disabled: actionLoading, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-success/10 text-pf-success hover:bg-pf-success/20 disabled:opacity-50 transition-colors", children: [_jsx(CheckCircle, { size: 14 }), "Unsuspend"] })) : (_jsxs("button", { onClick: () => setShowSuspendDialog(true), disabled: actionLoading, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 disabled:opacity-50 transition-colors", children: [_jsx(Ban, { size: 14 }), "Suspend"] })) }), showSuspendDialog && (_jsxs("div", { className: "mt-4 p-4 rounded-pf-sm border border-pf-danger/20 bg-pf-danger/5", children: [_jsx("h4", { className: "text-sm font-medium text-pf-danger mb-2", children: "Suspend User" }), _jsx("textarea", { value: suspendReason, onChange: (e) => setSuspendReason(e.target.value), placeholder: "Reason for suspension...", rows: 3, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-red-500 mb-3" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleSuspend, disabled: actionLoading || !suspendReason.trim(), className: "px-3 py-1.5 text-sm rounded-pf-sm bg-pf-danger text-white hover:bg-pf-danger/80 disabled:opacity-50 transition-colors", children: "Confirm Suspend" }), _jsx("button", { onClick: () => setShowSuspendDialog(false), className: "px-3 py-1.5 text-sm rounded-pf-sm border border-[var(--color-pf-border)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors", children: "Cancel" })] })] }))] }), _jsxs("div", { className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Key, { size: 16, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("h3", { className: "text-sm font-semibold text-[var(--color-pf-text)]", children: "API Keys" })] }), apiKeys.length === 0 ? (_jsx("p", { className: "text-sm text-[var(--color-pf-text-tertiary)]", children: "No API keys" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-[var(--color-pf-border)]", children: [_jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Name" }), _jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Prefix" }), _jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Scopes" }), _jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Created" }), _jsx("th", { className: "text-left px-3 py-2 text-xs font-medium text-[var(--color-pf-text-tertiary)] uppercase", children: "Status" }), _jsx("th", { className: "text-right px-3 py-2" })] }) }), _jsx("tbody", { children: apiKeys.map((key) => (_jsxs("tr", { className: "border-b border-[var(--color-pf-border)] last:border-0", children: [_jsx("td", { className: "px-3 py-2.5 text-[var(--color-pf-text)]", children: key.name }), _jsxs("td", { className: "px-3 py-2.5 font-mono text-xs text-[var(--color-pf-text-secondary)]", children: [key.prefix, "..."] }), _jsx("td", { className: "px-3 py-2.5 text-[var(--color-pf-text-secondary)]", children: key.scopes.join(', ') }), _jsx("td", { className: "px-3 py-2.5 text-[var(--color-pf-text-tertiary)]", children: formatDate(key.createdAt) }), _jsx("td", { className: "px-3 py-2.5", children: key.revoked ? (_jsx("span", { className: "text-xs text-pf-danger", children: "Revoked" })) : (_jsx("span", { className: "text-xs text-pf-success", children: "Active" })) }), _jsx("td", { className: "px-3 py-2.5 text-right", children: !key.revoked && (confirmRevokeKeyId === key.id ? (_jsxs("div", { className: "flex items-center justify-end gap-1.5 text-xs", children: [_jsx("button", { onClick: () => revokeKey(key.id), className: "px-2 py-0.5 rounded bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20 transition-colors", children: "Revoke" }), _jsx("button", { onClick: () => setConfirmRevokeKeyId(null), className: "px-2 py-0.5 rounded bg-[var(--color-pf-elevated)] text-[var(--color-pf-text-secondary)] hover:bg-[var(--color-pf-bg)] transition-colors", children: "Cancel" })] })) : (_jsx("button", { onClick: () => setConfirmRevokeKeyId(key.id), className: "p-1 rounded hover:bg-pf-danger/10 text-[var(--color-pf-text-tertiary)] hover:text-pf-danger transition-colors", "aria-label": "Revoke key", title: "Revoke key", children: _jsx(Trash2, { size: 14 }) }))) })] }, key.id))) })] }) }))] })] }));
}
