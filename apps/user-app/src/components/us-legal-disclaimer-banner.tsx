import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

const STORAGE_PREFIX = 'polyforge:us-disclaimer-dismissed:';

export function dismissalKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function clearDismissal(userId: string): void {
  localStorage.removeItem(dismissalKey(userId));
}

interface Props {
  userId: string;
}

export function USLegalDisclaimerBanner({ userId }: Props) {
  const key = dismissalKey(userId);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (dismissed) {
        localStorage.setItem(key, '1');
      }
    } catch {
      // localStorage unavailable — banner stays shown, non-fatal
    }
  }, [dismissed, key]);

  if (dismissed) return null;

  return (
    <div
      role="note"
      aria-label="US regulatory disclaimer"
      data-testid="us-disclaimer-banner"
      className="flex items-start gap-3 rounded-pf border border-info/30 bg-info/8 px-4 py-3 text-body-sm text-info-text"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
      <p className="flex-1 leading-relaxed">
        <span className="font-semibold">US Regulatory Notice — Polymarket US Rail.</span>{' '}
        You are trading on the Polymarket US endpoint, which is operated in compliance with CFTC
        regulations. This platform is available only to eligible US persons. By connecting your
        credentials you confirm eligibility and agree to the{' '}
        <a
          href="/legal/terms"
          className="underline underline-offset-2 hover:text-info focus-visible:outline-none focus-visible:shadow-focus-ring"
        >
          Terms of Service
        </a>
        . Prediction markets involve risk; past performance is not indicative of future results.
        Please trade responsibly.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss US regulatory notice"
        className="ml-1 shrink-0 rounded p-0.5 text-info/60 hover:text-info focus-visible:outline-none focus-visible:shadow-focus-ring transition-colors"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
