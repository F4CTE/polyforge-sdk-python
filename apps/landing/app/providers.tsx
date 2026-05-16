"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("polyforge:consent");
    if (!raw) return false;
    // Migrate legacy plain-string format to JSON with current timestamp
    if (raw === "accepted" || raw === "essential-only") {
      try {
        localStorage.setItem(
          "polyforge:consent",
          JSON.stringify({ state: raw, timestamp: Date.now() }),
        );
      } catch {
        // silent
      }
      return raw === "accepted";
    }
    const entry = JSON.parse(raw);
    if (!Number.isFinite(entry.timestamp) || Date.now() - entry.timestamp > CONSENT_MAX_AGE_MS) return false;
    return entry.state === "accepted";
  } catch {
    return false;
  }
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname) {
      ph.capture("page_viewed", {
        path: pathname,
        search: searchParams.toString() || undefined,
      });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

function PostHogGate({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [phReady, setPhReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (hasConsent()) {
      setEnabled(true);
    }

    function onConsentChange(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      if (detail === "accepted") {
        setEnabled(true);
      } else if (detail === "essential-only") {
        setEnabled(false);
        if (initialized.current) posthog.opt_out_capturing();
      }
    }

    function onConsentReset() {
      setEnabled(false);
      if (initialized.current) posthog.opt_out_capturing();
    }

    window.addEventListener("polyforge:consent", onConsentChange);
    window.addEventListener("polyforge:consent-reset", onConsentReset);
    return () => {
      window.removeEventListener("polyforge:consent", onConsentChange);
      window.removeEventListener("polyforge:consent-reset", onConsentReset);
    };
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    if (enabled && !initialized.current) {
      initialized.current = true;
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "[data-sensitive]",
        },
        mask_all_text: true,
        mask_all_element_attributes: true,
        capture_pageview: false,
        loaded: () => {
          setPhReady(true);
        },
      });
    }

    if (enabled && initialized.current) {
      posthog.opt_in_capturing();
    }
  }, [enabled]);

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      {children}
      {enabled && phReady && (
        <Suspense>
          <PageViewTracker />
        </Suspense>
      )}
    </PHProvider>
  );
}

export { PostHogGate as PostHogProvider };
