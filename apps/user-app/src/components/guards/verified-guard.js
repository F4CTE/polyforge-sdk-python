import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/auth-store';
export function VerifiedGuard() {
    const { user } = useAuthStore();
    if (!user?.emailVerified)
        return _jsx(Navigate, { to: "/verify-email", replace: true });
    return _jsx(Outlet, {});
}
