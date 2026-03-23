import { createBrowserRouter } from 'react-router';
import { AuthGuard } from './components/guards/auth-guard';
import { VerifiedGuard } from './components/guards/verified-guard';
import { AppLayout } from './components/layout/app-layout';

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', lazy: () => import('./pages/auth/login') },
  { path: '/register', lazy: () => import('./pages/auth/register') },
  { path: '/verify-email', lazy: () => import('./pages/auth/verify-email') },
  { path: '/forgot-password', lazy: () => import('./pages/auth/forgot-password') },
  { path: '/reset-password', lazy: () => import('./pages/auth/reset-password') },
  { path: '/terms', lazy: () => import('./pages/legal/terms') },
  { path: '/privacy', lazy: () => import('./pages/legal/privacy') },

  // Protected routes
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, lazy: () => import('./pages/redirect-to-markets') },
          // Verified routes
          {
            element: <VerifiedGuard />,
            children: [
              { path: 'markets', lazy: () => import('./pages/markets/markets-list') },
              { path: 'markets/:id', lazy: () => import('./pages/markets/market-detail') },
              { path: 'strategies', lazy: () => import('./pages/strategies/strategies-list') },
              { path: 'strategies/new', lazy: () => import('./pages/strategies/strategy-builder') },
              { path: 'strategies/:id', lazy: () => import('./pages/strategies/strategy-detail') },
              { path: 'strategies/:id/edit', lazy: () => import('./pages/strategies/strategy-builder') },
              { path: 'portfolio', lazy: () => import('./pages/portfolio/portfolio') },
              { path: 'orders', lazy: () => import('./pages/orders/orders') },
              { path: 'backtest', lazy: () => import('./pages/backtest/backtest') },
              { path: 'copy', lazy: () => import('./pages/copy/copy-list') },
              { path: 'copy/new', lazy: () => import('./pages/copy/copy-setup') },
              { path: 'copy/:id', lazy: () => import('./pages/copy/copy-detail') },
              { path: 'discover', lazy: () => import('./pages/discover/discover') },
              { path: 'news', lazy: () => import('./pages/news/news-feed') },
              { path: 'news/:id', lazy: () => import('./pages/news/news-detail') },
              { path: 'whales', lazy: () => import('./pages/whales/whale-feed') },
              { path: 'whales/following', lazy: () => import('./pages/whales/whale-following') },
              { path: 'whales/:address', lazy: () => import('./pages/whales/whale-profile') },
              { path: 'leaderboard', lazy: () => import('./pages/leaderboard/leaderboard') },
              { path: 'support', lazy: () => import('./pages/support/ticket-list') },
              { path: 'support/new', lazy: () => import('./pages/support/create-ticket') },
              { path: 'support/:id', lazy: () => import('./pages/support/ticket-detail') },
              { path: 'api-docs', lazy: () => import('./pages/api-docs/api-docs') },
            ],
          },
          { path: 'settings', lazy: () => import('./pages/settings/settings') },
          { path: 'settings/trading-account', lazy: () => import('./pages/settings/trading-account') },
          { path: 'profile/me', lazy: () => import('./pages/profile/my-profile') },
          { path: 'profile/:username', lazy: () => import('./pages/profile/public-profile') },
        ],
      },
    ],
  },

  // 404
  { path: '*', lazy: () => import('./pages/not-found') },
]);
