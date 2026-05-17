import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  serverName: "signer-service",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  beforeSend(event) {
    if (!process.env.SENTRY_DSN) return null;

    if (event.request) {
      event.request.data = undefined;
      event.request.cookies = undefined;
      event.request.headers = undefined;
    }

    event.user = undefined;

    if (event.extra && typeof event.extra === "object") {
      const redactedExtra: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(event.extra)) {
        if (/passphrase|secret|private|token|authorization|cookie|password|key/i.test(key)) {
          redactedExtra[key] = "[REDACTED]";
        } else {
          redactedExtra[key] = value;
        }
      }
      event.extra = redactedExtra;
    }

    return event;
  },
});
