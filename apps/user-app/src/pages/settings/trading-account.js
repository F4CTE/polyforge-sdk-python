import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Link2, Unlink, CheckCircle, XCircle, Loader2, Copy, QrCode, Eye, EyeOff, } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/auth-store';
/* ─── Component ──────────────────────────────────────────────────────── */
export function Component() {
    const { user, patchUser } = useAuthStore();
    const isConnected = user?.polymarketConnected === true;
    // Credentials form
    const [privateKey, setPrivateKey] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [apiPassphrase, setApiPassphrase] = useState('');
    const [safeAddress, setSafeAddress] = useState('');
    const [importing, setImporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [showApiSecret, setShowApiSecret] = useState(false);
    const [showPassphrase, setShowPassphrase] = useState(false);
    // Bot link code
    const [botCode, setBotCode] = useState(null);
    const [botCodeExpiry, setBotCodeExpiry] = useState(null);
    const [botCodeLoading, setBotCodeLoading] = useState(false);
    async function importCredentials() {
        if (importing)
            return;
        setImporting(true);
        try {
            const res = await fetch('/auth/v1/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    privateKey, apiKey, apiSecret, apiPassphrase,
                    safeAddress: safeAddress || undefined,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                patchUser({ polymarketConnected: data.connected });
                setPrivateKey('');
                setApiKey('');
                setApiSecret('');
                setApiPassphrase('');
                setSafeAddress('');
            }
        }
        catch {
            toast.error('Failed to import credentials');
        }
        setImporting(false);
    }
    async function deleteCredentials() {
        if (deleting)
            return;
        if (!confirm('Disconnect your Polymarket account? Your strategies will stop trading.'))
            return;
        setDeleting(true);
        try {
            const res = await fetch('/auth/v1/credentials', { method: 'DELETE', credentials: 'include' });
            if (res.ok)
                patchUser({ polymarketConnected: false });
        }
        catch {
            toast.error('Failed to disconnect account');
        }
        setDeleting(false);
    }
    async function generateBotCode() {
        if (botCodeLoading)
            return;
        setBotCodeLoading(true);
        try {
            const res = await fetch('/auth/v1/bot-code', { method: 'POST', credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setBotCode(data.code);
                setBotCodeExpiry(data.expiresAt);
            }
        }
        catch {
            toast.error('Failed to generate bot code');
        }
        setBotCodeLoading(false);
    }
    function copyBotCode() {
        if (botCode)
            navigator.clipboard.writeText(botCode);
    }
    const canImport = privateKey && apiKey && apiSecret && apiPassphrase && !importing;
    return (_jsxs("div", { className: "animate-fade-in p-6 max-w-2xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Link, { to: "/settings", className: "p-1.5 rounded-pf text-pf-text-muted hover:text-pf-text hover:bg-pf-elevated transition-colors", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "text-2xl font-semibold text-pf-text", children: "Trading Account" })] }), _jsxs("span", { "data-testid": "trading-status", className: `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${isConnected
                            ? 'bg-pf-success/10 text-pf-success border-pf-success/20'
                            : 'bg-pf-overlay text-pf-text-muted border-pf-border'}`, children: [isConnected ? _jsx(CheckCircle, { className: "size-3.5" }) : _jsx(XCircle, { className: "size-3.5" }), isConnected ? 'Connected' : 'Not Connected'] })] }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-5", children: isConnected ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Polymarket Credentials" }), _jsx("p", { className: "text-sm text-pf-text-secondary", children: "Your Polymarket account is connected. You can disconnect it at any time -- your strategies will stop trading until you reconnect." }), _jsxs("button", { onClick: deleteCredentials, disabled: deleting, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-danger/10 text-pf-danger border border-pf-danger/20 text-sm font-medium hover:bg-pf-danger/20 disabled:opacity-50 transition-colors", children: [deleting ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Unlink, { className: "size-4" }), "Disconnect Account"] })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Import Polymarket Credentials" }), _jsx("p", { className: "text-sm text-pf-text-secondary", children: "Enter your Polymarket API credentials to enable live trading. These are encrypted at rest." }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: ["Private Key ", _jsx("span", { className: "text-pf-danger", children: "*" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: showPrivateKey ? 'text' : 'password', value: privateKey, onChange: e => setPrivateKey(e.target.value), placeholder: "0x...", className: "w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" }), _jsx("button", { type: "button", onClick: () => setShowPrivateKey(!showPrivateKey), className: "absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text", children: showPrivateKey ? _jsx(EyeOff, { className: "size-4" }) : _jsx(Eye, { className: "size-4" }) })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: ["API Key ", _jsx("span", { className: "text-pf-danger", children: "*" })] }), _jsx("input", { type: "text", value: apiKey, onChange: e => setApiKey(e.target.value), placeholder: "API Key", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: ["API Secret ", _jsx("span", { className: "text-pf-danger", children: "*" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: showApiSecret ? 'text' : 'password', value: apiSecret, onChange: e => setApiSecret(e.target.value), placeholder: "API Secret", className: "w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" }), _jsx("button", { type: "button", onClick: () => setShowApiSecret(!showApiSecret), className: "absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text", children: showApiSecret ? _jsx(EyeOff, { className: "size-4" }) : _jsx(Eye, { className: "size-4" }) })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: ["API Passphrase ", _jsx("span", { className: "text-pf-danger", children: "*" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: showPassphrase ? 'text' : 'password', value: apiPassphrase, onChange: e => setApiPassphrase(e.target.value), placeholder: "Passphrase", className: "w-full h-10 px-3 pr-10 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" }), _jsx("button", { type: "button", onClick: () => setShowPassphrase(!showPassphrase), className: "absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-muted hover:text-pf-text", children: showPassphrase ? _jsx(EyeOff, { className: "size-4" }) : _jsx(Eye, { className: "size-4" }) })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs text-pf-text-secondary mb-1.5 block", children: ["Safe Address ", _jsx("span", { className: "text-pf-text-muted text-[10px]", children: "(optional)" })] }), _jsx("input", { type: "text", value: safeAddress, onChange: e => setSafeAddress(e.target.value), placeholder: "0x...", className: "w-full h-10 px-3 rounded-pf bg-pf-surface border border-pf-border text-sm text-pf-text font-mono placeholder:text-pf-text-muted focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("button", { onClick: importCredentials, disabled: !canImport, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-cyan-500 text-black text-sm font-medium hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: [importing ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Link2, { className: "size-4" }), "Connect Account"] })] })) }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-6 space-y-4", children: [_jsx("h2", { className: "text-sm font-semibold text-pf-text uppercase tracking-wider", children: "Bot Link Code" }), _jsx("p", { className: "text-sm text-pf-text-secondary", children: "Generate a one-time code to link the PolyForge Telegram bot to your account. The code expires after 10 minutes." }), botCode && (_jsxs("div", { className: "flex items-center gap-3 bg-pf-surface rounded-pf p-3 border border-pf-border", children: [_jsx("code", { className: "flex-1 font-mono text-lg text-pf-text tracking-wider", children: botCode }), _jsx("button", { onClick: copyBotCode, className: "p-1.5 rounded hover:bg-pf-overlay transition-colors text-pf-text-muted hover:text-pf-text", "aria-label": "Copy bot code", children: _jsx(Copy, { className: "size-4" }) })] })), botCodeExpiry && (_jsxs("p", { className: "text-xs text-pf-text-muted", children: ["Expires: ", _jsx("span", { className: "font-mono", children: botCodeExpiry })] })), _jsxs("button", { onClick: generateBotCode, disabled: botCodeLoading, className: "flex items-center gap-2 px-4 py-2 rounded-pf bg-pf-elevated border border-pf-border text-sm font-medium text-pf-text hover:border-pf-border-strong disabled:opacity-50 transition-colors", children: [botCodeLoading ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(QrCode, { className: "size-4" }), botCode ? 'Regenerate Code' : 'Generate Code'] })] })] }));
}
