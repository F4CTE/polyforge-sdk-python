/// <reference types="vite/client" />
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const SENSITIVE_QUERY_PARAMS = new Set(['token', 'code', 'reset_token', 'verification_token']);

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, window.location.origin);
    let changed = false;
    for (const key of SENSITIVE_QUERY_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[REDACTED]');
        changed = true;
      }
    }
    return changed ? url.toString() : rawUrl;
  } catch {
    return rawUrl;
  }
}

function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.url) {
    event.request.url = redactUrl(event.request.url);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      const data = crumb.data;
      if (!data) return crumb;

      let changed = false;
      const nextData: Record<string, unknown> = { ...data };

      for (const key of ['url', 'from', 'to'] as const) {
        const value = data[key];
        if (typeof value === 'string') {
          const redacted = redactUrl(value);
          if (redacted !== value) {
            nextData[key] = redacted;
            changed = true;
          }
        }
      }

      if (changed) {
        return {
          ...crumb,
          data: nextData,
        };
      }
      return crumb;
    });
  }
  return event;
}

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    beforeSend(event) {
      if (!SENTRY_DSN) return null;
      return sanitizeEvent(event);
    },
  });
}

export function setSentryUser(id: string, email: string, username: string): void {
  if (!SENTRY_DSN) return;
  void email;
  void username;
  Sentry.setUser({ id });
}

export function clearSentryUser(): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
