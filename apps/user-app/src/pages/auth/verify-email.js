import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
export function Component() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const user = useAuthStore((s) => s.user);
    const patchUser = useAuthStore((s) => s.patchUser);
    const [state, setState] = useState(token ? 'pending' : 'waiting');
    const [error, setError] = useState('');
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);
    useEffect(() => {
        if (!token)
            return;
        let cancelled = false;
        async function verify() {
            try {
                const res = await fetch(`/auth/v1/verify-email?token=${encodeURIComponent(token)}`, {
                    method: 'POST',
                    credentials: 'include',
                });
                if (cancelled)
                    return;
                if (res.ok) {
                    setState('verified');
                    patchUser({ emailVerified: true });
                }
                else {
                    const err = await res.json();
                    setState('error');
                    setError(err?.message ?? 'Verification link is invalid or expired.');
                }
            }
            catch {
                if (!cancelled) {
                    setState('error');
                    setError('Verification link is invalid or expired.');
                }
            }
        }
        verify();
        return () => { cancelled = true; };
    }, [token, patchUser]);
    async function handleResend() {
        if (!user?.email)
            return;
        setResending(true);
        try {
            await fetch('/auth/v1/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: user.email }),
            });
            setResent(true);
        }
        catch {
            // silently ignore
        }
        finally {
            setResending(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-4", style: { background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 60%), var(--color-pf-base)' }, children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "text-center mb-8", children: _jsx("div", { className: "text-pf-cyan-500 inline-block", children: _jsxs("svg", { width: "64", height: "64", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "currentColor", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "currentColor" })] }) }) }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg", children: [state === 'pending' && (_jsxs("div", { className: "text-center py-4", children: [_jsx(Loader2, { className: "size-12 text-pf-cyan-500 animate-spin mx-auto mb-4" }), _jsx("p", { className: "text-pf-text-muted text-sm", children: "Verifying your email..." })] })), state === 'verified' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "size-16 rounded-full bg-pf-success/10 flex items-center justify-center mx-auto mb-4", children: _jsx(Check, { className: "size-8 text-pf-success" }) }), _jsx("h2", { className: "text-xl font-semibold text-pf-text mb-2", children: "Email verified!" }), _jsx("p", { className: "text-sm text-pf-text-muted mb-6", children: "Your account is now active." }), _jsx(Link, { to: "/markets", className: "inline-block px-6 py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 transition-colors", children: "Go to Markets" })] })), state === 'error' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "size-16 rounded-full bg-pf-danger/10 flex items-center justify-center mx-auto mb-4", children: _jsx(AlertCircle, { className: "size-8 text-pf-danger" }) }), _jsx("h2", { className: "text-xl font-semibold text-pf-text mb-2", children: "Verification failed" }), _jsx("p", { className: "text-sm text-pf-danger mb-6", children: error }), _jsx("button", { onClick: handleResend, disabled: resending, className: "inline-block px-6 py-2.5 border border-pf-border text-pf-text font-medium rounded-pf hover:bg-pf-border/30 disabled:opacity-50 transition-colors", children: resending ? 'Sending...' : 'Resend email' })] })), state === 'waiting' && (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "size-16 rounded-full bg-pf-cyan-500/10 flex items-center justify-center mx-auto mb-4", children: _jsx(Mail, { className: "size-8 text-pf-cyan-500" }) }), _jsx("h2", { className: "text-xl font-semibold text-pf-text mb-2", children: "Check your email" }), _jsxs("p", { className: "text-sm text-pf-text-muted mb-4", children: ["We sent a verification link to", ' ', user?.email ? _jsx("strong", { className: "text-pf-text", children: user.email }) : 'your email', ". Click the link to activate your account."] }), resent && (_jsxs("div", { className: "flex items-center justify-center gap-2 bg-pf-success/10 border border-pf-success/20 text-pf-success rounded-pf px-4 py-3 mb-4 text-sm", children: [_jsx(Check, { className: "size-4" }), _jsx("span", { children: "Verification email resent!" })] })), _jsx("button", { onClick: handleResend, disabled: resending, className: "w-full py-2.5 border border-pf-border text-pf-text font-medium rounded-pf hover:bg-pf-border/30 disabled:opacity-50 transition-colors", children: resending ? 'Sending...' : 'Resend email' }), _jsx("div", { className: "mt-4 text-sm", children: _jsx(Link, { to: "/login", className: "text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors", children: "Back to login" }) })] }))] })] }) }));
}
