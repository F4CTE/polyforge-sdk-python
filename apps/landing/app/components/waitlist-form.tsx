"use client";

import { useState, useCallback, type FormEvent, type ChangeEvent } from "react";
import { Check, Loader2 } from "lucide-react";

const API = "/auth/v1/waitlist";

interface WaitlistFormProps {
  className?: string;
}

export function WaitlistForm({ className = "" }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 409) {
        setStatus("success");
        setErrorMsg("already");
      } else if (res.ok) {
        setStatus("success");
      } else {
        throw new Error("server error");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className={`text-center ${className}`}
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-gain flex items-center justify-center gap-2">
          <Check size={16} aria-hidden="true" />
          {errorMsg === "already"
            ? "You\u2019re already on the list \u2014 check your inbox!"
            : "You\u2019re on the list! We\u2019ll be in touch soon."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      noValidate
      className={className}
    >
      <div className="flex gap-2 flex-col sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          type="email"
          name="email"
          id="waitlist-email"
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "waitlist-error" : undefined}
          className="flex-1 min-w-input-min-sm min-h-touch-target bg-elevated border border-subtle rounded-lg text-primary font-sans text-body-md px-4 py-3 outline-none transition-colors duration-panel focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-app placeholder:text-tertiary"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          aria-busy={status === "loading"}
          className="inline-flex items-center justify-center font-semibold text-body-md px-6 py-3 min-h-touch-target rounded-lg bg-accent text-inverse cursor-pointer transition-all duration-panel hover:bg-accent-text hover:shadow-glow-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:bg-accent whitespace-nowrap"
        >
          <span>Request access</span>
          {status === "loading" && (
            <Loader2
              size={16}
              className="ml-2 animate-spin"
              aria-hidden="true"
            />
          )}
        </button>
      </div>
      <p className="text-body-sm text-tertiary mt-3 text-center">
        Join the early-access list &mdash; no spam, ever.
      </p>
      {status === "error" && errorMsg && (
        <p
          id="waitlist-error"
          role="alert"
          className="text-body-sm text-loss mt-2 text-center"
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
