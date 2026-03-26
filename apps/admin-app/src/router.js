import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter, Navigate } from 'react-router';
import { AuthGuard } from '@/components/guards/auth-guard';
export const router = createBrowserRouter([
    {
        path: '/login',
        lazy: () => import('@/pages/auth/login'),
    },
    {
        path: '/',
        element: _jsx(AuthGuard, {}),
        children: [
            {
                lazy: () => import('@/components/layout/admin-layout'),
                children: [
                    { index: true, element: _jsx(Navigate, { to: "dashboard", replace: true }) },
                    { path: 'dashboard', lazy: () => import('@/pages/dashboard/dashboard') },
                    { path: 'users', lazy: () => import('@/pages/users/users-list') },
                    { path: 'users/:id', lazy: () => import('@/pages/users/user-detail') },
                    { path: 'strategies', lazy: () => import('@/pages/strategies/strategies') },
                    { path: 'orders', lazy: () => import('@/pages/orders/orders') },
                    { path: 'backtests', lazy: () => import('@/pages/backtests/backtests') },
                    { path: 'cache', lazy: () => import('@/pages/cache/cache') },
                    { path: 'reports', lazy: () => import('@/pages/reports/reports') },
                    { path: 'logs', lazy: () => import('@/pages/logs/logs') },
                    { path: 'builder', lazy: () => import('@/pages/builder/builder') },
                    { path: 'invites', lazy: () => import('@/pages/invites/invites') },
                    { path: 'tickets', lazy: () => import('@/pages/tickets/tickets') },
                    { path: 'tickets/:id', lazy: () => import('@/pages/tickets/ticket-detail') },
                    { path: 'admins', lazy: () => import('@/pages/admins/admins') },
                ],
            },
        ],
    },
    {
        path: '*',
        element: _jsx(Navigate, { to: "/login", replace: true }),
    },
]);
