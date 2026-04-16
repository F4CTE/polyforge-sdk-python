import { useEffect, useState } from 'react';
import { X, FlaskConical } from 'lucide-react';

export const BETA_DISMISSED_KEY = 'pf-beta-dismissed';

export function BetaBanner() {
  const [visible, setVisible] = useState(false);

  // Read from localStorage after mount to avoid hydration mismatches
  useEffect(() => {
    if (!localStorage.getItem(BETA_DISMISSED_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(BETA_DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Beta notice"
      className="flex items-center gap-3 px-4 py-2.5 bg-warning-subtle border-b border-warning/20 text-warning"
    >
      <FlaskConical size={15} className="shrink-0" aria-hidden="true" />

      <p className="flex-1 text-[0.8125rem] leading-snug">
        <span className="font-semibold">PolyForge is currently in beta.</span>{' '}
        Features and limits are subject to change. Your feedback helps shape the
        product.
      </p>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss beta notice"
        className="shrink-0 flex items-center justify-center rounded-sm p-1 hover:bg-warning-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/50 transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
