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
  if (!status) return 'text-secondary bg-elevated';
  const s = status.toUpperCase();
  const colors: Record<string, string> = {
    HEALTHY: 'text-gain bg-gain/10',
    RUNNING: 'text-gain bg-gain/10',
    ACTIVE: 'text-gain bg-gain/10',
    CONNECTED: 'text-gain bg-gain/10',
    VERIFIED: 'text-info bg-info/10',
    COMPLETED: 'text-gain bg-gain/10',
    MATCHED: 'text-gain bg-gain/10',
    CONFIRMED: 'text-gain bg-gain/10',
    LIVE: 'text-gain bg-gain/10',
    OPEN: 'text-warning bg-warning/10',
    IN_PROGRESS: 'text-info bg-info/10',
    PENDING: 'text-warning bg-warning/10',
    QUEUED: 'text-warning bg-warning/10',
    PAPER: 'text-pf-purple-500 bg-pf-purple-500/10',
    PAUSED: 'text-warning bg-warning/10',
    IDLE: 'text-secondary bg-elevated',
    DEGRADED: 'text-warning bg-warning/10',
    DOWN: 'text-loss bg-loss/10',
    ERROR: 'text-loss bg-loss/10',
    FAILED: 'text-loss bg-loss/10',
    CANCELLED: 'text-secondary bg-elevated',
    ARCHIVED: 'text-secondary bg-elevated',
    SUSPENDED: 'text-loss bg-loss/10',
    UNVERIFIED: 'text-warning bg-warning/10',
    RESOLVED: 'text-gain bg-gain/10',
    CLOSED: 'text-secondary bg-elevated',
    REVIEWED: 'text-gain bg-gain/10',
    DISMISSED: 'text-secondary bg-elevated',
  };
  return colors[s] ?? 'text-secondary bg-elevated';
}

/** Priority badge color helpers */
export const priorityColor: Record<string, string> = {
  LOW: 'text-secondary bg-elevated',
  MEDIUM: 'text-warning bg-warning/10',
  HIGH: 'text-pf-gold-500 bg-pf-gold-500/10',
  URGENT: 'text-loss bg-loss/10',
};
