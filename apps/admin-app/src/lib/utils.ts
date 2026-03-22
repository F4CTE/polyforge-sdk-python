/** Format a date string to a relative time like "2m ago", "3h ago", "5d ago" */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Format a date string as a short date */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format a date string as date + time */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Status badge color helpers */
export function statusColor(status: string | undefined | null): string {
  if (!status) return 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]';
  const s = status.toUpperCase();
  const colors: Record<string, string> = {
    HEALTHY: 'text-emerald-400 bg-emerald-400/10',
    RUNNING: 'text-emerald-400 bg-emerald-400/10',
    ACTIVE: 'text-emerald-400 bg-emerald-400/10',
    CONNECTED: 'text-emerald-400 bg-emerald-400/10',
    VERIFIED: 'text-blue-400 bg-blue-400/10',
    COMPLETED: 'text-emerald-400 bg-emerald-400/10',
    MATCHED: 'text-emerald-400 bg-emerald-400/10',
    CONFIRMED: 'text-emerald-400 bg-emerald-400/10',
    LIVE: 'text-emerald-400 bg-emerald-400/10',
    OPEN: 'text-amber-400 bg-amber-400/10',
    IN_PROGRESS: 'text-blue-400 bg-blue-400/10',
    PENDING: 'text-amber-400 bg-amber-400/10',
    QUEUED: 'text-amber-400 bg-amber-400/10',
    PAPER: 'text-violet-400 bg-violet-400/10',
    PAUSED: 'text-amber-400 bg-amber-400/10',
    IDLE: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
    DEGRADED: 'text-amber-400 bg-amber-400/10',
    DOWN: 'text-red-400 bg-red-400/10',
    ERROR: 'text-red-400 bg-red-400/10',
    FAILED: 'text-red-400 bg-red-400/10',
    CANCELLED: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
    ARCHIVED: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
    SUSPENDED: 'text-red-400 bg-red-400/10',
    UNVERIFIED: 'text-amber-400 bg-amber-400/10',
    RESOLVED: 'text-emerald-400 bg-emerald-400/10',
    CLOSED: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
    REVIEWED: 'text-emerald-400 bg-emerald-400/10',
    DISMISSED: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
  };
  return colors[s] ?? 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]';
}

/** Priority badge color helpers */
export const priorityColor: Record<string, string> = {
  LOW: 'text-[var(--color-pf-text-secondary)] bg-[var(--color-pf-elevated)]',
  MEDIUM: 'text-amber-400 bg-amber-400/10',
  HIGH: 'text-orange-400 bg-orange-400/10',
  URGENT: 'text-red-400 bg-red-400/10',
};
