import { Globe, Flag } from 'lucide-react';

interface Props {
  rail: 'global' | 'us';
  className?: string;
}

export function RailIndicatorBadge({ rail, className = '' }: Props) {
  const isUs = rail === 'us';
  return (
    <span
      data-testid="rail-indicator-badge"
      aria-label={`Polymarket rail: ${isUs ? 'US (CFTC-regulated)' : 'Global'}`}
      title={isUs ? 'Polymarket US rail — CFTC regulated' : 'Polymarket Global rail'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label font-medium border ${
        isUs
          ? 'bg-warning/10 text-warning border-warning/25'
          : 'bg-accent-subtle text-accent-text border-accent-border'
      } ${className}`}
    >
      {isUs ? (
        <Flag className="size-3" aria-hidden="true" />
      ) : (
        <Globe className="size-3" aria-hidden="true" />
      )}
      {isUs ? 'US Rail' : 'Global Rail'}
    </span>
  );
}
