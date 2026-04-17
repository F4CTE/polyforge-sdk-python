import { Info } from 'lucide-react';
import { Tooltip } from '@polyforge/ui';

export interface BetaUsageBarProps {
  /** Human-readable label, e.g. "strategies active" */
  label: string;
  used: number;
  limit: number;
  /**
   * Formatter applied to the used/limit numbers in the text.
   * Defaults to displaying raw integers.
   */
  format?: (value: number) => string;
  className?: string;
}

/**
 * A subtle, non-alarming usage indicator for beta guardrails.
 *
 * Design rules (from charter):
 * - No red warnings — beta limits are guardrails, not paywalls.
 * - Accent bar color until near capacity; gold at ≥80 %.
 * - Info icon tooltip explains why the limit exists.
 */
export function BetaUsageBar({
  label,
  used,
  limit,
  format = String,
  className = '',
}: BetaUsageBarProps) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const atCap = used >= limit;
  const nearCap = pct >= 80;

  const fillColor = nearCap || atCap
    ? 'var(--color-gold-500)'
    : 'var(--accent-default)';

  return (
    <div className={`flex flex-col gap-1 ${className}`} data-testid="beta-usage-bar">
      <div className="flex items-center justify-between text-xs text-secondary">
        <span className="flex items-center gap-1">
          {format(used)} / {format(limit)} {label}
          <Tooltip
            content="Beta limits help us keep the platform stable for all users."
            side="right"
          >
            <Info className="size-3 text-tertiary cursor-default" aria-hidden="true" />
          </Tooltip>
        </span>
        {atCap && (
          <span className="text-[var(--color-gold-500)] font-medium" role="status" aria-live="polite">
            Limit reached
          </span>
        )}
      </div>
      {/* Inline progress bar so we can control fill color without modifying the shared Progress component */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${format(used)} of ${format(limit)} used`}
        className="h-1 w-full overflow-hidden rounded-full bg-overlay"
      >
        <div
          className="h-full rounded-full transition-all duration-slow"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}
