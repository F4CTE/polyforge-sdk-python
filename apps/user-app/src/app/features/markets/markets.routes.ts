import { Routes } from '@angular/router';

export const marketsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./markets-list/markets-list.component').then(m => m.MarketsListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./market-detail/market-detail.component').then(m => m.MarketDetailComponent),
  },
];
