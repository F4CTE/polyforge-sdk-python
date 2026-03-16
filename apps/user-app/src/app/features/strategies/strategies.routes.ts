import { Routes } from '@angular/router';

export const strategiesRoutes: Routes = [
  { path: '',       loadComponent: () => import('./strategies-list/strategies-list.component').then(m => m.StrategiesListComponent) },
  { path: 'new',    loadComponent: () => import('./builder/strategy-builder.component').then(m => m.StrategyBuilderComponent) },
  { path: ':id',    loadComponent: () => import('./strategy-detail/strategy-detail.component').then(m => m.StrategyDetailComponent) },
  { path: ':id/edit', loadComponent: () => import('./builder/strategy-builder.component').then(m => m.StrategyBuilderComponent) },
];
