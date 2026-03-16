import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router   = inject(Router);
  const tokenSvc = inject(TokenService);

  return next(req).pipe(
    catchError(err => {
      if (err.status === 401) {
        tokenSvc.clear();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
