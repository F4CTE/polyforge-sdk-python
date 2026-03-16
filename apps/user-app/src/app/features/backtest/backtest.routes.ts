import { Routes } from '@angular/router';
export const backtestRoutes: Routes = [
  { path: '', loadComponent: () => import('./backtest.component').then(m => m.BacktestComponent) },
];
