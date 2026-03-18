import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },

  // ─── Protected admin shell ───────────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      { path: '',         redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'users',     loadChildren:  () => import('./features/users/users.routes').then(m => m.usersRoutes) },
      { path: 'strategies', loadComponent: () => import('./features/strategies/strategies.component').then(m => m.StrategiesComponent) },
      { path: 'orders',     loadChildren:  () => import('./features/orders/orders.routes').then(m => m.ordersRoutes) },
      { path: 'backtests',  loadComponent: () => import('./features/backtests/backtests.component').then(m => m.BacktestsComponent) },
      { path: 'cache',      loadComponent: () => import('./features/cache/cache.component').then(m => m.CacheComponent) },
      { path: 'reports',    loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'logs',       loadComponent: () => import('./features/logs/logs.component').then(m => m.LogsComponent) },
      { path: 'builder',    loadComponent: () => import('./features/builder/builder.component').then(m => m.BuilderComponent) },
      { path: 'invites',    loadComponent: () => import('./features/invites/invites.component').then(m => m.InvitesComponent) },
      { path: 'admins',     loadComponent: () => import('./features/admins/admins.component').then(m => m.AdminsComponent) },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
