import { Routes } from '@angular/router';

export const leaderboardRoutes: Routes = [
  { path: '', loadComponent: () => import('./leaderboard.component').then(m => m.LeaderboardComponent) },
];
