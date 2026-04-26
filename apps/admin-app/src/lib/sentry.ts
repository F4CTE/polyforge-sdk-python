/// <reference types="vite/client" />
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    beforeSend(event) {
      if (!SENTRY_DSN) return null;
      return event;
    },
  });
}

export function setSentryUser(id: string, email: string): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser({ id, email });
}

export function clearSentryUser(): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
