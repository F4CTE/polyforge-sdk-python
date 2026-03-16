import { Routes } from '@angular/router';
export const profileRoutes: Routes = [
  { path: 'me',          loadComponent: () => import('./my-profile/my-profile.component').then(m => m.MyProfileComponent) },
  { path: ':username',   loadComponent: () => import('./public-profile/public-profile.component').then(m => m.PublicProfileComponent) },
];
