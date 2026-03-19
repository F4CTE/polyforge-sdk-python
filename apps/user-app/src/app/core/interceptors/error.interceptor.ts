import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

const PUBLIC_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/terms', '/privacy'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Don't redirect on session-probe (GET /me) or when already on a public route
        const isSessionProbe = req.url.endsWith('/me') && req.method === 'GET';
        const isPublicRoute = PUBLIC_ROUTES.some(r => router.url.startsWith(r));
        if (!isSessionProbe && !isPublicRoute) {
          router.navigate(['/login']);
        }
      }
      return throwError(() => err);
    }),
  );
};
