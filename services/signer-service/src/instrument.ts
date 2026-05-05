import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  serverName: "signer-service",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  beforeSend(event) {
    if (!process.env.SENTRY_DSN) return null;
    if (event.request && "data" in event.request) {
      return {
        ...event,
        request: {
          ...event.request,
          data: undefined,
        },
      };
    }
    return event;
  },
});
