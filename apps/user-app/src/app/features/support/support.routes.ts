import { Routes } from '@angular/router';

export const supportRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ticket-list.component').then(m => m.TicketListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./create-ticket.component').then(m => m.CreateTicketComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./ticket-detail.component').then(m => m.TicketDetailComponent),
  },
];
