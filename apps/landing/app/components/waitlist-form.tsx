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

      if (res.ok || res.status === 409) {
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
      <div className={`text-center ${className}`}>
        <p className="text-sm text-green-400 flex items-center justify-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8l3.5 3.5L13 5"
              stroke="#4ade80"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          You&apos;re on the list! We&apos;ll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={className}>
      <div className="flex gap-2 flex-wrap">
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-label="Email address"
          className="flex-1 min-w-[200px] bg-pf-elevated border border-pf-border-subtle rounded-pf-md text-pf-text font-sans text-[15px] px-4 py-3 outline-none transition-colors focus:border-pf-cyan-400 placeholder:text-pf-text-muted"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center font-semibold text-[15px] px-6 py-3 rounded-pf-md bg-pf-cyan-500 text-black cursor-pointer transition-colors hover:bg-pf-cyan-400 disabled:opacity-60 whitespace-nowrap"
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
        <p className="text-[13px] text-red-400 mt-2 text-center">{errorMsg}</p>
      )}
    </form>
  );
}
