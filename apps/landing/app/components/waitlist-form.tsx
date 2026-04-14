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
        <p className="text-sm text-pf-success flex items-center justify-center gap-2">
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
          className="flex-1 min-w-[180px] min-h-[44px] bg-pf-elevated border border-pf-border-subtle rounded-pf-md text-pf-text font-sans text-pf-body px-4 py-3 outline-none transition-colors focus-visible:border-pf-cyan-400 focus-visible:ring-2 focus-visible:ring-pf-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-pf-base placeholder:text-pf-text-muted"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          aria-busy={status === "loading"}
          className="inline-flex items-center justify-center font-semibold text-pf-body px-6 py-3 min-h-[44px] rounded-pf-md bg-pf-cyan-500 text-pf-text-contrast cursor-pointer transition-all duration-pf-normal hover:bg-pf-cyan-400 hover:shadow-pf-glow-cyan-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:bg-pf-cyan-500 whitespace-nowrap"
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
      <p className="text-pf-body-sm text-pf-text-muted mt-3 text-center">
        Join the early-access list &mdash; no spam, ever.
      </p>
      {status === "error" && errorMsg && (
        <p
          id="waitlist-error"
          role="alert"
          className="text-pf-body-sm text-pf-danger mt-2 text-center"
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
