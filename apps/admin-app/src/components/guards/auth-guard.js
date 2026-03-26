import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router';
import { useAdminAuthStore } from '@/stores/admin-auth-store';
export function AuthGuard() {
    const { isAuthenticated, loading } = useAdminAuthStore();
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen bg-[var(--color-pf-bg)]", children: _jsxs("div", { className: "text-center", children: [_jsxs("svg", { className: "mx-auto animate-pulse", width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", children: [_jsx("path", { d: "M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z", stroke: "var(--color-pf-cyan-500)", strokeWidth: "1.2", fill: "none", opacity: "0.4" }), _jsx("path", { d: "M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z", fill: "var(--color-pf-cyan-500)" })] }), _jsx("p", { className: "mt-4 text-sm text-[var(--color-pf-text-secondary)]", children: "Verifying admin session..." })] }) }));
    }
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(Outlet, {});
}
