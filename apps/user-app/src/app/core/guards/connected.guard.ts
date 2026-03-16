import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';

export const connectedGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.isAuthenticated()) return router.createUrlTree(['/login']);
  if (!store.isVerified()) return router.createUrlTree(['/verify-email']);
  if (!store.isConnected()) return router.createUrlTree(['/settings/trading-account']);
  return true;
};
