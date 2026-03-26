import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Lock, Check, AlertCircle } from 'lucide-react';
export function Component() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(token ? '' : 'Missing reset token. Please request a new link.');
    const [done, setDone] = useState(false);
    const [touched, setTouched] = useState({});
    const passwordError = touched.password && !password ? 'Password is required'
        : touched.password && password.length < 8 ? 'Minimum 8 characters'
            : '';
    const confirmError = touched.confirm && password && confirm && password !== confirm ? 'Passwords do not match' : '';
    async function handleSubmit(e) {
        e.preventDefault();
        setTouched({ password: true, confirm: true });
        if (!password || password.length < 8 ||
            !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) ||
            password !== confirm || !token)
            return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/auth/v1/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token, password }),
            });
            if (res.ok) {
                setDone(true);
            }
            else {
                const err = await res.json();
                setError(err?.message ?? 'Reset failed. Please request a new link.');
            }
        }
        catch {
            setError('Reset failed. Please request a new link.');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-4", style: { background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 60%), var(--color-pf-base)' }, children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "text-center mb-8", children: _jsx("div", { className: "text-pf-cyan-500 inline-block", children: _jsxs("svg", { width: "64", height: "64", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "currentColor", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "currentColor" })] }) }) }), _jsx("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg", children: !done ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold text-pf-text mb-1", children: "Set new password" }), _jsx("p", { className: "text-sm text-pf-text-muted mb-6", children: "Choose a strong password." }), error && (_jsxs("div", { className: "flex items-center gap-2 bg-pf-danger/10 border border-pf-danger/20 text-pf-danger rounded-pf px-4 py-3 mb-4 text-sm", children: [_jsx(AlertCircle, { className: "size-4 shrink-0" }), _jsx("span", { children: error })] })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-pf-text mb-1.5", children: "New password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "password", type: "password", autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value), onBlur: () => setTouched((t) => ({ ...t, password: true })), placeholder: "At least 8 characters", className: "w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors" })] }), passwordError && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: passwordError })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "confirm", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Confirm password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "confirm", type: "password", autoComplete: "new-password", value: confirm, onChange: (e) => setConfirm(e.target.value), onBlur: () => setTouched((t) => ({ ...t, confirm: true })), placeholder: "Repeat password", className: "w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors" })] }), confirmError && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: confirmError })] }), _jsx("button", { type: "submit", disabled: loading || !token, className: "w-full py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: loading ? 'Resetting...' : 'Reset password' })] })] })) : (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "size-16 rounded-full bg-pf-success/10 flex items-center justify-center mx-auto mb-4", children: _jsx(Check, { className: "size-8 text-pf-success" }) }), _jsx("h2", { className: "text-xl font-semibold text-pf-text mb-2", children: "Password reset" }), _jsx("p", { className: "text-sm text-pf-text-muted mb-6", children: "You can now sign in with your new password." }), _jsx(Link, { to: "/login", className: "inline-block px-6 py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 transition-colors", children: "Sign in" })] })) })] }) }));
}
