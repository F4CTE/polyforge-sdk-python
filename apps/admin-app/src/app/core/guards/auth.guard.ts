import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthStore } from '../store/admin-auth.store';

export const authGuard: CanActivateFn = () => {
  const store  = inject(AdminAuthStore);
  const router = inject(Router);
  if (store.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
