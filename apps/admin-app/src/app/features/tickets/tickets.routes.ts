import { Routes } from '@angular/router';

export const ticketsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./tickets.component').then(m => m.TicketsComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./ticket-detail.component').then(m => m.AdminTicketDetailComponent),
  },
];
