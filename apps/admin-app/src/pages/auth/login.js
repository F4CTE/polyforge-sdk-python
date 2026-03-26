import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
export function Component() {
    const navigate = useNavigate();
    const login = useAdminAuthStore((s) => s.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [totpRequired, setTotpRequired] = useState(false);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password, totpRequired ? totpCode : undefined);
            navigate('/dashboard', { replace: true });
        }
        catch (err) {
            const apiErr = err;
            if (apiErr?.body?.code === 'TOTP_REQUIRED') {
                setTotpRequired(true);
                toast.info('2FA code required');
            }
            else {
                toast.error(apiErr?.body?.message || 'Invalid credentials');
            }
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "flex items-center justify-center min-h-screen p-4", style: { background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.06) 0%, transparent 60%), var(--color-pf-bg)' }, children: _jsxs("div", { className: "w-full max-w-sm", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "flex items-center justify-center gap-2 mb-4", children: _jsxs("svg", { width: "64", height: "64", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "var(--color-pf-cyan-500)", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "var(--color-pf-cyan-500)" })] }) }), _jsx("h1", { className: "text-2xl font-semibold text-[var(--color-pf-text)]", children: "Polyforge Admin" }), _jsxs("div", { className: "flex items-center justify-center gap-1.5 mt-2", children: [_jsx(ShieldCheck, { size: 14, className: "text-[var(--color-pf-cyan-500)]" }), _jsx("span", { className: "text-xs text-[var(--color-pf-text-tertiary)]", children: "Admin Console" })] })] }), _jsxs("form", { onSubmit: handleSubmit, className: "bg-[var(--color-pf-elevated)] border border-[var(--color-pf-border)] rounded-pf-lg p-6 space-y-4 shadow-pf-lg", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1.5", children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, autoFocus: true, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus:border-[var(--color-pf-cyan-500)] transition-colors", placeholder: "admin@polyforge.io" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1.5", children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), required: true, className: "w-full px-3 py-2 text-sm rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus:border-[var(--color-pf-cyan-500)] transition-colors", placeholder: "Enter password" })] }), totpRequired && (_jsxs("div", { children: [_jsx("label", { htmlFor: "totp", className: "block text-xs font-medium text-[var(--color-pf-text-secondary)] mb-1.5", children: "2FA Code" }), _jsx("input", { id: "totp", type: "text", inputMode: "numeric", pattern: "[0-9]*", maxLength: 6, autoComplete: "one-time-code", value: totpCode, onChange: (e) => setTotpCode(e.target.value.replace(/\D/g, '')), required: true, autoFocus: true, className: "w-full px-3 py-2 text-sm text-center tracking-[0.3em] font-mono rounded-pf-sm border border-[var(--color-pf-border)] bg-[var(--color-pf-bg)] text-[var(--color-pf-text)] placeholder:text-[var(--color-pf-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-pf-cyan-500)] focus:border-[var(--color-pf-cyan-500)] transition-colors", placeholder: "000000" })] })), _jsx("button", { type: "submit", disabled: loading || (totpRequired && totpCode.length < 6), className: "w-full py-2 px-4 text-sm font-semibold rounded-pf-sm bg-[var(--color-pf-cyan-500)] text-black hover:bg-[var(--color-pf-cyan-400)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: loading ? 'Signing in...' : totpRequired ? 'Verify & Sign In' : 'Sign In' }), _jsx("p", { className: "text-[11px] text-center text-[var(--color-pf-text-tertiary)]", children: "This endpoint is rate limited. Too many failed attempts will result in a temporary lockout." })] })] }) }));
}
