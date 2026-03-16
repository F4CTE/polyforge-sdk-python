import { Routes } from '@angular/router';
export const settingsRoutes: Routes = [
  { path: '',                 loadComponent: () => import('./settings.component').then(m => m.SettingsComponent) },
  { path: 'trading-account', loadComponent: () => import('./trading-account/trading-account.component').then(m => m.TradingAccountComponent) },
];
