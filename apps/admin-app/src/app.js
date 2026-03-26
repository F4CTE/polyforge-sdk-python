import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './router';
import { useAdminAuthStore } from './stores/admin-auth-store';
import { useThemeStore } from './stores/theme-store';
export function App() {
    const init = useAdminAuthStore((s) => s.init);
    const isDark = useThemeStore((s) => s.isDark);
    useEffect(() => {
        init();
    }, [init]);
    return (_jsxs(_Fragment, { children: [_jsx(RouterProvider, { router: router }), _jsx(Toaster, { theme: isDark ? 'dark' : 'light', position: "top-right", toastOptions: {
                    style: {
                        background: 'var(--color-pf-elevated)',
                        border: '1px solid var(--color-pf-border)',
                        color: 'var(--color-pf-text)',
                    },
                } })] }));
}
