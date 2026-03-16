import { Routes } from '@angular/router';
export const portfolioRoutes: Routes = [
  { path: '', loadComponent: () => import('./portfolio.component').then(m => m.PortfolioComponent) },
];
