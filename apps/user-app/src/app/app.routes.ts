import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { verifiedGuard } from './core/guards/verified.guard';

export const routes: Routes = [
  // ─── Public auth routes ─────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },

  // ─── Legal pages (public) ───────────────────────────────────────────────
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms/terms.component').then(m => m.TermsComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy/privacy.component').then(m => m.PrivacyComponent),
  },

  // ─── Protected app shell ────────────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'markets',
        pathMatch: 'full',
      },
      {
        path: 'markets',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/markets/markets.routes').then(m => m.marketsRoutes),
      },
      {
        path: 'discover',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/discover/discover.routes').then(m => m.discoverRoutes),
      },
      {
        path: 'leaderboard',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/leaderboard/leaderboard.routes').then(m => m.leaderboardRoutes),
      },
      {
        path: 'strategies',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/strategies/strategies.routes').then(m => m.strategiesRoutes),
      },
      {
        path: 'portfolio',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/portfolio/portfolio.routes').then(m => m.portfolioRoutes),
      },
      {
        path: 'orders',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/orders/orders.routes').then(m => m.ordersRoutes),
      },
      {
        path: 'backtest',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/backtest/backtest.routes').then(m => m.backtestRoutes),
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile.routes').then(m => m.profileRoutes),
      },
      {
        path: 'support',
        canActivate: [verifiedGuard],
        loadChildren: () => import('./features/support/support.routes').then(m => m.supportRoutes),
      },
      {
        path: 'settings',
        canActivate: [authGuard],
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.settingsRoutes),
      },
    ],
  },

  // ─── Fallback ────────────────────────────────────────────────────────────
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
