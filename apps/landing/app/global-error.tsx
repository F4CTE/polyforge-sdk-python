"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="bg-app text-primary font-sans antialiased min-h-screen">
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto size-16 rounded-full bg-loss/10 flex items-center justify-center">
              <AlertTriangle className="size-8 text-loss" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-primary mb-2">
                Something went wrong
              </h1>
              <p className="text-body-sm text-tertiary">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-pf bg-accent text-inverse text-body-sm font-medium hover:bg-accent-hover focus-visible:outline-none focus-visible:shadow-focus-ring transition-colors"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
