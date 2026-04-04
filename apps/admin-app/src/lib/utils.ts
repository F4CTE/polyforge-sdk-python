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
  if (!status) return 'text-pf-text-secondary bg-pf-elevated';
  const s = status.toUpperCase();
  const colors: Record<string, string> = {
    HEALTHY: 'text-pf-success bg-pf-success/10',
    RUNNING: 'text-pf-success bg-pf-success/10',
    ACTIVE: 'text-pf-success bg-pf-success/10',
    CONNECTED: 'text-pf-success bg-pf-success/10',
    VERIFIED: 'text-pf-info bg-pf-info/10',
    COMPLETED: 'text-pf-success bg-pf-success/10',
    MATCHED: 'text-pf-success bg-pf-success/10',
    CONFIRMED: 'text-pf-success bg-pf-success/10',
    LIVE: 'text-pf-success bg-pf-success/10',
    OPEN: 'text-pf-warning bg-pf-warning/10',
    IN_PROGRESS: 'text-pf-info bg-pf-info/10',
    PENDING: 'text-pf-warning bg-pf-warning/10',
    QUEUED: 'text-pf-warning bg-pf-warning/10',
    PAPER: 'text-pf-purple-500 bg-pf-purple-500/10',
    PAUSED: 'text-pf-warning bg-pf-warning/10',
    IDLE: 'text-pf-text-secondary bg-pf-elevated',
    DEGRADED: 'text-pf-warning bg-pf-warning/10',
    DOWN: 'text-pf-danger bg-pf-danger/10',
    ERROR: 'text-pf-danger bg-pf-danger/10',
    FAILED: 'text-pf-danger bg-pf-danger/10',
    CANCELLED: 'text-pf-text-secondary bg-pf-elevated',
    ARCHIVED: 'text-pf-text-secondary bg-pf-elevated',
    SUSPENDED: 'text-pf-danger bg-pf-danger/10',
    UNVERIFIED: 'text-pf-warning bg-pf-warning/10',
    RESOLVED: 'text-pf-success bg-pf-success/10',
    CLOSED: 'text-pf-text-secondary bg-pf-elevated',
    REVIEWED: 'text-pf-success bg-pf-success/10',
    DISMISSED: 'text-pf-text-secondary bg-pf-elevated',
  };
  return colors[s] ?? 'text-pf-text-secondary bg-pf-elevated';
}

/** Priority badge color helpers */
export const priorityColor: Record<string, string> = {
  LOW: 'text-pf-text-secondary bg-pf-elevated',
  MEDIUM: 'text-pf-warning bg-pf-warning/10',
  HIGH: 'text-pf-gold-500 bg-pf-gold-500/10',
  URGENT: 'text-pf-danger bg-pf-danger/10',
};
