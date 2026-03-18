import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Attaches `withCredentials: true` to every request so the browser
 * automatically sends the HttpOnly `pf_admin_token` cookie to the API.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
