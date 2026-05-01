import { createBrowserRouter, Navigate } from 'react-router';
import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';

const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'] as const;

export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: () => import('@/pages/auth/login'),
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        lazy: () => import('@/components/layout/admin-layout'),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', lazy: () => import('@/pages/dashboard/dashboard') },
          { path: 'users', lazy: () => import('@/pages/users/users-list') },
          { path: 'users/:id', lazy: () => import('@/pages/users/user-detail') },
          { path: 'users/segmentation', lazy: () => import('@/pages/users/segmentation') },
          { path: 'strategies', lazy: () => import('@/pages/strategies/strategies') },
          { path: 'orders', lazy: () => import('@/pages/orders/orders') },
          { path: 'markets', lazy: () => import('./pages/markets/markets') },
          { path: 'backtests', lazy: () => import('@/pages/backtests/backtests') },
          { path: 'cache', lazy: () => import('@/pages/cache/cache') },
          { path: 'reports', lazy: () => import('@/pages/reports/reports') },
          { path: 'logs', lazy: () => import('@/pages/logs/logs') },
          { path: 'health', lazy: () => import('./pages/health/health') },
          { path: 'venues', lazy: () => import('@/pages/venues/venues') },
          { path: 'builder', lazy: () => import('@/pages/builder/builder') },
          { path: 'invites', lazy: () => import('@/pages/invites/invites') },
          { path: 'tickets', lazy: () => import('@/pages/tickets/tickets') },
          { path: 'tickets/:id', lazy: () => import('@/pages/tickets/ticket-detail') },
          { path: 'sentiment', lazy: () => import('@/pages/sentiment/sentiment') },
          { path: 'abuse', lazy: () => import('@/pages/abuse/abuse') },
          { path: 'approvals', lazy: () => import('@/pages/approvals/approvals') },
          { path: 'listings', lazy: () => import('@/pages/listings/listings') },
          { path: 'revenue', lazy: () => import('@/pages/revenue/revenue') },
          { path: 'retention', lazy: () => import('@/pages/retention/retention') },
          { path: 'broadcasts', lazy: () => import('@/pages/broadcasts/broadcasts') },
          {
            element: <RoleGuard allowed={SUPER_ADMIN_ONLY} />,
            children: [
              { path: 'admins', lazy: () => import('@/pages/admins/admins') },
              { path: 'config', lazy: () => import('@/pages/config/config') },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
