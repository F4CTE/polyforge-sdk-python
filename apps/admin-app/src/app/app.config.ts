import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AdminAuthStore } from './core/store/admin-auth.store';
import { AdminTheme } from './theme/admin.theme';

function initAdmin(store: AdminAuthStore) {
  return () => store.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: AdminTheme,
        options: { darkModeSelector: false, cssLayer: false },
      },
      ripple: true,
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initAdmin,
      deps: [AdminAuthStore],
      multi: true,
    },
  ],
};
