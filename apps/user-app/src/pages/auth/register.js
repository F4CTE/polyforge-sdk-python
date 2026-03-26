import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Mail, Lock, User, KeyRound, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
function validatePassword(v) {
    if (!v)
        return '';
    if (!/[A-Z]/.test(v))
        return 'Must contain at least one uppercase letter';
    if (!/[a-z]/.test(v))
        return 'Must contain at least one lowercase letter';
    if (!/[0-9]/.test(v))
        return 'Must contain at least one number';
    return '';
}
function validateUsername(v) {
    if (!v)
        return '';
    if (!/^[a-zA-Z0-9_]+$/.test(v))
        return 'Only letters, numbers, and underscores';
    if (/^_/.test(v) || /_$/.test(v))
        return 'Cannot start or end with underscore';
    return '';
}
export function Component() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const register = useAuthStore((s) => s.register);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [tosAccepted, setTosAccepted] = useState(false);
    const [inviteCode, setInviteCode] = useState(searchParams.get('invite') ?? '');
    const [showInvite, setShowInvite] = useState(!!searchParams.get('invite'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [touched, setTouched] = useState({});
    function fieldError(field) {
        if (!touched[field])
            return '';
        switch (field) {
            case 'email':
                if (!email)
                    return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    return 'Enter a valid email address';
                if (email.length > 255)
                    return 'Maximum 255 characters';
                return '';
            case 'username':
                if (!username)
                    return 'Username is required';
                if (username.length < 3)
                    return 'Minimum 3 characters';
                if (username.length > 30)
                    return 'Maximum 30 characters';
                return validateUsername(username);
            case 'password':
                if (!password)
                    return 'Password is required';
                if (password.length < 8)
                    return 'Minimum 8 characters';
                return validatePassword(password);
            case 'confirmPassword':
                if (!confirmPassword)
                    return 'Confirm your password';
                if (password !== confirmPassword)
                    return 'Passwords do not match';
                return '';
            case 'tos':
                if (!tosAccepted)
                    return 'You must accept the Terms of Service';
                return '';
            default:
                return '';
        }
    }
    async function handleSubmit(e) {
        e.preventDefault();
        const allTouched = { email: true, username: true, password: true, confirmPassword: true, tos: true };
        setTouched(allTouched);
        const hasErrors = ['email', 'username', 'password', 'confirmPassword', 'tos'].some((f) => {
            // Re-check with touched=true
            switch (f) {
                case 'email': return !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255;
                case 'username': return !username || username.length < 3 || username.length > 30 || !!validateUsername(username);
                case 'password': return !password || password.length < 8 || !!validatePassword(password);
                case 'confirmPassword': return !confirmPassword || password !== confirmPassword;
                case 'tos': return !tosAccepted;
                default: return false;
            }
        });
        if (hasErrors)
            return;
        setLoading(true);
        setError('');
        try {
            const body = {
                email, username, password, tosAccepted,
            };
            if (inviteCode)
                body.inviteCode = inviteCode;
            await register(body);
            navigate('/verify-email');
        }
        catch (err) {
            setLoading(false);
            const apiErr = err;
            if (apiErr?.code === 'INVITE_REQUIRED' || apiErr?.code === 'INVITE_INVALID') {
                setShowInvite(true);
            }
            setError(apiErr?.message ?? 'Registration failed. Please try again.');
        }
    }
    const inputClass = 'w-full pl-10 pr-4 py-2.5 bg-pf-base border border-pf-border rounded-pf text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:ring-2 focus:ring-pf-cyan-500/40 focus:border-pf-cyan-500 transition-colors';
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-4 py-8", style: { background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 60%), var(--color-pf-base)' }, children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "text-pf-cyan-500 inline-block", children: _jsxs("svg", { width: "64", height: "64", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "currentColor", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "currentColor" })] }) }), _jsx("h1", { className: "text-2xl font-semibold mt-4 bg-gradient-to-r from-pf-cyan-400 to-pf-cyan-300 bg-clip-text text-transparent", children: "Create your account" }), _jsx("p", { className: "text-pf-text-muted text-sm mt-1", children: "Start trading on autopilot" })] }), _jsxs("div", { className: "bg-pf-elevated border border-pf-border rounded-pf-lg p-8 shadow-pf-lg", children: [error && (_jsxs("div", { className: "flex items-center gap-2 bg-pf-danger/10 border border-pf-danger/20 text-pf-danger rounded-pf px-4 py-3 mb-4 text-sm", children: [_jsx(AlertCircle, { className: "size-4 shrink-0" }), _jsx("span", { children: error })] })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Email" }), _jsxs("div", { className: "relative", children: [_jsx(Mail, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), onBlur: () => setTouched((t) => ({ ...t, email: true })), placeholder: "you@example.com", className: inputClass })] }), fieldError('email') && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: fieldError('email') })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "username", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Username" }), _jsxs("div", { className: "relative", children: [_jsx(User, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "username", type: "text", autoComplete: "username", value: username, onChange: (e) => setUsername(e.target.value), onBlur: () => setTouched((t) => ({ ...t, username: true })), placeholder: "alice", className: inputClass })] }), fieldError('username') && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: fieldError('username') })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "password", type: "password", autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value), onBlur: () => setTouched((t) => ({ ...t, password: true })), placeholder: "At least 8 characters", className: inputClass })] }), fieldError('password') && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: fieldError('password') }), touched.password && password && (_jsxs("ul", { className: "mt-1.5 text-xs space-y-0.5 list-disc list-inside", children: [_jsx("li", { className: password.length >= 8 ? 'text-pf-success' : 'text-pf-text-muted', children: "Minimum 8 characters" }), _jsx("li", { className: /[A-Z]/.test(password) ? 'text-pf-success' : 'text-pf-text-muted', children: "One uppercase letter" }), _jsx("li", { className: /[a-z]/.test(password) ? 'text-pf-success' : 'text-pf-text-muted', children: "One lowercase letter" }), _jsx("li", { className: /\d/.test(password) ? 'text-pf-success' : 'text-pf-text-muted', children: "One number" })] }))] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "confirmPassword", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Confirm password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "confirmPassword", type: "password", autoComplete: "new-password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), onBlur: () => setTouched((t) => ({ ...t, confirmPassword: true })), placeholder: "Repeat your password", className: inputClass })] }), fieldError('confirmPassword') && _jsx("p", { className: "mt-1 text-xs text-pf-danger", children: fieldError('confirmPassword') })] }), (showInvite || inviteCode) && (_jsxs("div", { children: [_jsx("label", { htmlFor: "inviteCode", className: "block text-sm font-medium text-pf-text mb-1.5", children: "Invite code" }), _jsxs("div", { className: "relative", children: [_jsx(KeyRound, { className: "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-pf-text-muted" }), _jsx("input", { id: "inviteCode", type: "text", value: inviteCode, onChange: (e) => setInviteCode(e.target.value.toUpperCase()), placeholder: "POLY-XXXXXX", className: `${inputClass} uppercase` })] })] })), _jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx("input", { id: "tos", type: "checkbox", checked: tosAccepted, onChange: (e) => { setTosAccepted(e.target.checked); setTouched((t) => ({ ...t, tos: true })); }, className: "mt-1 size-4 rounded border-pf-border bg-pf-base accent-pf-cyan-500" }), _jsxs("label", { htmlFor: "tos", className: "text-sm text-pf-text leading-relaxed cursor-pointer", children: ["I agree to the", ' ', _jsx("a", { href: "/terms", target: "_blank", rel: "noopener noreferrer", className: "text-pf-cyan-500 hover:text-pf-cyan-400 transition-colors", children: "Terms of Service" })] })] }), fieldError('tos') && _jsx("p", { className: "text-xs text-pf-danger -mt-2", children: fieldError('tos') }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-2.5 bg-pf-cyan-500 text-black font-semibold rounded-pf hover:bg-pf-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: loading ? 'Creating account...' : 'Create account' })] })] }), _jsxs("p", { className: "text-center text-sm text-pf-text-muted mt-6", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "text-pf-cyan-400 hover:text-pf-cyan-300 transition-colors", children: "Sign in" })] })] }) }));
}
