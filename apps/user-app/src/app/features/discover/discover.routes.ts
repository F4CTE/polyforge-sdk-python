import { Routes } from '@angular/router';

export const discoverRoutes: Routes = [
  { path: '', loadComponent: () => import('./discover.component').then(m => m.DiscoverComponent) },
];
