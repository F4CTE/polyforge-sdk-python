'use client';

import { useState, type FormEvent } from 'react';

const API = '/auth/v1/waitlist';

interface WaitlistFormProps {
  className?: string;
}

export function WaitlistForm({ className = '' }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 409) {
        setStatus('success');
        setErrorMsg('already');
      } else if (res.ok) {
        setStatus('success');
      } else {
        throw new Error('server error');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className={`text-center ${className}`} role="status" aria-live="polite">
        <p className="text-sm text-pf-success flex items-center justify-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8l3.5 3.5L13 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {errorMsg === 'already'
            ? "You\u2019re already on the list \u2014 check your inbox!"
            : "You\u2019re on the list! We\u2019ll be in touch soon."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={className}>
      <div className="flex gap-2 flex-col sm:flex-row">
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-label="Email address"
          aria-invalid={status === 'error'}
          aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
          className="flex-1 min-w-[180px] bg-pf-elevated border border-pf-border-subtle rounded-pf-md text-pf-text font-sans text-[15px] px-4 py-3 outline-none transition-colors focus:border-pf-cyan-400 focus-visible:ring-2 focus-visible:ring-pf-cyan-400/50 placeholder:text-pf-text-muted"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center font-semibold text-[15px] px-6 py-3 rounded-pf-md bg-pf-cyan-500 text-black cursor-pointer transition-all duration-200 hover:bg-pf-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span>Request access</span>
          {status === 'loading' && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="ml-1.5 animate-spin"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="28"
                strokeDashoffset="10"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="text-[13px] text-pf-text-muted mt-2.5 text-center">
        Join the early-access list &mdash; no spam, ever.
      </p>
      {status === 'error' && errorMsg && (
        <p id="waitlist-error" role="alert" className="text-[13px] text-pf-danger mt-2 text-center">{errorMsg}</p>
      )}
    </form>
  );
}
