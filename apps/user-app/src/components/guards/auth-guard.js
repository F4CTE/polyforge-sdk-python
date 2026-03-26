import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';
export function AuthGuard() {
    const { user, loading } = useAuthStore();
    if (loading)
        return null;
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(Outlet, {});
}
