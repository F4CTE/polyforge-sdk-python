import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// NEXT_STATIC_EXPORT=true is set by the gateway Dockerfile to produce a static
// out/ directory for nginx file serving. Dev and the landing Dockerfile keep
// standalone mode so the Next.js server runs normally.
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";
const sentryEnvelopeEndpoint = getSentryEnvelopeEndpoint(
  process.env.NEXT_PUBLIC_SENTRY_DSN,
);

function getSentryEnvelopeEndpoint(dsn: string | undefined) {
  if (!dsn) return undefined;

  try {
    const dsnUrl = new URL(dsn);
    const segments = dsnUrl.pathname.split("/").filter(Boolean);
    const apiIndex = segments.lastIndexOf("api");
    const projectId = apiIndex >= 0 ? segments[apiIndex + 1] : segments.at(-1);

    if (!projectId) return undefined;

    const envelopeUrl = new URL(dsn);
    envelopeUrl.username = "";
    envelopeUrl.password = "";
    envelopeUrl.pathname = `/api/${projectId}/envelope/`;
    envelopeUrl.search = "";
    envelopeUrl.searchParams.set("sentry_version", "7");

    if (dsnUrl.username) {
      envelopeUrl.searchParams.set("sentry_key", dsnUrl.username);
    }

    return envelopeUrl.toString();
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  transpilePackages: ["@polyforge/ui"],
  env: {
    NEXT_PUBLIC_SENTRY_TUNNEL: isStaticExport ? "" : "/monitoring",
  },
  // redirects/rewrites are not supported by output:'export' and are redundant
  // in all docker setups (nginx handles /auth and /api-docs routing).
  ...(!isStaticExport && {
    async redirects() {
      return [
        {
          source: "/api-docs",
          destination: process.env.APP_URL ?? "http://localhost:5173/api-docs",
          permanent: false,
        },
      ];
    },
    async rewrites() {
      return [
        ...(sentryEnvelopeEndpoint
          ? [
              {
                source: "/monitoring",
                destination: sentryEnvelopeEndpoint,
              },
            ]
          : []),
        {
          source: "/auth/:path*",
          destination: `${process.env.API_URL ?? "http://localhost:4000"}/auth/:path*`,
        },
      ];
    },
  }),
};

// Use CommonJS export so Next.js reads the config object directly.
// ESM `export default` in a .ts file gets transpiled to { __esModule: true, default: {...} }
// which Next.js treats as an unrecognised-key object and silently ignores options like `output`.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  // Upload source maps only when SENTRY_AUTH_TOKEN is set (CI/CD environments).
  // Omitting the token skips upload without failing the build.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  // Disable server-side Sentry tracing in static export mode — no Node.js runtime.
  // Exclude /_global-error from Sentry auto-instrumentation to prevent the
  // Sentry React wrapper from being injected during SSR (which would cause a
  // second useContext crash even after the Next.js appConfig patch).
  webpack: {
    autoInstrumentServerFunctions: !isStaticExport,
    excludeServerRoutes: ["/_global-error"],
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
