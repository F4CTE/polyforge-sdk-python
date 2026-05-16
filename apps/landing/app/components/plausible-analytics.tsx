"use client";

import { useEffect, useRef } from "react";

function hasAnalyticsConsent(): boolean {
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
    if (!Number.isFinite(entry.timestamp) || Date.now() - entry.timestamp > 365 * 24 * 60 * 60 * 1000) return false;
    return entry.state === "accepted";
  } catch {
    return false;
  }
}

function injectPlausibleScript() {
  const existing = document.querySelector(
    'script[data-domain="polyforge.app"]',
  );
  if (existing) return;
  // Save original History API methods before Plausible monkey-patches them
  // for SPA pageview tracking, so they can be restored on consent withdrawal.
  const winRef = window as unknown as Record<string, unknown>;
  if (!winRef.__plausibleOriginalPushState) {
    winRef.__plausibleOriginalPushState = window.history.pushState.bind(window.history);
  }
  if (!winRef.__plausibleOriginalReplaceState) {
    winRef.__plausibleOriginalReplaceState = window.history.replaceState.bind(window.history);
  }
  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute("data-domain", "polyforge.app");
  script.src = "https://plausible.io/js/script.js";
  document.head.appendChild(script);
}

function removePlausibleScript() {
  const el = document.querySelector('script[data-domain="polyforge.app"]');
  if (el) el.remove();
  // Restore original History API methods to unwind Plausible's SPA
  // monkey-patches and prevent duplicate listener accumulation on re-inject.
  const win = window as unknown as Record<string, unknown>;
  if (win.__plausibleOriginalPushState) {
    window.history.pushState = win.__plausibleOriginalPushState as typeof window.history.pushState;
    delete win.__plausibleOriginalPushState;
  }
  if (win.__plausibleOriginalReplaceState) {
    window.history.replaceState = win.__plausibleOriginalReplaceState as typeof window.history.replaceState;
    delete win.__plausibleOriginalReplaceState;
  }
  // Replace with a no-op so residual event listeners don't throw
  win.plausible = function () {
    /* noop */
  };
}

export function PlausibleAnalytics() {
  const enabled = useRef(false);

  useEffect(() => {
    if (hasAnalyticsConsent()) {
      enabled.current = true;
      injectPlausibleScript();
    }

    function onConsentChange(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      if (detail === "accepted") {
        enabled.current = true;
        injectPlausibleScript();
      }
      if (detail === "essential-only") {
        enabled.current = false;
        removePlausibleScript();
      }
    }

    function onConsentReset() {
      enabled.current = false;
      removePlausibleScript();
    }

    window.addEventListener("polyforge:consent", onConsentChange);
    window.addEventListener("polyforge:consent-reset", onConsentReset);
    return () => {
      window.removeEventListener("polyforge:consent", onConsentChange);
      window.removeEventListener("polyforge:consent-reset", onConsentReset);
    };
  }, []);

  return null;
}
