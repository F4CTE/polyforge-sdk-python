import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_TUNNEL = process.env.NEXT_PUBLIC_SENTRY_TUNNEL;

Sentry.init({
  dsn: SENTRY_DSN,
  tunnel: SENTRY_DSN && SENTRY_TUNNEL ? SENTRY_TUNNEL : undefined,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  beforeSend(event) {
    if (!SENTRY_DSN) return null;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
