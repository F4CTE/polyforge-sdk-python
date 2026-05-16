"use client";

import { useState, useEffect, useCallback } from "react";

type ConsentState = "pending" | "accepted" | "essential-only";

const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return "pending";
  try {
    const raw = localStorage.getItem("polyforge:consent");
    if (!raw) return "pending";
    // Legacy format: plain string "accepted" or "essential-only"
    // Migrate legacy plain-string format to JSON with current timestamp
    // so the 12-month expiry applies from first visit after migration.
    if (raw === "accepted" || raw === "essential-only") {
      try {
        localStorage.setItem(
          "polyforge:consent",
          JSON.stringify({ state: raw, timestamp: Date.now() }),
        );
      } catch {
        // silent
      }
      return raw;
    }
    // Current format: JSON { state, timestamp }
    const entry = JSON.parse(raw);
    if (!Number.isFinite(entry.timestamp) || Date.now() - entry.timestamp > CONSENT_MAX_AGE_MS) return "pending";
    if (entry.state === "accepted" || entry.state === "essential-only")
      return entry.state;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  return "pending";
}

function storeConsent(state: ConsentState) {
  try {
    const entry = JSON.stringify({
      state,
      timestamp: Date.now(),
    });
    localStorage.setItem("polyforge:consent", entry);
  } catch {
    // silent fail
  }
}

export function useCookieConsent() {
  // Stable initial state for SSR — always "pending" so server and client
  // render the same HTML on first paint. Reconcile with localStorage after mount.
  const [consent, setConsent] = useState<ConsentState>("pending");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored !== "pending") {
      setConsent(stored);
      window.dispatchEvent(
        new CustomEvent("polyforge:consent", { detail: stored }),
      );
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    function onReset() {
      try {
        localStorage.removeItem("polyforge:consent");
      } catch {
        // silent
      }
      setConsent("pending");
    }
    window.addEventListener("polyforge:consent-reset", onReset);
    return () => window.removeEventListener("polyforge:consent-reset", onReset);
  }, []);

  const acceptAll = useCallback(() => {
    storeConsent("accepted");
    setConsent("accepted");
    window.dispatchEvent(
      new CustomEvent("polyforge:consent", { detail: "accepted" }),
    );
  }, []);

  const acceptEssential = useCallback(() => {
    storeConsent("essential-only");
    setConsent("essential-only");
    window.dispatchEvent(
      new CustomEvent("polyforge:consent", { detail: "essential-only" }),
    );
  }, []);

  return { consent, mounted, acceptAll, acceptEssential };
}

export function CookieConsent() {
  const { consent, mounted, acceptAll, acceptEssential } = useCookieConsent();

  if (!mounted || consent !== "pending") return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      suppressHydrationWarning
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pointer-events-none"
    >
      <div className="max-w-container-landing mx-auto pointer-events-auto">
        <div className="bg-surface border border-subtle rounded-xl p-5 shadow-elevation-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-body-sm text-secondary leading-relaxed">
              We use cookies and analytics tools to understand how our site is
              used and to improve your experience.{" "}
              <a
                href="/cookies"
                className="text-accent-text underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
              >
                Learn more
              </a>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={acceptEssential}
              className="h-9 px-4 rounded-md border border-default text-sm font-medium text-primary hover:bg-elevated transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="h-9 px-4 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
