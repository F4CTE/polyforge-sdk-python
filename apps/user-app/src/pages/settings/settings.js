import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { User, Bell, Lock, Shield, Key, Loader2, Check, Copy, Ban, Eye, EyeOff, Fuel, Trash2, AlertTriangle, } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
/* ─── Helpers ────────────────────────────────────────────────────────── */
const TABS = [
    { label: 'Profile', value: 'profile', icon: _jsx(User, { className: "size-3.5" }) },
    { label: 'Notifications', value: 'notifications', icon: _jsx(Bell, { className: "size-3.5" }) },
    { label: 'Password', value: 'password', icon: _jsx(Lock, { className: "size-3.5" }) },
    { label: '2FA', value: '2fa', icon: _jsx(Shield, { className: "size-3.5" }) },
    { label: 'API Keys', value: 'apikeys', icon: _jsx(Key, { className: "size-3.5" }) },
    { label: 'Gas Usage', value: 'gas', icon: _jsx(Fuel, { className: "size-3.5" }) },
];
const NOTIF_ITEMS = [
    { key: 'orderFilled', label: 'Order Filled', desc: 'When one of your orders is matched and filled' },
    { key: 'strategyError', label: 'Strategy Error', desc: 'When a strategy encounters a runtime error' },
    { key: 'backtestComplete', label: 'Backtest Complete', desc: 'When a backtest run finishes' },
    { key: 'priceAlert', label: 'Price Alert', desc: 'When a watched market crosses your price target' },
    { key: 'dailyLossLimit', label: 'Daily Loss Limit', desc: 'When you approach your configured daily loss limit' },
    { key: 'marketResolved', label: 'Market Resolved', desc: 'When a market you hold positions in resolves' },
    { key: 'follow', label: 'New Follower', desc: 'When someone follows your profile' },
];
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { user, patchUser } = useAuthStore();
    const [activeTab, setActiveTab] = useState('profile');
    // Profile
    const [displayName, setDisplayName] = useState(user?.displayName ?? '');
    const [bio, setBio] = useState(user?.bio ?? '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
    const [profileSaving, setProfileSaving] = useState(false);
    // Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);
    // 2FA
    const [totpSetupData, setTotpSetupData] = useState(null);
    const [totpCode, setTotpCode] = useState('');
    const [totpSaving, setTotpSaving] = useState(false);
    const [totpLoading, setTotpLoading] = useState(false);
    // Notifications — fetch from API on mount, fallback to defaults
    const [notifPrefs, setNotifPrefs] = useState({
        orderFilled: true, strategyError: true, backtestComplete: true, priceAlert: false,
        dailyLossLimit: true, marketResolved: false, follow: true,
    });
    const [notifSaving, setNotifSaving] = useState(false);
    const [notifLoading, setNotifLoading] = useState(true);
    useEffect(() => {
        fetch('/api/v1/settings/notifications', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data)
            setNotifPrefs(prev => ({ ...prev, ...data })); })
            .catch(() => { })
            .finally(() => setNotifLoading(false));
    }, []);
    // API Keys
    const [apiKeys, setApiKeys] = useState([]);
    const [apiKeysLoading, setApiKeysLoading] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyScopes, setNewKeyScopes] = useState({ read: true, write: false, trade: false });
    const [newKeyExpiration, setNewKeyExpiration] = useState('');
    const [createdKey, setCreatedKey] = useState(null);
    const [apiKeysCreating, setApiKeysCreating] = useState(false);
    // Gas Usage
    const [gasUsage, setGasUsage] = useState(null);
    const [gasLoading, setGasLoading] = useState(false);
    async function loadGasUsage() {
        setGasLoading(true);
        try {
            const res = await fetch('/api/v1/settings/gas', { credentials: 'include' });
            if (res.ok)
                setGasUsage(await res.json());
        }
        catch {
            toast.error('Failed to load gas usage');
        }
        setGasLoading(false);
    }
    function handleTab(t) {
        setActiveTab(t);
        if (t === 'apikeys' && apiKeys.length === 0)
            loadApiKeys();
        if (t === 'gas' && !gasUsage)
            loadGasUsage();
    }
    // ── Profile ──
    async function saveProfile() {
        if (profileSaving)
            return;
        setProfileSaving(true);
        try {
            const res = await fetch('/api/v1/profile/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ displayName: displayName || undefined, bio: bio || undefined, avatarUrl: avatarUrl || undefined }),
            });
            if (res.ok) {
                patchUser({ displayName, bio, avatarUrl });
                toast.success('Profile saved');
            }
            else {
                toast.error('Failed to save profile');
            }
        }
        catch {
            toast.error('Failed to save profile');
        }
        setProfileSaving(false);
    }
    // ── Password ──
    async function savePassword() {
        if (pwSaving)
            return;
        if (newPassword !== confirmPassword)
            return;
        setPwSaving(true);
        try {
            const res = await fetch('/api/v1/profile/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            if (res.ok) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                toast.success('Password changed');
            }
            else {
                toast.error('Failed to change password');
            }
        }
        catch {
            toast.error('Failed to change password');
        }
        setPwSaving(false);
    }
    // ── TOTP ──
    async function startTotpSetup() {
        setTotpLoading(true);
        try {
            const res = await fetch('/auth/v1/totp/setup', { method: 'POST', credentials: 'include' });
            if (res.ok) {
                setTotpSetupData(await res.json());
            }
            else {
                toast.error('Failed to start 2FA setup');
            }
        }
        catch {
            toast.error('Failed to start 2FA setup');
        }
        finally {
            setTotpLoading(false);
        }
    }
    async function confirmTotp() {
        if (totpSaving || !totpCode)
            return;
        setTotpSaving(true);
        try {
            const res = await fetch('/auth/v1/totp/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: totpCode }),
            });
            if (res.ok) {
                patchUser({ totpEnabled: true });
                setTotpSetupData(null);
                setTotpCode('');
                toast.success('Two-factor authentication enabled');
            }
            else {
                toast.error('Failed to confirm 2FA');
            }
        }
        catch {
            toast.error('Failed to confirm 2FA');
        }
        setTotpSaving(false);
    }
    async function disableTotp() {
        if (totpSaving || !totpCode)
            return;
        setTotpSaving(true);
        try {
            const res = await fetch('/auth/v1/totp/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code: totpCode }),
            });
            if (res.ok) {
                patchUser({ totpEnabled: false });
                setTotpCode('');
                toast.success('Two-factor authentication disabled');
            }
            else {
                toast.error('Failed to disable 2FA');
            }
        }
        catch {
            toast.error('Failed to disable 2FA');
        }
        setTotpSaving(false);
    }
    // ── Notifications ──
    async function saveNotifications() {
        if (notifSaving)
            return;
        setNotifSaving(true);
        try {
            const res = await fetch('/api/v1/profile/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(notifPrefs),
            });
            if (res.ok) {
                toast.success('Notification preferences saved');
            }
            else {
                toast.error('Failed to save notification preferences');
            }
        }
        catch {
            toast.error('Failed to save notification preferences');
        }
        setNotifSaving(false);
    }
    // ── API Keys ──
    async function loadApiKeys() {
        setApiKeysLoading(true);
        try {
            const res = await fetch('/api/v1/api-keys', { credentials: 'include' });
            if (res.ok)
                setApiKeys(await res.json());
        }
        catch {
            toast.error('Failed to load API keys');
        }
        setApiKeysLoading(false);
    }
    async function createApiKey() {
        if (apiKeysCreating || !newKeyName.trim())
            return;
        setApiKeysCreating(true);
        const scopes = [];
        if (newKeyScopes.read)
            scopes.push('READ');
        if (newKeyScopes.write)
            scopes.push('WRITE');
        if (newKeyScopes.trade)
            scopes.push('TRADE');
        try {
            const body = { name: newKeyName.trim(), scopes };
            if (newKeyExpiration)
                body.expiresAt = new Date(newKeyExpiration).toISOString();
            const res = await fetch('/api/v1/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const created = await res.json();
                setCreatedKey(created);
                setApiKeys(prev => [created, ...prev]);
                setNewKeyName('');
                setNewKeyScopes({ read: true, write: false, trade: false });
                setNewKeyExpiration('');
                toast.success('API key created');
            }
            else {
                toast.error('Failed to create API key');
            }
        }
        catch {
            toast.error('Failed to create API key');
        }
        setApiKeysCreating(false);
    }
    async function revokeApiKey(id) {
        if (!confirm('Revoke this API key? This action cannot be undone.'))
            return;
        try {
            const res = await fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                setApiKeys(prev => prev.map(k => k.id === id ? { ...k, revoked: true } : k));
                toast.success('API key revoked');
            }
        }
        catch {
            toast.error('Failed to revoke API key');
        }
    }
    function copyKey(key) {
        navigator.clipboard.writeText(key);
    }
    // Delete Account
    const navigate = useNavigate();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    async function handleDeleteAccount() {
        if (deleting || !deletePassword)
            return;
        setDeleting(true);
        try {
            const res = await fetch('/auth/v1/account', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password: deletePassword }),
            });
            if (res.ok) {
                toast.success('Account deleted');
                navigate('/login');
            }
            else {
                const err = await res.json();
                toast.error(err?.message ?? 'Failed to delete account');
            }
        }
        catch {
            toast.error('Failed to delete account');
        }
        setDeleting(false);
    }
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-4xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Settings" }), _jsx(Link, { to: "/settings/trading-account", className: "text-sm text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors", children: "Trading Account \u2192" })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-none", children: TABS.map(t => (_jsxs("button", { onClick: () => handleTab(t.value), className: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${activeTab === t.value
                        ? 'bg-pf-cyan-500/15 text-pf-cyan-400 border-pf-cyan-500/30'
                        : 'bg-pf-elevated text-pf-text-secondary border-pf-border hover:border-pf-border-strong'}`, children: [t.icon, t.label] }, t.value))) }), activeTab === 'profile' && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Public Profile" }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Display Name" }), _jsx("input", { value: displayName, onChange: e => setDisplayName(e.target.value), placeholder: "Your display name", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Bio" }), _jsx("textarea", { value: bio, onChange: e => setBio(e.target.value), rows: 3, placeholder: "Tell others about yourself...", className: "w-full px-3 py-2.5 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors resize-y" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Avatar URL" }), _jsx("input", { value: avatarUrl, onChange: e => setAvatarUrl(e.target.value), placeholder: "https://...", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { onClick: saveProfile, disabled: profileSaving, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors", children: [profileSaving ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Check, { className: "size-4" }), "Save Profile"] }) })] })), activeTab === 'notifications' && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-1", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider mb-4", children: "Email & In-App Notifications" }), NOTIF_ITEMS.map(item => (_jsxs("div", { className: "flex items-center justify-between py-3 border-b border-pf-border-subtle last:border-0", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-pf-text", children: item.label }), _jsx("div", { className: "text-xs text-pf-text-secondary mt-0.5", children: item.desc })] }), _jsx("button", { role: "switch", "aria-checked": notifPrefs[item.key], onClick: () => setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] })), className: `relative w-10 h-5 rounded-full transition-colors ${notifPrefs[item.key] ? 'bg-pf-cyan-500' : 'bg-pf-overlay'}`, children: _jsx("div", { className: `absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'}` }) })] }, item.key))), _jsx("div", { className: "flex justify-end pt-4", children: _jsxs("button", { onClick: saveNotifications, disabled: notifSaving, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors", children: [notifSaving ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Check, { className: "size-4" }), "Save Preferences"] }) })] })), activeTab === 'password' && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Change Password" }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Current Password" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: showCurrentPw ? 'text' : 'password', autoComplete: "current-password", value: currentPassword, onChange: e => setCurrentPassword(e.target.value), className: "w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" }), _jsx("button", { type: "button", onClick: () => setShowCurrentPw(!showCurrentPw), className: "absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text", children: showCurrentPw ? _jsx(EyeOff, { className: "size-4" }) : _jsx(Eye, { className: "size-4" }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "New Password" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: showNewPw ? 'text' : 'password', autoComplete: "new-password", value: newPassword, onChange: e => setNewPassword(e.target.value), className: "w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" }), _jsx("button", { type: "button", onClick: () => setShowNewPw(!showNewPw), className: "absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text", children: showNewPw ? _jsx(EyeOff, { className: "size-4" }) : _jsx(Eye, { className: "size-4" }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Confirm New Password" }), _jsx("input", { type: "password", autoComplete: "new-password", value: confirmPassword, onChange: e => setConfirmPassword(e.target.value), className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" }), confirmPassword && newPassword !== confirmPassword && (_jsx("span", { className: "text-xs text-pf-danger mt-1 block", children: "Passwords do not match" }))] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { onClick: savePassword, disabled: pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors", children: [pwSaving ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Lock, { className: "size-4" }), "Change Password"] }) })] })), activeTab === '2fa' && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Two-Factor Authentication (TOTP)" }), user?.totpEnabled ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-pf-text-secondary", children: ["2FA is currently ", _jsx("strong", { className: "text-pf-success", children: "enabled" }), "."] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Enter your TOTP code to disable" }), _jsx("input", { value: totpCode, onChange: e => setTotpCode(e.target.value), placeholder: "6-digit code", maxLength: 6, className: "w-full max-w-[200px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("button", { onClick: disableTotp, disabled: totpSaving || !totpCode, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 disabled:opacity-50 transition-colors", children: [totpSaving ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Shield, { className: "size-4" }), "Disable 2FA"] })] })) : totpSetupData ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm text-pf-text-secondary", children: "Scan this QR code with your authenticator app, then enter the 6-digit code to confirm." }), _jsx("div", { className: "flex justify-center py-4", children: _jsx("img", { src: totpSetupData.qrCodeUri, alt: "TOTP QR Code", className: "w-48 h-48 rounded-pf-lg bg-white p-2" }) }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Verification Code" }), _jsx("input", { value: totpCode, onChange: e => setTotpCode(e.target.value), placeholder: "6-digit code", maxLength: 6, className: "w-full max-w-[200px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), totpSetupData.backupCodes.length > 0 && (_jsxs("div", { className: "bg-pf-surface rounded-pf p-4", children: [_jsx("div", { className: "text-xs text-pf-text-secondary mb-2 font-medium", children: "Backup Codes (save these!)" }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2", children: totpSetupData.backupCodes.map(code => (_jsx("span", { className: "font-mono text-xs text-pf-text bg-pf-overlay px-2 py-1 rounded text-center", children: code }, code))) })] })), _jsxs("button", { onClick: confirmTotp, disabled: totpSaving || !totpCode, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors", children: [totpSaving ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Check, { className: "size-4" }), "Confirm & Enable 2FA"] })] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-pf-text-secondary", children: ["2FA is currently ", _jsx("strong", { className: "text-pf-text-muted", children: "disabled" }), ". Add an extra layer of security to your account."] }), _jsxs("button", { onClick: startTotpSetup, disabled: totpLoading, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 transition-colors", children: [totpLoading ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Shield, { className: "size-4" }), totpLoading ? 'Setting up...' : 'Enable 2FA'] })] }))] })), activeTab === 'gas' && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Gas Sponsorship" }), _jsx("p", { className: "text-sm text-pf-text-secondary", children: "Polyforge absorbs Polygon gas fees so you can trade without worrying about network costs." }), gasLoading ? (_jsx("div", { className: "space-y-3", children: [1, 2, 3].map(i => (_jsx("div", { className: "h-12 bg-pf-overlay rounded animate-pulse" }, i))) })) : gasUsage ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-pf-surface rounded-pf p-4 border border-pf-border-subtle", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Today's Usage" }), _jsxs("span", { className: "block mt-1 text-lg font-mono font-semibold text-pf-text", children: [gasUsage.todayUsage.toFixed(4), " MATIC"] })] }), _jsxs("div", { className: "bg-pf-surface rounded-pf p-4 border border-pf-border-subtle", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Daily Limit" }), _jsxs("span", { className: "block mt-1 text-lg font-mono font-semibold text-pf-text", children: [gasUsage.dailyLimit.toFixed(4), " MATIC"] })] }), _jsxs("div", { className: "bg-pf-surface rounded-pf p-4 border border-pf-border-subtle", children: [_jsx("span", { className: "text-xs text-pf-text-secondary uppercase tracking-wider", children: "Remaining" }), _jsxs("span", { className: `block mt-1 text-lg font-mono font-semibold ${gasUsage.remaining > 0.1 ? 'text-pf-success' : 'text-pf-danger'}`, children: [gasUsage.remaining.toFixed(4), " MATIC"] })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs text-pf-text-secondary mb-1.5", children: [_jsx("span", { children: "Usage" }), _jsxs("span", { children: [((gasUsage.todayUsage / gasUsage.dailyLimit) * 100).toFixed(1), "%"] })] }), _jsx("div", { className: "w-full h-2 bg-pf-overlay rounded-full overflow-hidden", children: _jsx("div", { className: `h-full rounded-full transition-all duration-500 ${gasUsage.todayUsage / gasUsage.dailyLimit > 0.8 ? 'bg-pf-danger' : 'bg-pf-cyan-500'}`, style: { width: `${Math.min(100, (gasUsage.todayUsage / gasUsage.dailyLimit) * 100)}%` } }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${gasUsage.sponsorEnabled ? 'bg-pf-success' : 'bg-pf-danger'}` }), _jsxs("span", { className: "text-pf-text-secondary", children: ["Gas sponsorship is currently ", gasUsage.sponsorEnabled ? 'active' : 'inactive'] })] }), _jsx("div", { className: "flex justify-end", children: _jsxs("button", { onClick: loadGasUsage, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong transition-colors", children: [_jsx(Fuel, { className: "size-4" }), "Refresh"] }) })] })) : (_jsxs("div", { className: "flex flex-col items-center py-6 text-center", children: [_jsx(Fuel, { className: "size-8 text-pf-text-muted mb-2" }), _jsx("p", { className: "text-sm text-pf-text-muted", children: "Unable to load gas usage data." })] }))] })), _jsxs("div", { className: "bg-pf-elevated border border-pf-danger/20 rounded-pf-lg p-6 space-y-4", children: [_jsxs("h2", { className: "text-sm font-semibold text-pf-danger uppercase tracking-wider flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "size-4" }), "Danger Zone"] }), _jsx("p", { className: "text-sm text-pf-text-secondary", children: "Permanently delete your account and all associated data. This action cannot be undone." }), _jsxs("button", { onClick: () => setDeleteDialogOpen(true), className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 transition-colors", children: [_jsx(Trash2, { className: "size-4" }), "Delete Account"] }), deleteDialogOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm", children: _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 max-w-md w-full mx-4 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-10 rounded-full bg-pf-danger/10 flex items-center justify-center", children: _jsx(AlertTriangle, { className: "size-5 text-pf-danger" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-pf-text", children: "Delete Account" }), _jsx("p", { className: "text-xs text-pf-text-muted", children: "This cannot be undone" })] })] }), _jsx("div", { className: "bg-pf-danger/5 border border-pf-danger/10 rounded-pf p-3", children: _jsx("p", { className: "text-sm text-pf-danger", children: "This will permanently delete your account. All strategies will be stopped. All API keys will be revoked. All data will be lost." }) }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Enter your password to confirm" }), _jsx("input", { type: "password", autoComplete: "current-password", value: deletePassword, onChange: e => setDeletePassword(e.target.value), placeholder: "Your password", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-danger/50 transition-colors" })] }), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx("button", { onClick: () => { setDeleteDialogOpen(false); setDeletePassword(''); }, className: "px-4 py-2 text-sm text-pf-text-secondary hover:text-pf-text rounded-pf hover:bg-pf-overlay transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleDeleteAccount, disabled: deleting || !deletePassword, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger text-white text-sm font-medium hover:bg-pf-danger/80 disabled:opacity-50 transition-colors", children: [deleting ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Trash2, { className: "size-4" }), "Delete My Account"] })] })] }) }))] }), activeTab === 'apikeys' && (_jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Generate API Key" }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Key Name" }), _jsx("input", { value: newKeyName, onChange: e => setNewKeyName(e.target.value), placeholder: "My Integration", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Scopes" }), _jsx("div", { className: "flex gap-4 mt-1", children: ['read', 'write', 'trade'].map(scope => (_jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer text-sm text-pf-text-secondary", children: [_jsx("input", { type: "checkbox", checked: newKeyScopes[scope], onChange: e => setNewKeyScopes(prev => ({ ...prev, [scope]: e.target.checked })), className: "rounded border-pf-border" }), scope.toUpperCase()] }, scope))) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: "Expiration (optional)" }), _jsx("input", { type: "date", value: newKeyExpiration, onChange: e => setNewKeyExpiration(e.target.value), className: "w-full max-w-[220px] h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("button", { onClick: createApiKey, disabled: apiKeysCreating || !newKeyName.trim(), className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 transition-colors", children: [apiKeysCreating ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Key, { className: "size-4" }), "Generate API Key"] })] }), createdKey?.key && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 rounded-pf bg-pf-warning/10 text-pf-warning text-xs", children: [_jsx(Shield, { className: "size-3.5 shrink-0" }), "Copy this key now -- it won't be shown again!"] }), _jsxs("div", { className: "flex items-center gap-2 bg-pf-surface rounded-pf p-3 border border-pf-border", children: [_jsx("code", { className: "flex-1 text-xs font-mono text-pf-text break-all", children: createdKey.key }), _jsx("button", { onClick: () => copyKey(createdKey.key), className: "p-1.5 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text", children: _jsx(Copy, { className: "size-3.5" }) })] }), _jsx("button", { onClick: () => setCreatedKey(null), className: "text-xs text-pf-text-muted hover:text-pf-text transition-colors", children: "Got it" })] })), _jsxs("div", { className: "border-t border-pf-border-subtle pt-6", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider mb-4", children: "Your API Keys" }), apiKeysLoading ? (_jsx("div", { className: "space-y-2", children: [1, 2, 3].map(i => (_jsx("div", { className: "h-10 bg-pf-overlay rounded animate-pulse" }, i))) })) : apiKeys.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-6 text-center", children: [_jsx(Key, { className: "size-8 text-pf-text-muted mb-2" }), _jsx("p", { className: "text-sm text-pf-text-muted", children: "No API keys yet. Generate one to get started." })] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs text-pf-text-secondary uppercase tracking-wider border-b border-pf-border-subtle", children: [_jsx("th", { className: "pb-2 font-medium", children: "Name" }), _jsx("th", { className: "pb-2 font-medium", children: "Key Prefix" }), _jsx("th", { className: "pb-2 font-medium", children: "Scopes" }), _jsx("th", { className: "pb-2 font-medium", children: "Created" }), _jsx("th", { className: "pb-2 font-medium", children: "Last Used" }), _jsx("th", { className: "pb-2 font-medium", children: "Status" }), _jsx("th", { className: "pb-2 font-medium", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-pf-border-subtle", children: apiKeys.map(key => (_jsxs("tr", { children: [_jsx("td", { className: "py-2 text-pf-text", children: key.name }), _jsxs("td", { className: "py-2 font-mono text-xs text-pf-text-secondary", children: [key.prefix, "..."] }), _jsx("td", { className: "py-2", children: _jsx("div", { className: "flex gap-1", children: key.scopes.map(scope => (_jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded font-medium ${scope === 'READ' ? 'bg-pf-success/10 text-pf-success' :
                                                                    scope === 'WRITE' ? 'bg-blue-500/10 text-blue-400' :
                                                                        'bg-pf-warning/10 text-pf-warning'}`, children: scope }, scope))) }) }), _jsx("td", { className: "py-2 font-mono text-xs text-pf-text-muted", children: formatDate(key.createdAt) }), _jsx("td", { className: "py-2 font-mono text-xs text-pf-text-muted", children: key.lastUsedAt ? formatDate(key.lastUsedAt) : '\u2014' }), _jsx("td", { className: "py-2", children: key.revoked ? (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-danger/10 text-pf-danger", children: "Revoked" })) : (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded font-medium bg-pf-success/10 text-pf-success", children: "Active" })) }), _jsx("td", { className: "py-2", children: _jsxs("button", { onClick: () => revokeApiKey(key.id), disabled: key.revoked, className: "flex items-center gap-1 text-xs text-pf-danger hover:text-pf-danger disabled:opacity-30 transition-colors", children: [_jsx(Ban, { className: "size-3" }), " Revoke"] }) })] }, key.id))) })] }) }))] })] }))] }));
}
