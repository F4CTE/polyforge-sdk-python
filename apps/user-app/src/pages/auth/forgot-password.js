import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router';
import { Mail, ArrowLeft, Check } from 'lucide-react';
export function Component() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [touched, setTouched] = useState(false);
    const emailError = touched && !email ? 'Email is required'
        : touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address'
            : '';
    async function handleSubmit(e) {
        e.preventDefault();
        setTouched(true);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return;
        setLoading(true);
        try {
            await fetch('/auth/v1/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });
        }
        catch {
            // always show success per spec
        }
        finally {
            setLoading(false);
            setSent(true);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-4", style: { background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 60%), var(--color-pf-base)' }, children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "text-center mb-8", children: _jsx("div", { className: "text-pf-cyan-500 inline-block", children: _jsxs("svg", { width: "64", height: "64", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "currentColor", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "currentColor" })] }) }) }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg", children: [!sent ? (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold text-pf-text mb-1", children: "Reset password" }), _jsx("p", { className: "text-sm text-pf-text-muted mb-6", children: "We'll send you a reset link." }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Email" }), _jsxs("div", { className: "relative", children: [_jsx(Mail, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), onBlur: () => setTouched(true), placeholder: "you@example.com", className: "w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors" })] }), emailError && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: emailError })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: loading ? 'Sending...' : 'Send reset link' })] })] })) : (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "size-16 rounded-full bg-pf-cyan-500/10 flex items-center justify-center mx-auto mb-4", children: _jsx(Check, { className: "size-8 text-pf-cyan-500" }) }), _jsx("h2", { className: "text-xl font-semibold text-pf-text mb-2", children: "Check your inbox" }), _jsx("p", { className: "text-sm text-pf-text-muted", children: "If an account with that email exists, we've sent a reset link." })] })), _jsx("div", { className: "border-t border-pf-border mt-6 pt-4 text-center text-sm", children: _jsxs(Link, { to: "/login", className: "inline-flex items-center gap-1.5 text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors", children: [_jsx(ArrowLeft, { className: "size-4" }), "Back to login"] }) })] })] }) }));
}
